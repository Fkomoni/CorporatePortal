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
    body: JSON.stringify({ Username: process.env.PROGNOSIS_USERNAME, Password: process.env.PROGNOSIS_PASSWORD }),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Service login non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token from ApiUsers/Login');
  cachedToken = token;
  tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
  return token;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID in session' }, { status: 400 });

  try {
    const token = await getServiceToken();

    const schemesUrl = `${BASE}/api/CorporatePortal/GetPolicySchemes?groupId=${groupId}`;
    const schemesRes = await fetch(schemesUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const schemesText = await schemesRes.text();
    let schemesRaw: unknown;
    try { schemesRaw = JSON.parse(schemesText); } catch { schemesRaw = schemesText; }

    const topLevelKeys = schemesRaw && typeof schemesRaw === 'object' && !Array.isArray(schemesRaw)
      ? Object.keys(schemesRaw as object)
      : [];

    const arr: unknown[] = Array.isArray(schemesRaw) ? schemesRaw
      : Array.isArray((schemesRaw as Record<string,unknown>)?.data) ? (schemesRaw as Record<string,unknown>).data as unknown[]
      : Array.isArray((schemesRaw as Record<string,unknown>)?.Data) ? (schemesRaw as Record<string,unknown>).Data as unknown[]
      : Array.isArray((schemesRaw as Record<string,unknown>)?.result) ? (schemesRaw as Record<string,unknown>).result as unknown[]
      : [];

    const allKeys = new Set<string>();
    arr.forEach((r) => { if (r && typeof r === 'object') Object.keys(r as object).forEach((k) => allKeys.add(k)); });

    return NextResponse.json({
      debug: true,
      groupId,
      schemesEndpoint: schemesUrl,
      httpStatus: schemesRes.status,
      isArray: Array.isArray(schemesRaw),
      topLevelKeys,
      detectedArrayLength: arr.length,
      allFieldNamesInRows: [...allKeys],
      rawResponse: schemesRaw,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
