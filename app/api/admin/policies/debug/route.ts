import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

async function getServiceToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Username: process.env.PROGNOSIS_USERNAME,
      Password: process.env.PROGNOSIS_PASSWORD,
    }),
  });
  const data = await res.json() as Record<string, unknown>;
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token from ApiUsers/Login');
  return token;
}

export async function GET() {
  const session = await auth();
  if (!session || (session.user as { loginType?: string })?.loginType !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = await getServiceToken();
    const res   = await fetch(`${BASE}/api/CorporateProfile/GetAllPolicies`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch {
      return NextResponse.json({ error: 'non-JSON from Prognosis', raw: text.slice(0, 500) });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: Record<string, any>[] =
      Array.isArray(data)              ? data              :
      Array.isArray((data as any)?.data)   ? (data as any).data   :
      Array.isArray((data as any)?.Data)   ? (data as any).Data   :
      Array.isArray((data as any)?.result) ? (data as any).result :
      Array.isArray((data as any)?.Result) ? (data as any).Result :
      [];

    const first3 = raw.slice(0, 3);
    return NextResponse.json({
      totalRows: raw.length,
      envelopeKeys: Object.keys(data as object),
      firstRecordKeys: raw.length > 0 ? Object.keys(raw[0]) : [],
      first3Records: first3,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
