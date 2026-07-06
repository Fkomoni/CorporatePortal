import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Username: process.env.PROGNOSIS_USERNAME,
      Password: process.env.PROGNOSIS_PASSWORD,
    }),
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

export async function POST(req: Request) {
  const session = await auth();
  if (!session || (session.user as { loginType?: string })?.loginType !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // groupId = Prognosis GROUP_ID; PolicyNumber = GROUP_CODE/scheme code; companyName = GROUP_NAME
  const { PolicyNumber, groupId, companyName, email, mobile, firstname, surname } = body;

  if (!PolicyNumber || !email) {
    return NextResponse.json({ error: 'PolicyNumber and email are required' }, { status: 400 });
  }

  try {
    let token = await getServiceToken();

    const requestPayload = {
      enrolleeID: '',
      PolicyNumber,
      email,
      mobile: mobile ?? '',
      firstname: firstname ?? '',
      surname: surname ?? '',
      dob: '',
      ErrorMessage: '',
    };

    console.log('[send-signup] ── REQUEST ──────────────────────────────────');
    console.log('[send-signup] URL    :', `${BASE}/api/CorporateProfile/ClientUserRegistration`);
    console.log('[send-signup] Payload:', JSON.stringify(requestPayload, null, 2));

    const callApi = async (t: string) =>
      fetch(`${BASE}/api/CorporateProfile/ClientUserRegistration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(requestPayload),
      });

    let res = await callApi(token);

    // Refresh token once on 401/403
    if (res.status === 401 || res.status === 403) {
      console.log('[send-signup] token rejected, refreshing...');
      cachedToken = null; tokenExpiry = 0;
      token = await getServiceToken();
      res = await callApi(token);
    }

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch {
      console.log('[send-signup] ── RESPONSE (non-JSON) ──────────────────');
      console.log('[send-signup] HTTP   :', res.status);
      console.log('[send-signup] Raw    :', text);
      return NextResponse.json({
        error: 'Prognosis returned non-JSON',
        debug: { httpStatus: res.status, requestPayload, rawResponse: text },
      }, { status: 502 });
    }

    console.log('[send-signup] ── RESPONSE ─────────────────────────────────');
    console.log('[send-signup] HTTP   :', res.status);
    console.log('[send-signup] Body   :', JSON.stringify(data, null, 2));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const debug = { httpStatus: res.status, requestPayload, prognosisResponse: data };

    if (!res.ok) {
      return NextResponse.json(
        { error: d?.message ?? d?.Message ?? d?.ErrorMessage ?? `Prognosis error ${res.status}`, debug },
        { status: res.status }
      );
    }

    const otp =
      d?.otp ?? d?.OTP ?? d?.verificationCode ?? d?.VerificationCode ??
      d?.token ?? d?.Token ?? d?.code ?? d?.Code ??
      d?.data?.otp ?? d?.data?.verificationCode ?? d?.data?.code ?? null;

    // Build registration link with scheme identifiers — the OTP is deliberately
    // NOT embedded so the link alone can't complete registration (true 2FA:
    // the code must be typed from the separate OTP message).
    const appBase = (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://corporateportal.onrender.com').replace(/\/$/, '');
    const registrationLink = `${appBase}/verify-registration?email=${encodeURIComponent(email)}&groupId=${encodeURIComponent(groupId ?? '')}&company=${encodeURIComponent(companyName ?? '')}&name=${encodeURIComponent(`${firstname ?? ''} ${surname ?? ''}`.trim())}`;

    // Pre-register HR user in our DB so scheme/policy details are available at verify time.
    // active=false until they complete verify-registration.
    if (groupId || companyName || PolicyNumber) {
      try {
        const fullName = [firstname, surname].filter(Boolean).join(' ') || email;
        await prisma.user.upsert({
          where: { email },
          update: {
            companyId: groupId ? String(groupId) : undefined,
            companyName: companyName || undefined,
            policyNumber: PolicyNumber || undefined,
            name: fullName,
          },
          create: {
            email,
            password: '',
            name: fullName,
            role: 'hr_admin',
            companyId: groupId ? String(groupId) : null,
            companyName: companyName || null,
            policyNumber: PolicyNumber || null,
            active: false,
          },
        });
        console.log(`[send-signup] Pre-registered HR user: ${email} (groupId: ${groupId}, policyNumber: ${PolicyNumber})`);
      } catch (dbErr) {
        console.error('[send-signup] DB pre-registration failed (non-fatal):', dbErr);
      }
    }

    // Send registration email via Prognosis SendEmailAlert
    let emailSent = false;
    let emailError: string | null = null;
    let emailResponse: unknown = null;

    if (otp) {
      const emailBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#131C4E;padding:24px 32px;border-radius:12px 12px 0 0;">
    <p style="font-size:22px;font-weight:900;color:#fff;margin:0;letter-spacing:-0.02em">LEADWAY <span style="color:#F56B22;">HEALTH</span></p>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:2px 0 0;letter-spacing:0.1em">CORPORATE PORTAL</p>
  </div>
  <div style="background:#fff;padding:36px 32px;border:1px solid #E5E7F1;border-top:none;">
    <p style="font-size:20px;font-weight:700;color:#131C4E;margin:0 0 8px">Complete Your Account Registration</p>
    <p style="font-size:14px;color:#6B7280;line-height:1.6;margin:0 0 28px">
      Your account has been set up on the Leadway Health HMO Corporate Portal.
      Click the button below to create your password and access the portal.
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
    <p style="font-size:11px;color:#B0B7C9;margin:0">© 2025 Leadway Health HMO. All rights reserved.</p>
  </div>
</div>`.trim();

      try {
        const emailRes = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            EmailAddress: email,
            CC: '',
            BCC: '',
            Subject: 'Complete Your Registration – Leadway Health Corporate Portal',
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
        emailResponse = await emailRes.json().catch(() => null);
        emailSent = emailRes.ok;
        console.log('[send-signup] SendEmailAlert →', emailRes.status, JSON.stringify(emailResponse));
      } catch (e) {
        emailError = e instanceof Error ? e.message : 'Email send failed';
        console.error('[send-signup] SendEmailAlert error:', emailError);
      }
    }

    void logAudit({ session, action: 'SEND_SIGNUP_EMAIL', resource: 'corporates', request: req,
      details: { PolicyNumber: body.PolicyNumber, email: body.email, emailSent } });

    // Never return the raw OTP (or the Prognosis response containing it) to the
    // browser — the OTP must only reach the HR contact via their own channel.
    return NextResponse.json({ success: true, registrationLink, emailSent, emailError });
  } catch (err) {
    console.error('[send-signup] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send signup email' },
      { status: 500 }
    );
  }
}
