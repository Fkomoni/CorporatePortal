import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

// ── Service token cache (reuse for ~6 hours) ──────────────────────────────────
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

  console.log(`[api/policies] POST ${BASE}/api/ApiUsers/Login → HTTP ${res.status}`);

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`ApiUsers/Login returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  // Unwrap optional envelope
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;

  if (payload?.status === false || payload?.status === 'error' || payload?.status === 'fail') {
    throw new Error(String(payload.ErrorMessage ?? payload.message ?? 'Service login failed'));
  }

  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );

  if (!token) throw new Error('No token in ApiUsers/Login response');

  cachedToken = token;
  tokenExpiry  = Date.now() + 6 * 60 * 60 * 1000; // 6 hours
  console.log('[api/policies] service token obtained, cached for 6h');
  return token;
}

// ── Normalise one policy row ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePolicy(p: Record<string, any>) {
  const name    = String(p.GroupName ?? p.CompanyName ?? p.Name ?? p.name ?? 'Unknown');
  const groupId = String(p.GroupID ?? p.PolicyID ?? p.Id ?? p.id ?? '');

  const rawDate        = p.CommencementDate ?? p.StartDate ?? p.DateCreated ?? p.CreatedDate ?? p.InceptionDate ?? '';
  const dateProvisioned = rawDate ? String(rawDate).split('T')[0] : '';

  const adminEmail = String(p.Email ?? p.AdminEmail ?? p.ContactEmail ?? p.HREmail ?? p.EmailAddress ?? '');

  let status = 'Active';
  if (p.Active === false || p.IsActive === false) {
    status = 'Inactive';
  } else if (typeof p.Status === 'string') {
    const s = p.Status.toLowerCase();
    if (s === 'inactive' || s === 'terminated' || s === 'expired') status = 'Inactive';
    else if (s === 'pending' || s === 'awaiting') status = 'Pending';
    else status = p.Status;
  }

  const activeMembers = Number(
    p.ActiveLives ?? p.TotalActiveLives ?? p.ActiveMembers ??
    p.MemberCount  ?? p.TotalEnrolled   ?? p.NoOfLives    ?? 0
  );

  const schemeCode = String(p.PolicyNumber ?? p.SchemeCode ?? p.PolicyCode ?? groupId);

  return {
    id: groupId || name,
    groupId,
    name,
    schemeCode,
    dateProvisioned,
    adminEmail,
    status,
    activeMembers,
    template: 'Default template',
    colors: ['#F56B22', '#131C4E', '#3B82F6'],
  };
}

// ── Fetch policies with optional one-time token refresh on 401/403 ────────────
async function fetchPolicies(token: string, retry = false): Promise<Response> {
  const res = await fetch(`${BASE}/api/CorporateProfile/GetAllPolicies`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  console.log(`[api/policies] GET GetAllPolicies → HTTP ${res.status}`);

  if ((res.status === 401 || res.status === 403) && !retry) {
    console.log('[api/policies] token rejected, refreshing...');
    cachedToken = null;
    tokenExpiry  = 0;
    const fresh = await getServiceToken();
    return fetchPolicies(fresh, true);
  }
  return res;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const session = await auth();

  if (!session || (session.user as { loginType?: string })?.loginType !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = await getServiceToken();
    const res   = await fetchPolicies(token);

    if (!res.ok) {
      const body = await res.text();
      console.error(`[api/policies] GetAllPolicies error ${res.status}:`, body.slice(0, 300));
      return NextResponse.json({ error: `Prognosis error: ${res.status}` }, { status: res.status });
    }

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[api/policies] non-JSON response:', text.slice(0, 300));
      return NextResponse.json({ error: 'Prognosis returned non-JSON response' }, { status: 502 });
    }

    // Unwrap envelope
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: Record<string, any>[] =
      Array.isArray(data)              ? data              :
      Array.isArray((data as any)?.data)   ? (data as any).data   :
      Array.isArray((data as any)?.Data)   ? (data as any).Data   :
      Array.isArray((data as any)?.result) ? (data as any).result :
      Array.isArray((data as any)?.Result) ? (data as any).Result :
      [];

    if (raw.length > 0) {
      console.log('[api/policies] first record keys:', Object.keys(raw[0]).join(', '));
      console.log('[api/policies] first record sample:', JSON.stringify(raw[0]).slice(0, 500));
    }

    const all = raw.map(normalizePolicy);

    // Deduplicate by groupId (keep first occurrence)
    const seen = new Set<string>();
    const unique = all.filter((p) => {
      const key = p.groupId || p.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Only serve Active policies
    const policies = unique.filter((p) => p.status === 'Active');

    console.log(`[api/policies] total=${all.length} unique=${unique.length} active=${policies.length}`);

    return NextResponse.json({ policies, total: policies.length });
  } catch (err) {
    console.error('[api/policies] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch policies' }, { status: 500 });
  }
}
