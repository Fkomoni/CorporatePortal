// Shared logic for sending the "Welcome to the Corporate Portal" registration
// email to an HR contact. Used by the admin manual trigger and the sync cron.
import { prisma } from '@/lib/prisma';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Username: process.env.PROGNOSIS_USERNAME, Password: process.env.PROGNOSIS_PASSWORD }),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch {
    throw new Error(`ApiUsers/Login returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token in ApiUsers/Login response');
  cachedToken = token;
  tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
  return token;
}

export interface WelcomeParams {
  policyNumber: string;
  groupId: string;
  companyName: string;
  email: string;
  contactName?: string;
  mobile?: string;
}

export interface WelcomeResult {
  success: boolean;
  emailSent: boolean;
  registrationLink?: string;
  error?: string;
}

export async function sendCorporateWelcome(p: WelcomeParams): Promise<WelcomeResult> {
  try {
    let token = await getServiceToken();

    const [firstname, ...rest] = (p.contactName ?? '').trim().split(/\s+/);
    const surname = rest.join(' ');

    const requestPayload = {
      enrolleeID: '',
      PolicyNumber: p.policyNumber,
      email: p.email,
      mobile: p.mobile ?? '',
      firstname: firstname ?? '',
      surname,
      dob: '',
      ErrorMessage: '',
    };

    const callApi = async (t: string) =>
      fetch(`${BASE}/api/CorporateProfile/ClientUserRegistration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(requestPayload),
      });

    let res = await callApi(token);
    if (res.status === 401 || res.status === 403) {
      cachedToken = null; tokenExpiry = 0;
      token = await getServiceToken();
      res = await callApi(token);
    }

    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let d: any;
    try { d = JSON.parse(text); } catch {
      return { success: false, emailSent: false, error: `ClientUserRegistration non-JSON (${res.status})` };
    }
    if (!res.ok) {
      return { success: false, emailSent: false, error: String(d?.message ?? d?.Message ?? d?.ErrorMessage ?? `Prognosis error ${res.status}`) };
    }

    const otp =
      d?.otp ?? d?.OTP ?? d?.verificationCode ?? d?.VerificationCode ??
      d?.token ?? d?.Token ?? d?.code ?? d?.Code ??
      d?.data?.otp ?? d?.data?.verificationCode ?? d?.data?.code ?? null;

    const appBase = (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://corporateportal.onrender.com').replace(/\/$/, '');
    const registrationLink = otp
      ? `${appBase}/verify-registration?email=${encodeURIComponent(p.email)}&code=${encodeURIComponent(String(otp))}&groupId=${encodeURIComponent(p.groupId)}&company=${encodeURIComponent(p.companyName)}&name=${encodeURIComponent((p.contactName ?? '').trim())}`
      : `${appBase}/verify-registration?email=${encodeURIComponent(p.email)}`;

    // Pre-register HR user (inactive until they complete verify-registration)
    try {
      await prisma.user.upsert({
        where: { email: p.email },
        update: {
          companyId: p.groupId || undefined,
          companyName: p.companyName || undefined,
          policyNumber: p.policyNumber || undefined,
          name: p.contactName || p.email,
        },
        create: {
          email: p.email,
          password: '',
          name: p.contactName || p.email,
          role: 'hr_admin',
          companyId: p.groupId || null,
          companyName: p.companyName || null,
          policyNumber: p.policyNumber || null,
          active: false,
        },
      });
    } catch (dbErr) {
      console.error('[corporate-welcome] DB pre-registration failed (non-fatal):', dbErr);
    }

    if (!otp) return { success: true, emailSent: false, registrationLink, error: 'No OTP returned — email not sent' };

    const emailBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#131C4E;padding:24px 32px;border-radius:12px 12px 0 0;">
    <p style="font-size:22px;font-weight:900;color:#fff;margin:0;letter-spacing:-0.02em">LEADWAY <span style="color:#F56B22;">HEALTH</span></p>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:2px 0 0;letter-spacing:0.1em">CORPORATE PORTAL</p>
  </div>
  <div style="background:#fff;padding:36px 32px;border:1px solid #E5E7F1;border-top:none;">
    <p style="font-size:20px;font-weight:700;color:#131C4E;margin:0 0 8px">Welcome to the Corporate Portal</p>
    <p style="font-size:14px;color:#6B7280;line-height:1.6;margin:0 0 28px">
      An HR admin account has been set up for <strong>${p.companyName}</strong> on the
      Leadway Health HMO Corporate Portal. Click the button below to create your
      password and access the portal.
    </p>
    <a href="${registrationLink}" style="display:inline-block;background:#F56B22;color:#fff;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;">
      Complete Registration
    </a>
    <p style="font-size:12px;color:#9CA3B8;margin:28px 0 0;line-height:1.7">
      Or copy and paste this link:<br/>
      <a href="${registrationLink}" style="color:#F56B22;word-break:break-all;">${registrationLink}</a>
    </p>
    <hr style="border:none;border-top:1px solid #F0F1F5;margin:28px 0"/>
    <p style="font-size:11px;color:#B0B7C9;margin:0">If you did not expect this email, you can safely ignore it.</p>
  </div>
  <div style="background:#FAFBFC;padding:16px 32px;border:1px solid #E5E7F1;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
    <p style="font-size:11px;color:#B0B7C9;margin:0">© 2026 Leadway Health HMO. All rights reserved.</p>
  </div>
</div>`.trim();

    let emailSent = false;
    let emailError: string | undefined;
    try {
      const emailRes = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          EmailAddress: p.email,
          CC: '',
          BCC: '',
          Subject: 'Welcome to the Leadway Health Corporate Portal',
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
      emailSent = emailRes.ok;
      if (!emailRes.ok) emailError = `SendEmailAlert HTTP ${emailRes.status}`;
    } catch (e) {
      emailError = e instanceof Error ? e.message : 'Email send failed';
    }

    return { success: true, emailSent, registrationLink, error: emailError };
  } catch (err) {
    return { success: false, emailSent: false, error: err instanceof Error ? err.message : 'Failed to send welcome' };
  }
}
