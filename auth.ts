import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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

  delete user.PasswordHash;
  delete user.SecurityStamp;
  return user;
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
    // ── HR portal login (our DB) ──
    Credentials({
      id: 'hr-credentials',
      name: 'HR Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        _loginType: { label: '', type: 'hidden' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId ?? '',
          companyName: user.companyName ?? '',
          loginType: 'hr',
        };
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
          const staffUser = await prognosisStaffLogin(
            credentials.login as string,
            credentials.password as string
          );

          return {
            id: staffUser.Id ?? staffUser.id ?? staffUser.UserId ?? 'staff',
            email: staffUser.Email ?? staffUser.email ?? credentials.login,
            name: staffUser.FullName ?? staffUser.Name ?? staffUser.name ?? staffUser.UserName ?? credentials.login,
            role: staffUser.RoleName ?? staffUser.Role ?? 'staff',
            loginType: 'staff',
          };
        } catch (err) {
          console.error('[staff-login] Prognosis auth failed:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.role      = (user as { role?: string }).role;
        token.companyId = (user as { companyId?: string }).companyId ?? '';
        token.companyName = (user as { companyName?: string }).companyName ?? '';
        token.loginType = (user as { loginType?: string }).loginType ?? 'hr';
      }
      // account is only present on initial sign-in — use provider to set loginType reliably
      if (account) {
        token.loginType = account.provider === 'staff-credentials' ? 'staff' : 'hr';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id               = token.sub ?? '';
        (session.user as { role?: string }).role           = token.role as string;
        (session.user as { loginType?: string }).loginType = token.loginType as string;
        (session.user as { companyId?: string }).companyId = token.companyId as string;
        (session.user as { companyName?: string }).companyName = token.companyName as string;
      }
      return session;
    },
  },
});
