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

    // Fetch premium to get policy dates
    const premiumRes = await fetch(`${BASE}/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const premiumRaw = await premiumRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } });

    // Derive date range (same logic as main route)
    const now = new Date();
    let fromDate = `${now.getFullYear()}-01-01`;
    let toDate   = `${now.getFullYear()}-12-31`;

    const rows = Array.isArray(premiumRaw) ? premiumRaw
      : Array.isArray(premiumRaw?.data) ? premiumRaw.data
      : [];
    if (rows.length > 0) {
      const p = rows[0] as Record<string, unknown>;
      const raw = (k: string) => p[k] != null ? String(p[k]).trim() : '';
      const tryDate = (s: string) => {
        const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
        return s.slice(0, 10);
      };
      const start = raw('Fromdate') || raw('Client_DateAccepted') || raw('StartDate');
      const end   = raw('Todate')   || raw('Client_ExpiryDate')   || raw('EndDate');
      if (start) fromDate = tryDate(start);
      if (end)   toDate   = tryDate(end);
    }

    const url = `${BASE}/api/CorporatePortal/GetPaidClaimsWithDiagnosis?groupId=${groupId}&fromDate=${fromDate}&toDate=${toDate}`;
    const claimsRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const claimsText = await claimsRes.text();
    let claimsRaw: unknown;
    try { claimsRaw = JSON.parse(claimsText); } catch { claimsRaw = claimsText; }

    // Pull the data array
    const dataArr: unknown[] = Array.isArray((claimsRaw as Record<string,unknown>)?.data)
      ? (claimsRaw as Record<string,unknown>).data as unknown[]
      : Array.isArray(claimsRaw) ? claimsRaw as unknown[]
      : [];

    // Collect all unique field names across all rows
    const allKeys = new Set<string>();
    dataArr.forEach((row) => {
      if (row && typeof row === 'object') Object.keys(row as object).forEach((k) => allKeys.add(k));
    });

    return NextResponse.json({
      debug: true,
      endpoint: url,
      groupId,
      dateRange: { fromDate, toDate },
      httpStatus: claimsRes.status,
      totalRows: dataArr.length,
      allFieldNames: [...allKeys],
      firstThreeRows: dataArr.slice(0, 3),
      rawTopLevel: typeof claimsRaw === 'object' && !Array.isArray(claimsRaw)
        ? Object.fromEntries(Object.entries(claimsRaw as object).filter(([k]) => k !== 'data'))
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error', stack: err instanceof Error ? err.stack : undefined },
      { status: 500 }
    );
  }
}
