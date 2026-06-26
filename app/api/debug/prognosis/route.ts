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

async function hit(token: string, path: string) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
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

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId') ?? '2697';
  const cifno   = searchParams.get('cifno')   ?? groupId;

  const token = await getServiceToken();

  const [groupPremium, groupClaims, memberPremium, allPolicies] = await Promise.all([
    hit(token, `/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`),
    hit(token, `/api/CorporateProfile/GetGroupClaims?groupid=${groupId}`),
    hit(token, `/api/EnrolleeProfile/GetMemberPremium?cifno=${cifno}`),
    hit(token, `/api/CorporateProfile/GetAllPolicies`),
  ]);

  return NextResponse.json({
    groupId,
    cifno,
    results: { groupPremium, groupClaims, memberPremium, allPolicies },
  }, { status: 200 });
}
