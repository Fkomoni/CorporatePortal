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

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

function parseDateStr(raw: string): string {
  if (!raw) return '';
  const dmy = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return raw.trim().slice(0, 10);
}

function mapPlan(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('magnum') || s.includes('blackcard') || s.includes('black card')) return 'Magnum Plan';
  if (s.includes('promax') || s.includes('pro max')) return 'Promax Plan';
  if (s.includes('max')) return 'Max Plan';
  if (s.includes('pro')) return 'Pro Plan';
  return 'Plus Plan';
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  try {
    const token = await getServiceToken();

    const premiumRes = await fetch(`${BASE}/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const premiumRaw = await premiumRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } });
    const rows = toRows(premiumRaw);

    // Derive scheme dates from first row
    let policyStart = '';
    let policyEnd = '';
    if (rows.length > 0) {
      policyStart = parseDateStr(str(rows[0], 'Fromdate', 'Client_DateAccepted', 'Member_Effectivedate', 'StartDate', 'InceptionDate'));
      policyEnd   = parseDateStr(str(rows[0], 'Todate', 'Client_ExpiryDate', 'EndDate', 'ExpiryDate'));
    }

    // Derive active plan tiers from unique plan names in the data
    const planSet = new Set<string>();
    for (const r of rows) {
      const p = mapPlan(str(r, 'Member_Plan', 'Product_SchemeType', 'PlanName', 'Plan', 'BenefitPlan', 'PackageName', 'SchemeName'));
      if (p) planSet.add(p);
    }
    const planOrder = ['Plus Plan', 'Pro Plan', 'Max Plan', 'Promax Plan', 'Magnum Plan'];
    const activePlans = planOrder.filter((p) => planSet.has(p));

    // Earliest enrollment date as "active since"
    let activeSince = '';
    for (const r of rows) {
      const d = parseDateStr(str(r, 'MemberOriginalStartdate', 'Member_Effectivedate', 'Fromdate', 'StartDate', 'InceptionDate'));
      if (d && (!activeSince || d < activeSince)) activeSince = d;
    }

    return NextResponse.json({
      companyName:  session.user.companyName || '',
      companyId:    session.user.companyId   || '',
      policyNumber: session.user.policyNumber || '',
      user: {
        name:  session.user.name  || '',
        email: session.user.email || '',
        role:  session.user.role  || '',
      },
      scheme: {
        policyStart,
        policyEnd,
        policyStartFmt: fmtDate(policyStart),
        policyEndFmt:   fmtDate(policyEnd),
        activeSince:    activeSince ? fmtDate(activeSince.slice(0, 7) + '-01') : '',
        activePlans,
      },
    });
  } catch (err) {
    console.error('[hr/company-profile] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch company profile' },
      { status: 500 }
    );
  }
}
