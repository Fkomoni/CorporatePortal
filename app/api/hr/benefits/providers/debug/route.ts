import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? process.env.PROGNOSIS_API_BASE ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

async function probe(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep as string */ }
    return { status: res.status, ok: res.ok, body, bodyPreview: text.slice(0, 400) };
  } catch (e) {
    return { status: 0, ok: false, body: null, error: String(e) };
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const schemeId = new URL(req.url).searchParams.get('schemeId') ?? '';

  // Step 1: auth
  const authResult = await probe(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Username: process.env.PROGNOSIS_USERNAME, Password: process.env.PROGNOSIS_PASSWORD }),
  });

  // Extract token
  const payload = (
    (authResult.body as Record<string,unknown>)?.data ??
    (authResult.body as Record<string,unknown>)?.Data ??
    (authResult.body as Record<string,unknown>)?.result ??
    (authResult.body as Record<string,unknown>)?.Result ??
    authResult.body
  ) as Record<string, unknown>;
  const token = String(
    payload?.token ?? payload?.Token ?? payload?.access_token ??
    payload?.accessToken ?? payload?.AccessToken ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );

  const authSummary = {
    status: authResult.status,
    ok: authResult.ok,
    tokenFound: !!token,
    tokenPreview: token ? `${token.slice(0, 12)}…` : null,
    bodyPreview: authResult.bodyPreview,
  };

  if (!token) {
    return NextResponse.json({ authSummary, error: 'Auth failed — no token extracted', base: BASE });
  }

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // Step 2: probe each provider endpoint
  const baseParams = schemeId
    ? `SchemeID=${encodeURIComponent(schemeId)}&MinimumID=0&NoOfRecords=10&pageSize=10`
    : 'SchemeID=MISSING&MinimumID=0&NoOfRecords=10&pageSize=10';

  const [hospitals, eyeClinics, dental, spaGym] = await Promise.all([
    probe(`${BASE}/api/Provider/GetProvidersByPlanCode?${baseParams}`, { headers }),
    probe(`${BASE}/api/Provider/GetEyeClinicByPlanCode?${baseParams}`, { headers }),
    probe(`${BASE}/api/Provider/GetDentalClinicByPlanCode?${baseParams}`, { headers }),
    probe(`${BASE}/api/ListValues/GetSpaAndGymClinicByPlanCode?schemeid=${encodeURIComponent(schemeId)}&MinimumID=1&NoOfRecords=10&pageSize=10`, { headers }),
  ]);

  return NextResponse.json({
    base: BASE,
    schemeId,
    authSummary,
    endpoints: {
      hospitals:  { url: `/api/Provider/GetProvidersByPlanCode?SchemeID=${schemeId}`, status: hospitals.status, bodyPreview: hospitals.bodyPreview },
      eyeClinics: { url: `/api/Provider/GetEyeClinicByPlanCode?SchemeID=${schemeId}`, status: eyeClinics.status, bodyPreview: eyeClinics.bodyPreview },
      dental:     { url: `/api/Provider/GetDentalClinicByPlanCode?SchemeID=${schemeId}`, status: dental.status, bodyPreview: dental.bodyPreview },
      spaGym:     { url: `/api/ListValues/GetSpaAndGymClinicByPlanCode?schemeid=${schemeId}`, status: spaGym.status, bodyPreview: spaGym.bodyPreview },
    },
  });
}
