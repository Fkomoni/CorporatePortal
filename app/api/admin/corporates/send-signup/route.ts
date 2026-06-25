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

    const callApi = async (t: string) =>
      fetch(`${BASE}/api/CorporateProfile/ClientUserRegistration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          enrolleeID: '',
          PolicyNumber,
          email,
          mobile: mobile ?? '',
          firstname: firstname ?? '',
          surname: surname ?? '',
          dob: '',
          ErrorMessage: '',
        }),
      });

    let res = await callApi(token);

    // Refresh token once on 401/403
    if (res.status === 401 || res.status === 403) {
      cachedToken = null; tokenExpiry = 0;
      token = await getServiceToken();
      res = await callApi(token);
    }

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch {
      return NextResponse.json({ error: 'Prognosis returned non-JSON', raw: text.slice(0, 300) }, { status: 502 });
    }

    console.log(`[send-signup] ClientUserRegistration → HTTP ${res.status}`, JSON.stringify(data).slice(0, 300));

    if (!res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return NextResponse.json(
        { error: d?.message ?? d?.Message ?? d?.ErrorMessage ?? `Prognosis error ${res.status}` },
        { status: res.status }
      );
    }

    // Extract OTP/token if Prognosis returns one — surface it so callers can
    // build a deep-link to /verify-registration?code=OTP&email=EMAIL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const otp =
      d?.otp ?? d?.OTP ?? d?.verificationCode ?? d?.VerificationCode ??
      d?.token ?? d?.Token ?? d?.code ?? d?.Code ??
      d?.data?.otp ?? d?.data?.verificationCode ?? d?.data?.code ?? null;

    return NextResponse.json({ success: true, otp, data });
  } catch (err) {
    console.error('[send-signup] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send signup email' },
      { status: 500 }
    );
  }
}
