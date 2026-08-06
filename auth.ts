import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { staffLogin } from '@/lib/prognosis-staff-login';
import { verifyStaffLoginOtp } from '@/lib/staff-login-otp';
import { isDeviceTrusted } from '@/lib/staff-trusted-device';

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
    isInternalStaff?: boolean;
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
      isInternalStaff?: boolean;
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
    isInternalStaff?: boolean;
  }
}

// ── Session policy ───────────────────────────────────────────────────────────
// Previously there was none: `{ strategy: 'jwt' }` alone falls back to NextAuth's
// 30-day default and rolls forward on every read, so anyone using the portal
// monthly was never signed out. For a portal holding health and financial data:
const SESSION_IDLE_MS     = 8  * 60 * 60 * 1000; // signed out after 8h unused
const SESSION_ABSOLUTE_MS = 24 * 60 * 60 * 1000; // re-authenticate daily regardless
// How often the JWT is re-checked against the database. The token carries
// role/companyId/active state captured at sign-in, and nothing re-read it — so
// revoking an account or changing a role had no effect on anyone already signed
// in. This bounds that staleness without a query on every request.
const REVALIDATE_MS       = 5  * 60 * 1000;

/**
 * Re-reads the signed-in principal and reports whether the session may continue.
 * Returns null when the account should be signed out; otherwise returns the
 * fields that may have changed since sign-in.
 */
async function revalidatePrincipal(token: {
  sub?: string; email?: string | null; loginType?: unknown; isInternalStaff?: unknown;
}): Promise<{ role?: string; companyId?: string | null; companyName?: string | null; policyNumber?: string | null } | null> {
  const id = token.sub;
  if (!id) return null;

  // Internal staff acting for a client sign in as loginType 'hr', but their
  // identity is a StaffUser — so the table to check is decided by
  // isInternalStaff, not by loginType.
  const isStaffIdentity = token.loginType === 'staff' || token.isInternalStaff === true;

  if (isStaffIdentity) {
    const staff = await prisma.staffUser.findUnique({ where: { id } });
    if (!staff || !staff.active) return null;
    // Staff acting for a client also need their per-client grant to still exist.
    if (token.isInternalStaff === true && token.email) {
      const grants = await prisma.staffClientAccess.findMany({ where: { staffEmail: token.email } });
      if (grants.length === 0) return null;
    }
    return {};
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.active) return null;
  return {
    role: user.role,
    companyId: user.companyId,
    companyName: user.companyName,
    policyNumber: user.policyNumber,
  };
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: SESSION_IDLE_MS / 1000,
    // Refresh the cookie at most every 15 minutes rather than the 24h default,
    // so the idle window is measured from real activity.
    updateAge: 15 * 60,
  },
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
        // entry — but only for accounts it actually knows the current
        // password for (prognosisSynced). A forgot-password reset can only
        // update our local hash (Prognosis's ChangePassword needs the old
        // password, which by definition is unknown), so those accounts are
        // marked out of sync and skip this check until back in sync.
        if (user.prognosisSynced) {
          const prognosisValid = await validateWithPrognosis(user.email, credentials.password as string);
          if (!prognosisValid) {
            console.log(`[auth/hr-credentials] email=${user.email} rejected: Prognosis ExternalPortalLogin check failed`);
            return null;
          }
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
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        otp: { label: 'OTP', type: 'text' },
        companyId: { label: 'Company', type: 'text' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim();
        const password = String(credentials?.password ?? '');
        const otp = String(credentials?.otp ?? '').trim();
        // Empty companyId means "the general Leadway staff console" (platform
        // administration: Corporates, Portal Settings, Audit Logs, managing
        // who gets client access) rather than acting as HR for one client.
        const companyId = String(credentials?.companyId ?? '').trim();
        if (!email || !password) {
          console.log('[auth/staff-credentials] rejected: missing email/password');
          return null;
        }

        // Internal admins never have a locally-set password — every login
        // re-validates live against Prognosis, which checks Leadway AD.
        let staff;
        try {
          staff = await staffLogin(email, password);
        } catch (err) {
          console.error('[auth/staff-credentials] Prognosis error:', err);
          return null;
        }
        if (!staff) {
          console.log(`[auth/staff-credentials] email=${email} rejected: Prognosis/AD check failed`);
          return null;
        }

        const staffUser = await prisma.staffUser.findUnique({ where: { email: staff.email } });
        if (!staffUser || !staffUser.active) {
          console.log(`[auth/staff-credentials] email=${staff.email} rejected: no active staff user record`);
          return null;
        }

        // A recognized device may skip OTP entirely — re-checked here
        // server-side rather than trusting the earlier request-login-otp
        // response, same as every other check in this function.
        const trusted = await isDeviceTrusted(staffUser.id);
        if (!trusted) {
          if (!otp) {
            console.log(`[auth/staff-credentials] email=${staff.email} rejected: OTP required, none provided`);
            return null;
          }
          const otpCheck = await verifyStaffLoginOtp(staffUser.id, otp);
          if (otpCheck !== 'ok') {
            console.log(`[auth/staff-credentials] email=${staff.email} rejected: OTP check=${otpCheck}`);
            return null;
          }
        }

        await prisma.staffUser.update({ where: { id: staffUser.id }, data: { lastLogin: new Date() } });

        if (!companyId) {
          return {
            id: staffUser.id,
            email: staffUser.email,
            name: staffUser.name,
            loginType: 'staff',
            role: 'staff',
          };
        }

        // The chosen client must be one this staff email is actually linked
        // to — never trust the client-side value alone.
        const access = await prisma.staffClientAccess.findUnique({
          where: { staffEmail_companyId: { staffEmail: staff.email, companyId } },
        });
        if (!access) {
          console.log(`[auth/staff-credentials] email=${staff.email} rejected: no access to companyId=${companyId}`);
          return null;
        }

        return {
          id: staffUser.id,
          email: staffUser.email,
          name: staffUser.name,
          loginType: 'hr',
          companyId: access.companyId,
          companyName: access.companyName,
          policyNumber: access.policyNumber,
          // staffUser.role is Leadway's internal AD/Prognosis role (officer,
          // supervisor, medical_director, admin) — it has nothing to do with
          // the portal's own HR role vocabulary (Admin/HR Manager/Finance/
          // Viewer). Internal staff already passed a stronger gate to get
          // here (AD login + an explicit per-client grant in
          // StaffClientAccess), so they get full HR-admin access to the
          // client they're acting for, regardless of their internal title.
          role: 'hr_admin',
          isInternalStaff: true,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const now = Date.now();

      // Sign-in: stamp the absolute deadline so a rolling idle window can't
      // extend one session indefinitely.
      if (user) {
        token.loginType  = user.loginType;
        token.companyId  = user.companyId;
        token.companyName = user.companyName;
        token.policyNumber = user.policyNumber;
        token.role       = user.role;
        token.isInternalStaff = user.isInternalStaff ?? false;
        token.sessionStart = now;
        token.lastChecked  = now;
        return token;
      }

      const start = typeof token.sessionStart === 'number' ? token.sessionStart : null;
      if (start === null) {
        // Issued before this policy existed: adopt it from now rather than
        // signing every existing session out on deploy.
        token.sessionStart = now;
      } else if (now - start > SESSION_ABSOLUTE_MS) {
        return null; // past the absolute lifetime — force re-authentication
      }

      // Prisma cannot run in the Edge runtime, and this callback executes there
      // too — middleware.ts imports auth.ts, so every request through the
      // matcher runs it. Querying unconditionally would throw on every request
      // and take the app down. The expiry checks above are pure token maths and
      // still apply in Edge; the database check is deferred to Node contexts
      // (API routes, server components), which every page load also hits, so
      // revocation still takes effect within REVALIDATE_MS in practice.
      const canQueryDb = process.env.NEXT_RUNTIME !== 'edge';

      const checked = typeof token.lastChecked === 'number' ? token.lastChecked : 0;
      if (canQueryDb && now - checked >= REVALIDATE_MS) {
        try {
          const fresh = await revalidatePrincipal(token);
          if (!fresh) {
            console.log(`[auth/jwt] session ended for ${token.email ?? token.sub}: account inactive or access revoked`);
            return null;
          }
          // Pick up role / company changes without waiting for a re-login.
          if (fresh.role !== undefined)        token.role = fresh.role;
          if (fresh.companyId !== undefined)   token.companyId = fresh.companyId;
          if (fresh.companyName !== undefined) token.companyName = fresh.companyName;
          if (fresh.policyNumber !== undefined) token.policyNumber = fresh.policyNumber;
          token.lastChecked = now;
        } catch (err) {
          // Deliberately fail open on a transient database error: signing every
          // user out because Postgres blinked is worse than up to
          // REVALIDATE_MS of staleness. lastChecked is not advanced, so the
          // next request retries immediately.
          console.error('[auth/jwt] revalidation failed, keeping session:', err);
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id          = (token.sub as string) ?? '';
      session.user.loginType   = (token.loginType  as string) ?? '';
      session.user.companyId   = token.companyId   as string | null | undefined;
      session.user.companyName = token.companyName as string | null | undefined;
      session.user.policyNumber = token.policyNumber as string | null | undefined;
      session.user.role        = token.role        as string | undefined;
      session.user.isInternalStaff = (token.isInternalStaff as boolean) ?? false;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
