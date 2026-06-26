import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

// ── Service token (6-hour cache) ──────────────────────────────────────────────
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

// ── GetAllPolicies (24-hour cache, shared across all requests) ────────────────
let allPoliciesCache: Record<string, unknown>[] | null = null;
let allPoliciesExpiry = 0;

async function getAllPolicies(token: string): Promise<Record<string, unknown>[]> {
  if (allPoliciesCache && Date.now() < allPoliciesExpiry) return allPoliciesCache;
  const res = await fetch(`${BASE}/api/CorporateProfile/GetAllPolicies`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { raw = null; }
  const rows = toRows(raw);
  allPoliciesCache = rows;
  allPoliciesExpiry = Date.now() + 24 * 60 * 60 * 1000;
  return rows;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function ordinal(n: number): string {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// Parse DD/MM/YYYY or YYYY-MM-DD → Date | null
function parseDate(s: string): Date | null {
  if (!s) return null;
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  // YYYY-MM-DD (ISO)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

// Format Date → "31st March 2027"
function fmtOrdinalDate(d: Date): string {
  return `${ordinal(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// Extract a date string from a policy record, trying multiple field names
function extractDateStr(p: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = p[k];
    if (v && typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

// ── Policy matching ───────────────────────────────────────────────────────────
function findPolicy(
  policies: Record<string, unknown>[],
  groupId: string,
  policyNumber: string,
): Record<string, unknown> | null {
  if (!policies.length) return null;

  const gid = String(groupId).toLowerCase();
  const pn  = String(policyNumber).toLowerCase().replace(/\s/g, '');

  // Candidate policies: match by PolicyNumber OR GroupID
  const candidates = policies.filter((p) => {
    const pNum = String(p.PolicyNumber ?? p.PolicyNo ?? p.PolicyCode ?? p.Policy_Number ?? '').toLowerCase().replace(/\s/g, '');
    const gId  = String(p.GroupID ?? p.GroupId ?? p.Group_ID ?? p.GroupCode ?? '').toLowerCase();
    return (pn && pNum === pn) || (gid && gId === gid);
  });

  const pool = candidates.length > 0 ? candidates : policies;

  // Among candidates, prefer "active" status
  const active = pool.filter((p) => {
    const status = String(p.Status ?? p.PolicyStatus ?? p.StatusDesc ?? p.Active ?? '').toLowerCase();
    return status.includes('active') || status === '1' || status === 'true';
  });

  const ranked = active.length > 0 ? active : pool;

  // Pick the most recent by end date
  return ranked.reduce<Record<string, unknown> | null>((best, p) => {
    if (!best) return p;
    const endStr  = extractDateStr(p,    'Todate','ToDate','EndDate','ExpiryDate','PolicyEndDate','RenewalDate');
    const bestStr = extractDateStr(best, 'Todate','ToDate','EndDate','ExpiryDate','PolicyEndDate','RenewalDate');
    const endD  = parseDate(endStr);
    const bestD = parseDate(bestStr);
    if (!endD) return best;
    if (!bestD) return p;
    return endD > bestD ? p : best;
  }, null);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DashboardStats {
  activeLives: number | null;
  principalLives: number | null;
  dependantLives: number | null;
  newThisMonth: number | null;
  newThisMonthLabel: string | null;
  totalPremium: number | null;
  // Claims
  claimsPaid: number | null;          // sum of AmtPaid (Paid status)
  amtClaimed: number | null;          // sum of AmtClaimed
  uniqueClaimsCount: number | null;   // unique ClaimNumber
  membersUtilized: number | null;     // unique MemberShipNo who accessed care
  utilizationRatePct: number | null;  // membersUtilized / activeLives * 100
  lossRatioPct: number | null;
  // Top breakdowns (top 5 each)
  topProviders: { name: string; location: string; visits: number; amtPaid: number }[];
  topServices: { service: string; visits: number; amtPaid: number }[];
  policyPeriod: string | null;
  policyYear: number | null;
  policyFromDate: string | null;
  policyToDate: string | null;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groupId      = session.user.companyId  ?? '';
  const policyNumber = session.user.policyNumber ?? '';
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  try {
    const token = await getServiceToken();

    const [premiumRaw, claimsRaw, allPolicies] = await Promise.all([
      fetchJson(token, `/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`),
      fetchJson(token, `/api/CorporateProfile/GetGroupClaims?groupid=${groupId}`),
      getAllPolicies(token),
    ]);

    // ── Policy period from GetAllPolicies ────────────────────────────────────
    const policy = findPolicy(allPolicies, groupId, policyNumber);

    let policyPeriod: string | null = null;
    let policyYear: number | null   = null;
    let policyFromDate: string | null = null;
    let policyToDate: string | null   = null;

    if (policy) {
      const fromStr = extractDateStr(policy, 'Fromdate','FromDate','StartDate','InceptionDate','CommencementDate','PolicyStartDate');
      const toStr   = extractDateStr(policy, 'Todate',  'ToDate',  'EndDate',  'ExpiryDate',   'RenewalDate',    'PolicyEndDate');
      const fromD   = parseDate(fromStr);
      const toD     = parseDate(toStr);

      if (fromD && toD) {
        policyPeriod  = `${fmtOrdinalDate(fromD)} – ${fmtOrdinalDate(toD)}`;
        policyYear    = fromD.getFullYear();
        policyFromDate = fromStr;
        policyToDate   = toStr;
      }
    }

    // ── Active lives from GetGroupPremium ────────────────────────────────────
    const rows = toRows(premiumRaw);
    const activeRows = rows.filter(
      (r) => String(r.MemberStatus_Desc ?? r.MemberStatusDesc ?? r.Status ?? '').toLowerCase() === 'active'
    );
    const activeIds = new Set(
      activeRows.map((r) => String(r.Member_EnrolleeID ?? r.MemberEnrolleeID ?? r.EnrolleeID ?? '')).filter(Boolean)
    );
    const activeLives    = activeIds.size > 0 ? activeIds.size : null;
    const principalLives = [...activeIds].filter((id) => id.endsWith('/0')).length || null;
    const dependantLives = activeLives !== null && principalLives !== null ? activeLives - principalLives : null;

    // ── New members this calendar month (MemberOriginalStartdate) ────────────
    // Use server time — this runs server-side so Date is reliable
    const now = new Date();
    const currentYear  = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based

    // De-duplicate by EnrolleeID: one row per member, use their earliest original start date
    const memberStartMap = new Map<string, Date>();
    for (const r of activeRows) {
      const eid = String(r.Member_EnrolleeID ?? r.MemberEnrolleeID ?? r.EnrolleeID ?? '');
      if (!eid) continue;
      const startStr = String(
        r.MemberOriginalStartdate ?? r.MemberOriginalStartDate ??
        r.OriginalStartDate ?? r.OriginalStartdate ?? ''
      );
      const d = startStr ? parseDate(startStr) : null;
      if (!d) continue;
      const existing = memberStartMap.get(eid);
      // Keep the earliest start date per member
      if (!existing || d < existing) memberStartMap.set(eid, d);
    }

    const newThisMonthIds = new Set<string>();
    for (const [eid, d] of memberStartMap) {
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        newThisMonthIds.add(eid);
      }
    }
    const newThisMonth = newThisMonthIds.size > 0 ? newThisMonthIds.size : 0;
    const newThisMonthLabel = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    // ── Premium (all members) ────────────────────────────────────────────────
    const totalPremium = rows.length > 0
      ? rows.reduce((sum, r) => sum + (toNumber(r.IndividualPremiumFees ?? r.PremiumFee ?? r.Premium) ?? 0), 0)
      : null;

    // ── Claims (GetGroupClaims fields confirmed) ─────────────────────────────
    const claimRows = toRows(claimsRaw);

    // Paid claims only for financial totals
    const paidRows = claimRows.filter(
      (r) => String(r.CLAIM_STATUS ?? r.ClaimStatus ?? '').trim().toLowerCase().startsWith('paid')
    );

    const claimsPaid = paidRows.length > 0
      ? paidRows.reduce((sum, r) => sum + (toNumber(r.AmtPaid ?? r.AmountPaid ?? r.AmtClaimed) ?? 0), 0)
      : claimRows.length > 0   // fallback: no status filter if CLAIM_STATUS absent
        ? claimRows.reduce((sum, r) => sum + (toNumber(r.AmtPaid ?? r.AmountPaid) ?? 0), 0)
        : null;

    const amtClaimed = claimRows.length > 0
      ? claimRows.reduce((sum, r) => sum + (toNumber(r.AmtClaimed ?? r.AmountClaimed) ?? 0), 0)
      : null;

    // Unique hospital visits = unique ClaimNumber
    const uniqueClaimNos = new Set(
      claimRows.map((r) => String(r.ClaimNumber ?? r.Claim_Number ?? '').trim()).filter(Boolean)
    );
    const uniqueClaimsCount = uniqueClaimNos.size > 0 ? uniqueClaimNos.size : null;

    // Members who accessed care = unique MemberShipNo
    const utilizedMemberIds = new Set(
      claimRows.map((r) => String(r.MemberShipNo ?? r.MembershipNo ?? r.MemberNo ?? '').trim()).filter(Boolean)
    );
    const membersUtilized = utilizedMemberIds.size > 0 ? utilizedMemberIds.size : null;

    // Utilization rate
    const utilizationRatePct =
      membersUtilized !== null && activeLives && activeLives > 0
        ? Math.round((membersUtilized / activeLives) * 100)
        : null;

    const lossRatioPct = (claimsPaid !== null && totalPremium && totalPremium > 0)
      ? Math.round((claimsPaid / totalPremium) * 100)
      : null;

    // Top 5 providers by visit count
    const providerMap = new Map<string, { location: string; visits: Set<string>; amtPaid: number }>();
    for (const r of claimRows) {
      const name     = String(r.Provider ?? r.ProviderName ?? '').trim();
      const location = String(r.ProviderLocation ?? r.Location ?? r.State ?? '').trim();
      const claimNo  = String(r.ClaimNumber ?? '').trim();
      const paid     = toNumber(r.AmtPaid ?? r.AmountPaid) ?? 0;
      if (!name) continue;
      const existing = providerMap.get(name);
      if (existing) {
        if (claimNo) existing.visits.add(claimNo);
        existing.amtPaid += paid;
      } else {
        const visits = new Set<string>();
        if (claimNo) visits.add(claimNo);
        providerMap.set(name, { location, visits, amtPaid: paid });
      }
    }
    const topProviders = [...providerMap.entries()]
      .map(([name, d]) => ({ name, location: d.location, visits: d.visits.size, amtPaid: d.amtPaid }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);

    // Top 5 service types by visit count
    const serviceMap = new Map<string, { visits: Set<string>; amtPaid: number }>();
    for (const r of claimRows) {
      const svc     = String(r.SERVICE ?? r.ServiceType ?? r.Service ?? '').trim();
      const claimNo = String(r.ClaimNumber ?? '').trim();
      const paid    = toNumber(r.AmtPaid ?? r.AmountPaid) ?? 0;
      if (!svc) continue;
      const existing = serviceMap.get(svc);
      if (existing) {
        if (claimNo) existing.visits.add(claimNo);
        existing.amtPaid += paid;
      } else {
        const visits = new Set<string>();
        if (claimNo) visits.add(claimNo);
        serviceMap.set(svc, { visits, amtPaid: paid });
      }
    }
    const topServices = [...serviceMap.entries()]
      .map(([service, d]) => ({ service, visits: d.visits.size, amtPaid: d.amtPaid }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);

    const stats: DashboardStats = {
      activeLives,
      principalLives,
      dependantLives,
      newThisMonth,
      newThisMonthLabel,
      totalPremium,
      claimsPaid,
      amtClaimed,
      uniqueClaimsCount,
      membersUtilized,
      utilizationRatePct,
      lossRatioPct,
      topProviders,
      topServices,
      policyPeriod,
      policyYear,
      policyFromDate,
      policyToDate,
    };

    return NextResponse.json({
      stats,
      _debug: {
        matchedPolicy: policy,
        policiesCount: allPolicies.length,
        samplePolicy: allPolicies[0] ?? null,
        premiumRowCount: rows.length,
        activeRowCount: activeRows.length,
        samplePremiumRow: rows[0] ?? null,
        claimsRowCount: claimRows.length,
        paidClaimsRowCount: paidRows.length,
        sampleClaimRow: claimRows[0] ?? null,
        uniqueClaimsCount,
        membersUtilized,
        topProviders,
        topServices,
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
