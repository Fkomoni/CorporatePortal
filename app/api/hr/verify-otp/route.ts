import { NextResponse } from 'next/server';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

// TODO: Replace 'CorporateProfile/VerifyOTP' with the actual Prognosis endpoint name
// once confirmed from Swagger (e.g. ClientApp_VerifyOTP, ValidateOTP, etc.)
const OTP_ENDPOINT = process.env.PROGNOSIS_OTP_ENDPOINT ?? 'CorporateProfile/VerifyOTP';

export async function POST(req: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, otp } = body;

  if (!otp) {
    return NextResponse.json({ error: 'OTP is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/api/${OTP_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch {
      return NextResponse.json({ error: 'Prognosis returned non-JSON', raw: text.slice(0, 300) }, { status: 502 });
    }

    console.log(`[verify-otp] ${OTP_ENDPOINT} → HTTP ${res.status}`, JSON.stringify(data).slice(0, 300));

    if (!res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return NextResponse.json(
        { error: d?.message ?? d?.Message ?? d?.ErrorMessage ?? `Prognosis error ${res.status}` },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[verify-otp] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'OTP verification failed' },
      { status: 500 }
    );
  }
}
