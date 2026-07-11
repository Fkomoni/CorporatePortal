// Sends the registration OTP on explicit user action (reaching the OTP step
// of /verify-registration), rather than automatically alongside the welcome
// email. This keeps the OTP's expiry window aligned with when the user is
// actually ready to enter it.
import { NextResponse } from 'next/server';
import { getServiceToken, sendOtpDelivery } from '@/lib/corporate-welcome';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export async function POST(req: Request) {
  let body: { email?: string; policyNumber?: string; companyName?: string; name?: string; mobile?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  const companyName = (body.companyName ?? '').trim();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const [firstname, ...rest] = (body.name ?? '').trim().split(/\s+/);
  const surname = rest.join(' ');

  try {
    const token = await getServiceToken();

    const res = await fetch(`${BASE}/api/CorporateProfile/ClientUserRegistration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enrolleeID: '',
        PolicyNumber: body.policyNumber ?? '',
        email,
        mobile: body.mobile ?? '',
        firstname: firstname ?? '',
        surname,
        dob: '',
        ErrorMessage: '',
      }),
    });

    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let d: any;
    try { d = JSON.parse(text); } catch {
      return NextResponse.json({ error: `Prognosis returned non-JSON (${res.status})` }, { status: 502 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: String(d?.message ?? d?.Message ?? d?.ErrorMessage ?? `Prognosis error ${res.status}`) }, { status: 502 });
    }

    const otp =
      d?.otp ?? d?.OTP ?? d?.verificationCode ?? d?.VerificationCode ??
      d?.token ?? d?.Token ?? d?.code ?? d?.Code ??
      d?.data?.otp ?? d?.data?.verificationCode ?? d?.data?.code ?? null;

    if (!otp) {
      // Surface whatever message Prognosis actually sent instead of a generic
      // error, and log the full response — this call can legitimately fail
      // differently (e.g. "already registered") than a hard error, and the
      // previous blanket message gave no way to tell those apart.
      const prognosisMessage = d?.message ?? d?.Message ?? d?.ErrorMessage ?? d?.status ?? null;
      console.error(`[request-registration-otp] No OTP in ClientUserRegistration response for ${email}:`, JSON.stringify(d).slice(0, 500));
      return NextResponse.json({
        error: prognosisMessage
          ? `Prognosis did not return a code: ${prognosisMessage}`
          : 'No OTP returned from Prognosis',
      }, { status: 502 });
    }

    const { otpEmailSent } = await sendOtpDelivery(token, {
      email, mobile: body.mobile, otp: String(otp), companyName,
    });

    return NextResponse.json({ success: true, otpEmailSent });
  } catch (err) {
    console.error('[request-registration-otp] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send OTP' }, { status: 500 });
  }
}
