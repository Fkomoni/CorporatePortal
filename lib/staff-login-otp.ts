// 2FA for internal Leadway staff logins — same mechanism as HR (sha256-hashed
// 6-digit email code, 10 min TTL, 5 attempts), targeting StaffUser instead of
// User since staff accounts have no fixed company/password.
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getServiceToken } from '@/lib/corporate-welcome';
import { emailFooter } from '@/lib/email-footer';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function issueStaffLoginOtp(staffUser: { id: string; email: string; name: string }): Promise<boolean> {
  const code = crypto.randomInt(100000, 1000000).toString();

  await prisma.staffUser.update({
    where: { id: staffUser.id },
    data: { loginOtpHash: hashOtp(code), loginOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS), loginOtpAttempts: 0 },
  });

  const emailBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#131C4E;padding:24px 32px;border-radius:12px 12px 0 0;">
    <p style="font-size:22px;font-weight:900;color:#fff;margin:0;letter-spacing:-0.02em">LEADWAY <span style="color:#F56B22;">HEALTH</span></p>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:2px 0 0;letter-spacing:0.1em">CORPORATE PORTAL — STAFF SIGN-IN</p>
  </div>
  <div style="background:#fff;padding:36px 32px;border:1px solid #E5E7F1;border-top:none;">
    <p style="font-size:20px;font-weight:700;color:#131C4E;margin:0 0 8px">Your Sign-In Verification Code</p>
    <p style="font-size:14px;color:#6B7280;line-height:1.6;margin:0 0 24px">Use this code to complete your staff sign-in to the Corporate Portal. It expires in 10 minutes.</p>
    <p style="font-size:34px;font-weight:900;letter-spacing:0.25em;color:#131C4E;background:#F7F8FC;border:1px dashed #C7CBE0;border-radius:12px;padding:18px 24px;text-align:center;margin:0 0 24px">${code}</p>
    <p style="font-size:12px;color:#9CA3B8;margin:0;line-height:1.7">
      If you didn't try to sign in, contact IT immediately — your Leadway AD password may be compromised.
      Never share this code; Leadway Health will never ask you for it.
    </p>
  </div>
${emailFooter()}
</div>`.trim();

  try {
    const token = await getServiceToken();
    const res = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        EmailAddress: staffUser.email,
        CC: '', BCC: '',
        Subject: 'Your Sign-In Verification Code – Leadway Health Corporate Portal',
        MessageBody: emailBody,
        Attachments: null, Category: '', UserId: 0, ProviderId: 0, ServiceId: 0, Reference: '', TransactionType: '',
      }),
    });
    const text = await res.text();
    console.log(`[staff-login-otp] OTP email to ${staffUser.email} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    if (!res.ok) return false;
    let d: Record<string, unknown> | null = null;
    try { d = JSON.parse(text); } catch { /* non-JSON success body — fine */ }
    const status = String(d?.status ?? d?.Status ?? '').toLowerCase();
    if (status && !['success', 'true', '200', 'ok'].includes(status)) return false;
    if (d?.ErrorMessage || d?.errorMessage || d?.error || d?.Error) return false;
    return true;
  } catch (e) {
    console.error('[staff-login-otp] email send failed:', e);
    return false;
  }
}

export type StaffOtpCheck = 'ok' | 'invalid' | 'expired' | 'locked';

export async function verifyStaffLoginOtp(staffUserId: string, code: string): Promise<StaffOtpCheck> {
  const staffUser = await prisma.staffUser.findUnique({ where: { id: staffUserId } });
  if (!staffUser?.loginOtpHash || !staffUser.loginOtpExpiresAt) return 'invalid';

  if (staffUser.loginOtpAttempts >= MAX_ATTEMPTS) return 'locked';
  if (staffUser.loginOtpExpiresAt < new Date()) return 'expired';

  if (hashOtp(code) !== staffUser.loginOtpHash) {
    const attempts = staffUser.loginOtpAttempts + 1;
    await prisma.staffUser.update({
      where: { id: staffUserId },
      data: attempts >= MAX_ATTEMPTS
        ? { loginOtpAttempts: attempts, loginOtpHash: null, loginOtpExpiresAt: null }
        : { loginOtpAttempts: attempts },
    });
    return attempts >= MAX_ATTEMPTS ? 'locked' : 'invalid';
  }

  await prisma.staffUser.update({
    where: { id: staffUserId },
    data: { loginOtpHash: null, loginOtpExpiresAt: null, loginOtpAttempts: 0 },
  });
  return 'ok';
}
