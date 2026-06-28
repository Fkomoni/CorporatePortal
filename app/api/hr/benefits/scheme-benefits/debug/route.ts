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

async function probe(token: string, url: string) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const arr: unknown[] = Array.isArray(raw) ? (raw as unknown[])
      : Array.isArray((raw as Record<string,unknown>)?.data)   ? (raw as Record<string,unknown>).data   as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.Data)   ? (raw as Record<string,unknown>).Data   as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.result) ? (raw as Record<string,unknown>).result as unknown[]
      : [];
    return { url, status: res.status, rows: arr.length, raw };
  } catch (e) {
    return { url, status: 0, rows: 0, raw: String(e) };
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const schemeId   = searchParams.get('schemeId')  ?? '141378';
  const schemeCode = searchParams.get('schemeCode') ?? 'GEHEALTHCARE';
  const groupId    = session.user.companyId ?? '';

  try {
    const token = await getServiceToken();

    const candidates = [
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeId=${schemeId}&languageId=1`,
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeId=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?PlanID=${schemeId}&languageId=1`,
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?PlanID=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?planId=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemecode=${schemeCode}`,
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeCode=${schemeCode}`,
      `${BASE}/api/CorporatePortal/GetPlanBenefits?schemeId=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetPlanBenefits?PlanID=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetBenefits?schemeId=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetBenefits?groupId=${groupId}&schemeId=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetGroupBenefits?groupId=${groupId}`,
      `${BASE}/api/CorporatePortal/GetGroupBenefits?groupId=${groupId}&schemeId=${schemeId}`,
    ];

    const results = await Promise.all(candidates.map((url) => probe(token, url)));

    const withData  = results.filter((r) => r.rows > 0);
    const working   = results.filter((r) => r.status !== 500 && r.status !== 0 && r.status !== 404);

    return NextResponse.json({ schemeId, schemeCode, groupId, withData, working, all: results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
