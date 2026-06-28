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

export interface PolicyScheme {
  schemeId: string;
  schemeName: string;
}

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
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
    const res = await fetch(
      `${BASE}/api/CorporatePortal/GetPolicySchemes?groupId=${groupId}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch {
      throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }

    // Unwrap common response envelopes
    const arr: unknown[] = Array.isArray(raw) ? raw
      : Array.isArray((raw as Record<string,unknown>)?.data) ? (raw as Record<string,unknown>).data as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.Data) ? (raw as Record<string,unknown>).Data as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.result) ? (raw as Record<string,unknown>).result as unknown[]
      : [];

    const schemes: PolicyScheme[] = arr
      .filter((r) => r && typeof r === 'object')
      .map((r) => {
        const row = r as Record<string, unknown>;
        const id   = str(row, 'SchemeId', 'schemeId', 'scheme_id', 'Id', 'id', 'PlanId', 'planId');
        const name = str(row, 'SchemeName', 'schemeName', 'scheme_name', 'Name', 'name', 'PlanName', 'planName', 'Description');
        return { schemeId: id, schemeName: name };
      })
      .filter((s) => s.schemeId && s.schemeName);

    return NextResponse.json({ schemes, raw: arr.slice(0, 3) });
  } catch (err) {
    console.error('[hr/benefits/schemes] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch schemes' },
      { status: 500 },
    );
  }
}
