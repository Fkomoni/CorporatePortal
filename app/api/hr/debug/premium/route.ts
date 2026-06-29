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

function toRows(raw: unknown, depth = 0): Record<string, unknown>[] {
  if (!raw || depth > 6) return [];
  if (Array.isArray(raw)) return raw.filter((v) => v && typeof v === 'object') as Record<string, unknown>[];
  if (typeof raw !== 'object') return [];
  const r = raw as Record<string, unknown>;
  for (const v of Object.values(r)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null) return v as Record<string, unknown>[];
  }
  for (const v of Object.values(r)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = toRows(v, depth + 1);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

// GET /api/hr/debug/premium — returns raw field names + sample rows from GetGroupPremium
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID in session' }, { status: 400 });

  try {
    const token = await getServiceToken();

    const [premRes, memRes] = await Promise.all([
      fetch(`${BASE}/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      fetch(`${BASE}/api/EnrolleeProfile/GetGroupMembers?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
    ]);

    const [premRaw, memRaw] = await Promise.all([
      premRes.text().then((t) => { try { return JSON.parse(t); } catch { return t; } }),
      memRes.text().then((t)  => { try { return JSON.parse(t); } catch { return t; } }),
    ]);

    const premRows = toRows(premRaw);
    const memRows  = toRows(memRaw);

    const sample = (rows: Record<string, unknown>[], n = 3) => rows.slice(0, n).map((r) => {
      // Redact anything that looks like a name to keep it lightweight
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) out[k] = v;
      return out;
    });

    return NextResponse.json({
      groupId,
      GetGroupPremium: {
        httpStatus: premRes.status,
        totalRows: premRows.length,
        allFieldNames: premRows.length > 0 ? Object.keys(premRows[0]).sort() : [],
        sampleRows: sample(premRows),
      },
      GetGroupMembers: {
        httpStatus: memRes.status,
        totalRows: memRows.length,
        allFieldNames: memRows.length > 0 ? Object.keys(memRows[0]).sort() : [],
        sampleRows: sample(memRows),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
