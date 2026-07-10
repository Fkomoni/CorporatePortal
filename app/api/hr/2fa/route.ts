// HR 2FA settings.
//   GET  → { enabled }
//   POST { action: 'setup' }                → email a verification code
//   POST { action: 'verify', code }         → confirm code, enable 2FA
//   POST { action: 'disable', password }    → turn off (requires password)
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { issueLoginOtp, verifyLoginOtp } from '@/lib/login-otp';
import { logAudit } from '@/lib/audit';
import { getServiceToken } from '@/lib/corporate-welcome';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

// Best-effort lookup of a mobile number already on file in Prognosis for this
// HR user, so the SMS 2FA setup screen isn't blank when a number already
// exists there — matched by email against the group's member list.
async function findPrognosisMobile(email: string, groupId: string | null): Promise<string> {
  if (!email || !groupId) return '';
  try {
    const token = await getServiceToken();
    const res = await fetch(`${BASE}/api/CorporatePortal/ViewMembersPerGroup?groupId=${encodeURIComponent(groupId)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const raw = await res.json().catch(() => null);
    const rows: Record<string, unknown>[] = Array.isArray(raw) ? raw
      : Array.isArray((raw as Record<string, unknown>)?.data) ? (raw as Record<string, unknown>).data as Record<string, unknown>[]
      : Array.isArray((raw as Record<string, unknown>)?.Data) ? (raw as Record<string, unknown>).Data as Record<string, unknown>[]
      : [];
    const wanted = email.trim().toLowerCase();
    const match = rows.find((r) => str(r, 'EmailAdress', 'Email', 'EmailAddress').toLowerCase() === wanted);
    return match ? str(match, 'Mobile', 'Mobile1', 'Phone', 'MobileNumber') : '';
  } catch (e) {
    console.warn('[hr/2fa] Prognosis mobile lookup failed:', e);
    return '';
  }
}

export async function GET() {
  const session = await auth();
  if (!session || session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email ?? '' },
    select: { twoFaEnabled: true, twoFaMethod: true, mobile: true },
  });

  let suggestedMobile = '';
  if (!user?.mobile) {
    suggestedMobile = await findPrognosisMobile(session.user.email ?? '', session.user.companyId ?? null);
  }

  return NextResponse.json({
    enabled: user?.twoFaEnabled ?? false,
    method: user?.twoFaMethod ?? 'email',
    mobile: user?.mobile ?? '',
    suggestedMobile,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action?: string; code?: string; password?: string; method?: string; mobile?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email ?? '' } });
  if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  switch (body.action) {
    case 'setup': {
      const method = body.method === 'sms' ? 'sms' : 'email';
      let mobile = user.mobile;

      if (method === 'sms') {
        mobile = (body.mobile ?? user.mobile ?? '').trim();
        if (!mobile) return NextResponse.json({ error: 'A phone number is required for SMS verification.' }, { status: 400 });
        if (mobile !== user.mobile) {
          await prisma.user.update({ where: { id: user.id }, data: { mobile } });
        }
      }

      const sent = await issueLoginOtp({ ...user, mobile }, method);
      if (!sent) return NextResponse.json({ error: `Could not send the verification code${method === 'sms' ? ' by SMS' : ''}. Please try again.` }, { status: 502 });
      return NextResponse.json({ sent: true });
    }

    case 'verify': {
      const code = String(body.code ?? '').trim();
      if (!code) return NextResponse.json({ error: 'Verification code is required.' }, { status: 400 });
      const check = await verifyLoginOtp(user.id, code);
      if (check === 'locked')  return NextResponse.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 });
      if (check === 'expired') return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 });
      if (check !== 'ok')      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });

      const method = body.method === 'sms' ? 'sms' : 'email';
      await prisma.user.update({ where: { id: user.id }, data: { twoFaEnabled: true, twoFaMethod: method } });
      void logAudit({ session, action: 'ENABLE_2FA', resource: 'account', request: req, details: { method } });
      return NextResponse.json({ enabled: true });
    }

    case 'disable': {
      // Require the account password to turn 2FA off
      const ok = body.password ? await bcrypt.compare(body.password, user.password) : false;
      if (!ok) return NextResponse.json({ error: 'Password is required to disable 2FA.' }, { status: 400 });

      await prisma.user.update({
        where: { id: user.id },
        data: { twoFaEnabled: false, loginOtpHash: null, loginOtpExpiresAt: null, loginOtpAttempts: 0 },
      });
      void logAudit({ session, action: 'DISABLE_2FA', resource: 'account', request: req });
      return NextResponse.json({ enabled: false });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
