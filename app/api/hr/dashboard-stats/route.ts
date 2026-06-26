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

async function fetchJson(token: string, path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

// Unwrap envelope (data/Data/result/Result) and always return an array of records
function toRows(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const inner = r.data ?? r.Data ?? r.result ?? r.Result ?? r.payload ?? r.Payload;
    if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    if (inner && typeof inner === 'object') return [inner as Record<string, unknown>];
    return [r];
  }
  return [];
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Parse DD/MM/YYYY → { month (1-12), year }
function parseDDMMYYYY(s: string): { month: number; year: number } | null {
  const parts = s.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[1], 10);
    const year  = parseInt(parts[2], 10);
    if (!isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) return { month, year };
  }
  return null;
}

export interface DashboardStats {
  activeLives: number | null;
  principalLives: number | null;
  dependantLives: number | null;
  totalPremium: number | null;
  claimsPaid: number | null;
  lossRatioPct: number | null;
  policyPeriod: string | null;   // e.g. "Apr 2026 – Mar 2027"
  policyYear: number | null;     // start year
  policyFromDate: string | null;
  policyToDate: string | null;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  try {
    const token = await getServiceToken();

    const [premiumRaw, claimsRaw] = await Promise.all([
      fetchJson(token, `/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`),
      fetchJson(token, `/api/CorporateProfile/GetGroupClaims?groupid=${groupId}`),
    ]);

    // GetGroupPremium returns an array of per-member premium records
    const rows = toRows(premiumRaw);

    // Active members only
    const activeRows = rows.filter(
      (r) => String(r.MemberStatus_Desc ?? r.MemberStatusDesc ?? r.Status ?? '').toLowerCase() === 'active'
    );

    // Unique active enrollee IDs → active lives count
    const activeIds = new Set(
      activeRows.map((r) => String(r.Member_EnrolleeID ?? r.MemberEnrolleeID ?? r.EnrolleeID ?? '')).filter(Boolean)
    );
    const activeLives = activeIds.size > 0 ? activeIds.size : null;

    // Principals = EnrolleeID ends with /0
    const principalIds = new Set([...activeIds].filter((id) => id.endsWith('/0')));
    const principalLives = principalIds.size > 0 ? principalIds.size : null;
    const dependantLives = activeLives !== null && principalLives !== null ? activeLives - principalLives : null;

    // Total premium = sum of IndividualPremiumFees across ALL members (not just active)
    const totalPremium = rows.length > 0
      ? rows.reduce((sum, r) => sum + (toNumber(r.IndividualPremiumFees ?? r.PremiumFee ?? r.Premium) ?? 0), 0)
      : null;

    // Claims paid — from GetGroupClaims
    const claimRows = toRows(claimsRaw);
    const claimsPaid = claimRows.length > 0
      ? claimRows.reduce((sum, r) => sum + (toNumber(r.ClaimAmount ?? r.AmountPaid ?? r.TotalClaimed ?? r.Amount) ?? 0), 0)
      : null;

    // Loss ratio
    const lossRatioPct = (claimsPaid !== null && totalPremium && totalPremium > 0)
      ? Math.round((claimsPaid / totalPremium) * 100)
      : null;

    // Policy period from first active row's Fromdate / Todate (DD/MM/YYYY)
    const firstRow = activeRows[0] ?? rows[0];
    const fromStr = String(firstRow?.Fromdate ?? firstRow?.FromDate ?? firstRow?.StartDate ?? '');
    const toStr   = String(firstRow?.Todate   ?? firstRow?.ToDate   ?? firstRow?.EndDate   ?? '');

    const fromParsed = fromStr ? parseDDMMYYYY(fromStr) : null;
    const toParsed   = toStr   ? parseDDMMYYYY(toStr)   : null;

    const policyPeriod = fromParsed && toParsed
      ? `${MONTHS[fromParsed.month - 1]} ${fromParsed.year} – ${MONTHS[toParsed.month - 1]} ${toParsed.year}`
      : null;

    const policyYear = fromParsed?.year ?? null;

    const stats: DashboardStats = {
      activeLives,
      principalLives,
      dependantLives,
      totalPremium,
      claimsPaid,
      lossRatioPct,
      policyPeriod,
      policyYear,
      policyFromDate: fromStr || null,
      policyToDate:   toStr   || null,
    };

    return NextResponse.json({
      stats,
      _debug: {
        rowCount: rows.length,
        activeRowCount: activeRows.length,
        sampleRow: rows[0] ?? null,
        claimsRowCount: claimRows.length,
        claimsSampleRow: claimRows[0] ?? null,
      },
    });
  } catch (err) {
    console.error('[hr/dashboard-stats] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), stats: null },
      { status: 500 }
    );
  }
}
