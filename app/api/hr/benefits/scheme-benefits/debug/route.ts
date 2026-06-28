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

async function probeScheme(token: string, schemeId: string) {
  const url = `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeId=${schemeId}&languageId=1`;
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

    // Extract unique SERVICE values from the array
    const services = arr.length > 0
      ? [...new Set(arr.map((r) => String((r as Record<string,unknown>)?.SERVICE ?? '').trim()).filter(Boolean))]
      : [];

    const firstMemberType = arr.length > 0
      ? String((arr[0] as Record<string,unknown>)?.membertype ?? '')
      : '';

    return { schemeId, status: res.status, rows: arr.length, services, firstMemberType, topLevelKeys: raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.keys(raw as object).slice(0, 6) : [] };
  } catch (e) {
    return { schemeId, status: 0, rows: 0, services: [], firstMemberType: '', topLevelKeys: [], error: String(e) };
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  // Multi-ID mode: ?ids=169614,169615,169616,...
  const idsParam = searchParams.get('ids');
  if (idsParam) {
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30);
    try {
      const token = await getServiceToken();
      const results = await Promise.all(ids.map((id) => probeScheme(token, id)));
      const withData = results.filter((r) => r.rows > 0);
      return NextResponse.json({ withData, all: results });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
  }

  // Single-ID mode: ?schemeId=xxx (original behaviour, probes many URL variants)
  const schemeId   = searchParams.get('schemeId')  ?? '141378';
  const schemeCode = searchParams.get('schemeCode') ?? 'GEHEALTHCARE';
  const groupId    = session.user.companyId ?? '';

  async function probeUrl(token: string, url: string) {
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

  try {
    const token = await getServiceToken();

    const candidates = [
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeId=${schemeId}&languageId=1`,
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeId=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeId=${schemeId}&groupId=${groupId}`,
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeId=${schemeId}&groupId=${groupId}&languageId=1`,
      `${BASE}/api/CorporatePortal/GetPolicyBenefits?schemeId=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetPolicyBenefits?schemeId=${schemeId}&groupId=${groupId}`,
      `${BASE}/api/CorporatePortal/GetSchemeDetails?schemeId=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetPlanDetails?PlanID=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetBenefitsByPlan?PlanID=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetBenefitsByScheme?schemeId=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetMemberBenefits?groupId=${groupId}`,
      `${BASE}/api/CorporatePortal/GetGroupPolicyBenefits?groupId=${groupId}`,
      `${BASE}/api/CorporatePortal/GetGroupPolicyBenefits?groupId=${groupId}&schemeId=${schemeId}`,
      `${BASE}/api/CorporatePortal/GetCompanyBenefits?groupId=${groupId}`,
      `${BASE}/api/CorporatePortal/GetBenefitLimit?groupId=${groupId}`,
      `${BASE}/api/CorporatePortal/GetBenefitLimit?schemeId=${schemeId}`,
    ];

    const results = await Promise.all(candidates.map((url) => probeUrl(token, url)));
    const withData = results.filter((r) => r.rows > 0);
    const working  = results.filter((r) => r.status !== 500 && r.status !== 0 && r.status !== 404);

    return NextResponse.json({ schemeId, schemeCode, groupId, withData, working, all: results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
