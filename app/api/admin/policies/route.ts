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
  tokenExpiry  = Date.now() + 6 * 60 * 60 * 1000;
  console.log('[api/policies] service token obtained, cached for 6h');
  return token;
}

// ── Normalise one raw Prognosis row ───────────────────────────────────────────
// Actual field names from GetAllPolicies:
//   GROUP_ID, GROUP_CODE, PolicyNumber, GROUP_NAME, Accepton, Termdate,
//   Company_Email1, Contact_name, NoOfLives, accountmanager, scheme_type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePolicy(p: Record<string, any>) {
  const name    = String(p.GROUP_NAME ?? p.GroupName ?? p.CompanyName ?? p.Name ?? p.name ?? 'Unknown');
  const groupId = String(p.GROUP_ID   ?? p.GroupID   ?? p.PolicyID   ?? p.Id   ?? p.id   ?? '');

  const dateProvisioned = p.Accepton
    ? String(p.Accepton).split('T')[0]
    : p.CommencementDate ?? p.StartDate ?? '';

  const adminEmail   = String(p.Company_Email1 ?? p.AdminEmail ?? p.ContactEmail ?? p.Email ?? '');
  const contactName  = String(p.Contact_name  ?? p.ContactName ?? p.contact_name ?? '');
  const phone        = String(p.Phone1 ?? p.phone1 ?? p.Phone ?? p.phone ?? p.Mobile ?? p.mobile ?? '');

  const activeMembers = Number(p.NoOfLives ?? p.ActiveLives ?? p.TotalActiveLives ?? p.ActiveMembers ?? 0);

  const schemeCode = String(p.PolicyNumber ?? p.GROUP_CODE ?? p.SchemeCode ?? groupId);

  // Derive status from Termdate: active if coverage end is today or in the future
  const termDate = p.Termdate ? new Date(p.Termdate) : null;
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const status = termDate && termDate >= today ? 'Active' : 'Inactive';

  return {
    id: groupId || name,
    groupId,
    name,
    schemeCode,
    dateProvisioned,
    adminEmail,
    contactName,
    phone,
    status,
    activeMembers,
    termDate: termDate ? termDate.toISOString().split('T')[0] : '',
    template: 'Default template',
    colors: ['#F56B22', '#131C4E', '#3B82F6'],
  };
}

// ── Fetch policies with one-time token refresh on 401/403 ─────────────────────
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
      Array.isArray(data)                  ? data                  :
      Array.isArray((data as any)?.data)   ? (data as any).data   :
      Array.isArray((data as any)?.Data)   ? (data as any).Data   :
      Array.isArray((data as any)?.result) ? (data as any).result :
      Array.isArray((data as any)?.Result) ? (data as any).Result :
      [];

    // For each GROUP_ID keep only the row with the latest Accepton date
    // (each group has one row per annual renewal)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latestByGroup = new Map<string, Record<string, any>>();
    for (const row of raw) {
      const key = String(row.GROUP_ID ?? row.GroupID ?? row.id ?? '');
      if (!key) continue;
      const existing = latestByGroup.get(key);
      if (!existing) {
        latestByGroup.set(key, row);
      } else {
        const existingDate = new Date(existing.Accepton ?? 0).getTime();
        const rowDate      = new Date(row.Accepton      ?? 0).getTime();
        if (rowDate > existingDate) latestByGroup.set(key, row);
      }
    }

    const unique = Array.from(latestByGroup.values()).map(normalizePolicy);

    // Only serve currently-active policies
    const policies = unique.filter((p) => p.status === 'Active');

    console.log(`[api/policies] raw=${raw.length} unique_groups=${unique.length} active=${policies.length}`);

    return NextResponse.json({ policies, total: policies.length });
  } catch (err) {
    console.error('[api/policies] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch policies' }, { status: 500 });
  }
}
