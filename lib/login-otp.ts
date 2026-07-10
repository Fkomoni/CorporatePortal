// Login/setup OTP issuance for HR 2FA (verification lives in
// lib/login-otp-verify.ts so Edge middleware never imports this file).
// Codes are 6 digits, sha256-hashed at rest, valid 10 minutes, max 5 attempts.
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getServiceToken } from '@/lib/corporate-welcome';
import { emailFooter } from '@/lib/email-footer';
import { hashOtp } from '@/lib/login-otp-verify';

export { verifyLoginOtp, type OtpCheck } from '@/lib/login-otp-verify';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

const OTP_TTL_MS = 10 * 60 * 1000;

export async function issueLoginOtp(
  user: { id: string; email: string; name?: string | null; mobile?: string | null },
  method: 'email' | 'sms' = 'email',
): Promise<boolean> {
  const code = crypto.randomInt(100000, 1000000).toString();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginOtpHash: hashOtp(code),
      loginOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      loginOtpAttempts: 0,
    },
  });

  if (method === 'sms') {
    if (!user.mobile) return false;
    try {
      const token = await getServiceToken();
      const res = await fetch(`${BASE}/api/Sms/SendSms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          To: user.mobile,
          Message: `Leadway Health Corporate Portal: your login verification code is ${code}. It expires in 10 minutes. Never share this code.`,
          Source: 'Corporate Portal',
          SourceId: 1,
          TemplateId: 5,
          PolicyNumber: '',
          ReferenceNo: '',
          UserId: 0,
        }),
      });
      console.log(`[login-otp] OTP SMS to ${user.mobile} → HTTP ${res.status}`);
      return res.ok;
    } catch (e) {
      console.error('[login-otp] SMS send failed:', e);
      return false;
    }
  }

  const emailBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#131C4E;padding:24px 32px;border-radius:12px 12px 0 0;">
    <p style="font-size:22px;font-weight:900;color:#fff;margin:0;letter-spacing:-0.02em">LEADWAY <span style="color:#F56B22;">HEALTH</span></p>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:2px 0 0;letter-spacing:0.1em">CORPORATE PORTAL</p>
  </div>
  <div style="background:#fff;padding:36px 32px;border:1px solid #E5E7F1;border-top:none;">
    <p style="font-size:20px;font-weight:700;color:#131C4E;margin:0 0 8px">Your Login Verification Code</p>
    <p style="font-size:14px;color:#6B7280;line-height:1.6;margin:0 0 24px">
      Use this code to complete your sign-in to the Corporate Portal. It expires in 10 minutes.
    </p>
    <p style="font-size:34px;font-weight:900;letter-spacing:0.25em;color:#131C4E;background:#F7F8FC;border:1px dashed #C7CBE0;border-radius:12px;padding:18px 24px;text-align:center;margin:0 0 24px">${code}</p>
    <p style="font-size:12px;color:#9CA3B8;margin:0;line-height:1.7">
      If you didn't try to sign in, someone may have your password — change it immediately.
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
        EmailAddress: user.email,
        CC: '',
        BCC: '',
        Subject: 'Your Login Verification Code – Leadway Health Corporate Portal',
        MessageBody: emailBody,
        Attachments: null,
        Category: '',
        UserId: 0,
        ProviderId: 0,
        ServiceId: 0,
        Reference: '',
        TransactionType: '',
      }),
    });
    console.log(`[login-otp] OTP email to ${user.email} → HTTP ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error('[login-otp] email send failed:', e);
    return false;
  }
}
