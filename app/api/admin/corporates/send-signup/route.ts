import { auth } from '@/auth';
import { NextResponse } from 'next/server';

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

  const { PolicyNumber, email, mobile, firstname, surname } = body;

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

    // Always return full debug info so it's visible in the browser network tab
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

    return NextResponse.json({ success: true, otp, debug });
  } catch (err) {
    console.error('[send-signup] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send signup email' },
      { status: 500 }
    );
  }
}
