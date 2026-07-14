import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const PROGNOSIS_BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

// Shared by both login providers — Prognosis endpoints in this system
// routinely return HTTP 200 with a status/error field even on a rejected
// login, so res.ok alone is never a valid pass/fail signal.
async function validateWithPrognosis(email: string, password: string): Promise<boolean> {
  const requestBody = JSON.stringify({
    UserName: email,
    Password: password,
    RememberMe: true,
    Email: email,
    LogInSource: 'CorporatePortal',
  });
  try {
    const res = await fetch(`${PROGNOSIS_BASE}/api/Account/ExternalPortalLogin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: requestBody,
    });
    const text = await res.text();
    console.log(`[auth/validateWithPrognosis] email=${email} → HTTP ${res.status}: ${text.slice(0, 500)}`);

    if (!res.ok) return false;

    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch {
      console.log(`[auth/validateWithPrognosis] email=${email} non-JSON response`);
      return false;
    }
    const status = String(data?.status ?? data?.Status ?? '').toLowerCase();
    if (status && !['success', 'true', '200', 'ok'].includes(status)) {
      console.log(`[auth/validateWithPrognosis] email=${email} rejected: status=${status}`);
      return false;
    }
    if (data?.ErrorMessage || data?.errorMessage || data?.error || data?.Error) {
      console.log(`[auth/validateWithPrognosis] email=${email} rejected: error field present`);
      return false;
    }

    const payload = (data?.result ?? data?.Result ?? data?.data ?? data?.Data) as Record<string, unknown> | Record<string, unknown>[] | null;
    if (!payload) {
      console.log(`[auth/validateWithPrognosis] email=${email} rejected: no result/data wrapper in response`);
      return false;
    }
    const record = Array.isArray(payload) ? payload[0] as Record<string, unknown> : payload;
    if (!record || typeof record !== 'object') {
      console.log(`[auth/validateWithPrognosis] email=${email} rejected: wrapper payload not an object`);
      return false;
    }

    const emailRaw = record.email ?? record.Email ?? record.EmailAddress ?? null;
    const idRaw     = record.id ?? record.Id ?? record.userId ?? record.UserId ?? null;
    const ok = Boolean(emailRaw && idRaw);
    if (!ok) console.log(`[auth/validateWithPrognosis] email=${email} rejected: missing email/id in record, keys=${Object.keys(record).join(',')}`);
    return ok;
  } catch (err) {
    console.error('[auth/validateWithPrognosis] Error:', err);
    return false;
  }
}

declare module 'next-auth' {
  interface User {
    loginType?: string;
    companyId?: string | null;
    companyName?: string | null;
    policyNumber?: string | null;
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      loginType: string;
      companyId?: string | null;
      companyName?: string | null;
      policyNumber?: string | null;
      role?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    loginType?: string;
    companyId?: string | null;
    companyName?: string | null;
    policyNumber?: string | null;
    role?: string;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      id: 'hr-credentials',
      name: 'HR Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        otp: { label: 'OTP', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.active) {
          console.log(`[auth/hr-credentials] email=${credentials.email} rejected: no active user found`);
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) {
          console.log(`[auth/hr-credentials] email=${user.email} rejected: local bcrypt check failed`);
          return null;
        }

        // Require Prognosis to also confirm the password before granting
        // entry — our local hash and Prognosis's record must both agree.
        const prognosisValid = await validateWithPrognosis(user.email, credentials.password as string);
        if (!prognosisValid) {
          console.log(`[auth/hr-credentials] email=${user.email} rejected: Prognosis ExternalPortalLogin check failed`);
          return null;
        }

        // 2FA: when enabled, a valid emailed OTP is required to get a session.
        // Enforced here (not just in the UI) so it can't be bypassed by
        // calling the sign-in endpoint directly.
        if (user.twoFaEnabled) {
          const otp = String(credentials.otp ?? '').trim();
          if (!otp) return null;
          const { verifyLoginOtp } = await import('@/lib/login-otp-verify');
          const check = await verifyLoginOtp(user.id, otp);
          if (check !== 'ok') return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          loginType: 'hr',
          companyId: user.companyId,
          companyName: user.companyName,
          policyNumber: user.policyNumber,
          role: user.role,
        };
      },
    }),
    Credentials({
      id: 'staff-credentials',
      name: 'Staff Credentials',
      credentials: {
        login: { label: 'Login', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null;

        try {
          const res = await fetch(`${PROGNOSIS_BASE}/api/Account/ExternalPortalLogin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              email: credentials.login,
              password: credentials.password,
              LogInSource: 'CorporatePortal',
            }),
          });

          if (!res.ok) return null;

          const data = await res.json() as Record<string, unknown>;

          // Prognosis endpoints in this system routinely return HTTP 200 with
          // a status/error field even on a rejected login — checking res.ok
          // alone is not a valid pass/fail signal. Reject on any explicit
          // failure indicator before considering this a successful login.
          const status = String(data?.status ?? data?.Status ?? '').toLowerCase();
          if (status && !['success', 'true', '200', 'ok'].includes(status)) return null;
          if (data?.ErrorMessage || data?.errorMessage || data?.error || data?.Error) return null;

          // Only ever trust an explicitly wrapped payload — never fall back to
          // the raw top-level response, which is still a truthy object even
          // for a rejection body with no wrapper key.
          const payload = (data?.result ?? data?.Result ?? data?.data ?? data?.Data) as Record<string, unknown> | Record<string, unknown>[] | null;
          if (!payload) return null;

          // Prognosis returns an array or object — normalise
          const record = Array.isArray(payload) ? payload[0] as Record<string, unknown> : payload;
          if (!record || typeof record !== 'object') return null;

          // Require Prognosis to return a genuine identity — never fall back
          // to the credentials the user typed, or any HTTP-200 response with
          // a wrapper key (even an empty one) could still grant a session.
          const emailRaw = record.email ?? record.Email ?? record.EmailAddress ?? null;
          const idRaw     = record.id ?? record.Id ?? record.userId ?? record.UserId ?? null;
          if (!emailRaw || !idRaw) return null;

          const email = String(emailRaw);
          const id    = String(idRaw);
          const name  = String(record.name ?? record.Name ?? record.FullName ?? record.fullName ?? email);

          return {
            id,
            email,
            name,
            loginType: 'staff',
            role: 'staff',
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.loginType  = user.loginType;
        token.companyId  = user.companyId;
        token.companyName = user.companyName;
        token.policyNumber = user.policyNumber;
        token.role       = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.loginType   = (token.loginType  as string) ?? '';
      session.user.companyId   = token.companyId   as string | null | undefined;
      session.user.companyName = token.companyName as string | null | undefined;
      session.user.policyNumber = token.policyNumber as string | null | undefined;
      session.user.role        = token.role        as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
