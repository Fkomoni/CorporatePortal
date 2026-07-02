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

function toArr(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    for (const key of ['result', 'data', 'Data', 'Result', 'items', 'Items']) {
      if (Array.isArray(r[key])) return r[key] as Record<string, unknown>[];
    }
  }
  return [];
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID in session' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const schemeId = searchParams.get('schemeId');

  try {
    const token = await getServiceToken();

    // Fetch schemes
    const schemesRes = await fetch(`${BASE}/api/CorporatePortal/GetPolicySchemes?groupId=${groupId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const schemesRaw = await schemesRes.json().catch(() => null);
    const schemes = toArr(schemesRaw).map((r) => ({
      schemeId: String(r.SchemeId ?? r.schemeid ?? r.Schemeid ?? r.SchemeID ?? ''),
      schemeName: String(r.SchemeName ?? r.Scheme_Name ?? r.schemename ?? ''),
    })).filter((s) => s.schemeId);

    // If a schemeId was requested, return raw benefit rows for it
    if (schemeId) {
      const benefitsRes = await fetch(
        `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeId=${schemeId}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      );
      const benefitsRaw = await benefitsRes.json().catch(() => null);
      const rows = toArr(benefitsRaw);
      // Extract unique SERVICE (category) names and all unique field names
      const uniqueCategories = [...new Set(rows.map((r) =>
        String(r['SERVICE'] ?? r['Service'] ?? r['Category'] ?? r['BenefitCategory'] ?? r['ServiceType'] ?? '').trim()
      ).filter(Boolean))].sort();
      const allFields = [...new Set(rows.flatMap((r) => Object.keys(r)))].sort();

      return NextResponse.json({
        schemeId,
        totalRows: rows.length,
        uniqueCategories,
        allFieldNames: allFields,
        sampleRows: rows.slice(0, 5),
        rawResponse: benefitsRaw,
      });
    }

    // Default: return schemes list + instructions
    return NextResponse.json({
      groupId,
      schemes,
      usage: 'Add ?schemeId=<id> to see raw benefit rows for a specific scheme',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
