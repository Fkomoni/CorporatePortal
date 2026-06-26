import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

// ── Prognosis staff login helper ──────────────────────────────────────────────
async function prognosisStaffLogin(login: string, password: string) {
  const base = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
    .replace(/\/api$/, '')
    .replace(/\/$/, '');

  const serviceAuth =
    'Basic ' +
    Buffer.from(
      `${process.env.PROGNOSIS_USERNAME}:${process.env.PROGNOSIS_PASSWORD}`
    ).toString('base64');

  const res = await fetch(`${base}/api/Account/ExternalPortalLogin`, {
    method: 'POST',
    headers: {
      Authorization: serviceAuth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      UserName: login,
      Email: login,
      Password: password,
      LogInSource: 'Core',
    }),
  });

  console.log(`[prognosis] POST ${base}/api/Account/ExternalPortalLogin → HTTP ${res.status}`);

  if (res.status === 401 || res.status === 403 || (res.status >= 400 && res.status < 500))
    throw new Error('Invalid credentials');
  if (res.status >= 500)
    throw new Error(`Prognosis unavailable (${res.status})`);

  const data = await res.json();
  console.log('[prognosis] response status field:', data?.status, '| result length:', Array.isArray(data?.result) ? data.result.length : 'n/a');

  if ([false, 'error', 'fail', 'failed'].includes(data?.status))
    throw new Error(data.ErrorMessage || data.message || 'Invalid credentials');

  const user = Array.isArray(data?.result) ? data.result[0] : null;
  if (!user) throw new Error('Invalid credentials');

  // Extract Bearer token for subsequent Prognosis API calls
  const prognosisToken: string | null =
    data?.token ?? data?.Token ?? data?.access_token ?? data?.AccessToken ??
    user?.Token ?? user?.AccessToken ?? user?.token ?? null;

  delete user.PasswordHash;
  delete user.SecurityStamp;
  return { user, prognosisToken };
}

// ── NextAuth config ───────────────────────────────────────────────────────────
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    // ── HR portal login (Prognosis ExternalPortalLogin) ──
    Credentials({
      id: 'hr-credentials',
      name: 'HR Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const base = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
          .replace(/\/api$/, '')
          .replace(/\/$/, '');

        const serviceAuth =
          'Basic ' +
          Buffer.from(`${process.env.PROGNOSIS_USERNAME}:${process.env.PROGNOSIS_PASSWORD}`).toString('base64');

        try {
          const res = await fetch(`${base}/api/Account/ExternalPortalLogin`, {
            method: 'POST',
            headers: { Authorization: serviceAuth, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              UserName: credentials.email,
              Email: credentials.email,
              Password: credentials.password,
              LogInSource: 'Client',
            }),
          });

          console.log(`[hr-login] POST ${base}/api/Account/ExternalPortalLogin → HTTP ${res.status}`);

          if (res.status >= 400) {
            console.log('[hr-login] auth failed, status:', res.status);
            return null;
          }

          const data = await res.json();
          console.log('[hr-login] full response:', JSON.stringify(data).slice(0, 500));

          // Prognosis uses numeric status codes inside a 200 response for errors
          if (!data || data?.status === false || [false, 'error', 'fail', 'failed'].includes(data?.status)
              || (typeof data?.status === 'number' && data.status >= 400)) {
            console.log('[hr-login] Prognosis application error, status:', data?.status);
            return null;
          }

          const user = Array.isArray(data?.result) ? data.result[0] : (data?.result ?? data?.user ?? data?.User ?? null);
          if (!user) return null;

          const prognosisToken: string | null =
            data?.token ?? data?.Token ?? data?.access_token ?? data?.AccessToken ??
            user?.Token ?? user?.AccessToken ?? user?.token ?? null;

          return {
            id: user.Id ?? user.id ?? user.UserId ?? String(credentials.email),
            email: user.Email ?? user.email ?? String(credentials.email),
            name: user.FullName ?? user.Name ?? user.name ?? user.UserName ?? String(credentials.email),
            role: user.RoleName ?? user.Role ?? 'hr',
            companyId: String(user.GroupID ?? user.GROUP_ID ?? user.CompanyId ?? user.companyId ?? ''),
            companyName: String(user.GroupName ?? user.GROUP_NAME ?? user.CompanyName ?? user.companyName ?? ''),
            loginType: 'hr',
            prognosisToken: prognosisToken ?? '',
          };
        } catch (err) {
          console.error('[hr-login] Prognosis auth error:', err);
          return null;
        }
      },
    }),

    // ── Leadway staff login (Prognosis) ──
    Credentials({
      id: 'staff-credentials',
      name: 'Staff Credentials',
      credentials: {
        login: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null;

        try {
          const { user: staffUser, prognosisToken } = await prognosisStaffLogin(
            credentials.login as string,
            credentials.password as string
          );

          return {
            id: staffUser.Id ?? staffUser.id ?? staffUser.UserId ?? 'staff',
            email: staffUser.Email ?? staffUser.email ?? credentials.login,
            name: staffUser.FullName ?? staffUser.Name ?? staffUser.name ?? staffUser.UserName ?? credentials.login,
            role: staffUser.RoleName ?? staffUser.Role ?? 'staff',
            loginType: 'staff',
            prognosisToken: prognosisToken ?? '',
          };
        } catch (err) {
          console.error('[staff-login] Prognosis auth failed:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role           = (user as { role?: string }).role;
        token.companyId      = (user as { companyId?: string }).companyId ?? '';
        token.companyName    = (user as { companyName?: string }).companyName ?? '';
        token.loginType      = (user as { loginType?: string }).loginType ?? 'hr';
        token.prognosisToken = (user as { prognosisToken?: string }).prognosisToken ?? '';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id                         = token.sub ?? '';
        (session.user as { role?: string }).role                     = token.role as string;
        (session.user as { loginType?: string }).loginType           = token.loginType as string;
        (session.user as { companyId?: string }).companyId           = token.companyId as string;
        (session.user as { companyName?: string }).companyName       = token.companyName as string;
        (session.user as { prognosisToken?: string }).prognosisToken = token.prognosisToken as string;
      }
      return session;
    },
  },
});
