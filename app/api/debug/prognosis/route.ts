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
  const data = await res.json();
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

async function hit(token: string, path: string, method: 'GET' | 'POST' = 'GET') {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'POST' ? { body: '{}' } : {}),
    });
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text; }
    return { url, status: res.status, body };
  } catch (err) {
    return { url, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // groupId comes from the session (HR user's companyId) — never hardcoded.
  // Staff/admin can override via ?groupId= for debugging only.
  const { searchParams } = new URL(req.url);
  const sessionGroupId = session.user.companyId;
  const groupId = searchParams.get('groupId') ?? sessionGroupId;

  if (!groupId) {
    return NextResponse.json({ error: 'No group ID: account has no companyId and no ?groupId param provided' }, { status: 400 });
  }

  const cifno      = searchParams.get('cifno') ?? groupId;
  const enrolleeId = searchParams.get('enrolleeId');
  const path       = searchParams.get('path');
  const method     = (searchParams.get('method') ?? 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';

  const token = await getServiceToken();

  // If ?path= supplied, hit that raw Prognosis path directly (must start with /api/)
  if (path) {
    if (!path.startsWith('/api/')) {
      return NextResponse.json({ error: 'path must start with /api/' }, { status: 400 });
    }
    const result = await hit(token, path, method);
    return NextResponse.json({ path, method, ...result }, { status: 200 });
  }

  // If ?enrolleeId= supplied, just return enrollee bio data
  if (enrolleeId) {
    const result = await hit(token, `/api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID?enrolleeid=${encodeURIComponent(enrolleeId)}`);
    return NextResponse.json({ enrolleeId, ...result }, { status: 200 });
  }

  const [groupPremium, groupClaims, memberPremium, allPolicies] = await Promise.all([
    hit(token, `/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`),
    hit(token, `/api/EnrolleeClaims/ClaimsHeaderEnquiry?groupid=${groupId}&fromdate=${new Date().getFullYear()}-01-01&todate=${new Date().getFullYear()}-12-31`),
    hit(token, `/api/EnrolleeProfile/GetMemberPremium?cifno=${cifno}`),
    hit(token, `/api/CorporateProfile/GetAllPolicies`),
  ]);

  return NextResponse.json({
    groupId,
    cifno,
    sessionCompanyId: sessionGroupId,
    policyNumber: session.user.policyNumber,
    results: { groupPremium, groupClaims, memberPremium, allPolicies },
  }, { status: 200 });
}
