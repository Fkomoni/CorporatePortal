import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const PROGNOSIS_BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;

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
          const payload = (data?.result ?? data?.Result ?? data?.data ?? data?.Data ?? data) as Record<string, unknown> | null;
          if (!payload) return null;

          // Prognosis returns an array or object — normalise
          const record = Array.isArray(payload) ? payload[0] as Record<string, unknown> : payload;
          if (!record) return null;

          const email = String(record.email ?? record.Email ?? record.EmailAddress ?? credentials.login);
          const name  = String(record.name ?? record.Name ?? record.FullName ?? record.fullName ?? credentials.login);
          const id    = String(record.id ?? record.Id ?? record.userId ?? record.UserId ?? email);

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
