import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

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

// ── GetAllPolicies (24-hour cache) ────────────────────────────────────────────
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

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function fetchJson(token: string, path: string): Promise<{ data: unknown; ok: boolean }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch { /* ignored */ }
  return { data, ok: res.ok };
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

function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = String(s).trim().slice(0, 10);
  // YYYY-MM-DD
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  // DD/MM/YYYY
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  // MM/DD/YYYY
  const mdy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const d = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function fmtOrdinalDate(d: Date): string {
  return `${ordinal(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

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

  const candidates = policies.filter((p) => {
    const pNum = String(p.PolicyNumber ?? p.PolicyNo ?? p.PolicyCode ?? p.Policy_Number ?? '').toLowerCase().replace(/\s/g, '');
    const gId  = String(p.GroupID ?? p.GroupId ?? p.Group_ID ?? p.GroupCode ?? '').toLowerCase();
    return (pn && pNum === pn) || (gid && gId === gid);
  });

  const pool = candidates.length > 0 ? candidates : policies;

  const active = pool.filter((p) => {
    const status = String(p.Status ?? p.PolicyStatus ?? p.StatusDesc ?? p.Active ?? '').toLowerCase();
    return status.includes('active') || status === '1' || status === 'true';
  });

  const ranked = active.length > 0 ? active : pool;

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

// ── Actuarial constants ───────────────────────────────────────────────────────
const PREMIUM_KEYS = [
  'IndividualPremiumFees','Member_Premium','ActualPremium','BasePremiumIndividual',
  'PremiumAmount','Premium','Amount','TotalPremium','GrossPremium','NetPremium',
  'premium_amount','premium','Production_Amount','ProductionAmount','GroupPremium',
  'AnnualPremium','Annual_Premium','MemberPremium','MemberContribution','Contribution',
  'PolicyPremium','Policy_Premium','PremiumDue',
];
const PAID_AMOUNT_KEYS  = ['AmtPaid','PaidAmount','AmountPaid','Paid_Amount','paid_amount','ClaimPaidAmount','NetPaid','Amount_Paid','TotalPaidAmount','TotalPaid'];
const BILLED_AMOUNT_KEYS = ['AmtClaimed','BilledAmount','ClaimedAmount','Amount_Billed','billed_amount','AmountBilled','ClaimAmount','Claim_Amount','GrossAmount','TotalBilled','amount_claimed'];
const STATUS_KEYS       = ['CLAIM_STATUS','ClaimStatus','Status','claim_status','PaymentStatus','Claim_Status'];
const PAYMENT_DATE_KEYS = ['PaymentDate','Payment_Date','DatePaid','PaidDate','DateSettled','SettlementDate'];
const CLAIM_DATE_KEYS   = ['TreatmentDate','DateOfService','ServiceDate','ClaimDate','Claim_Date','Treatment_Date'];
const PAID_SUBSTRINGS   = ['paid','settled','approved','complete','processed','reimbursed'];

function numField(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    if (typeof v === 'number') return v;
    const c = String(v).replace(/[,₦$\s]/g, '').trim();
    if (c && !isNaN(+c)) return +c;
  }
  return 0;
}

function strField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return '';
}

function daysApart(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// ── Actuarial computation ─────────────────────────────────────────────────────
interface LossRatioResult {
  totalPremium: number;
  earnedPremium: number;
  paidClaims: number;
  outstandingClaims: number;
  estimatedIBNR: number;
  ibnrMethod: string;
  totalIncurredClaims: number;
  lossRatio: number | null;
  lossRatioPct: number | null;
  cor: number | null;
  brokerage: number;
  nhiaFee: number;
  adminFee: number;
  riskStatus: string;
  elapsedDays: number;
  totalPolicyDays: number;
}

function computeLossRatio({
  premiumRows, claimRows, claimsOk, policyStart, policyEnd, brokerage = 0, today = new Date(),
}: {
  premiumRows: Record<string, unknown>[];
  claimRows: Record<string, unknown>[];
  claimsOk: boolean;
  policyStart: string;
  policyEnd: string;
  brokerage?: number;
  today?: Date;
}): LossRatioResult {
  const ps = parseDate(policyStart);
  const pe = parseDate(policyEnd);
  const hasPolicy = !!(ps && pe);

  const totalPolicyDays = hasPolicy ? Math.max(daysApart(ps!, pe!), 1) : 0;
  const asAt = hasPolicy ? (today < pe! ? today : pe!) : today;
  const elapsedDays = hasPolicy ? Math.max(daysApart(ps!, asAt), 0) : 0;

  // Written premium = sum of all IndividualPremiumFees
  const totalPremium = premiumRows.reduce((s, r) => s + numField(r, PREMIUM_KEYS), 0);

  // Earned premium: computed per member using each row's own Fromdate/Todate/CoverPeriod
  let earnedPremium = 0;
  for (const r of premiumRows) {
    const fee = numField(r, PREMIUM_KEYS);
    const mFromStr = strField(r, ['Fromdate','FromDate','PolicyFrom','PolicyFromDate','StartDate','InceptionDate']);
    const mToStr   = strField(r, ['Todate',  'ToDate',  'PolicyTo',  'PolicyToDate',  'EndDate',  'ExpiryDate']);
    const mFrom = parseDate(mFromStr);
    const mTo   = parseDate(mToStr);
    if (mFrom && mTo) {
      const coverDays = numField(r, ['CoverPeriod','coverPeriod','PolicyDays','DaysInPeriod','Days'])
        || Math.max(daysApart(mFrom, mTo), 1);
      const asAtMember = today < mTo ? today : mTo;
      const elapsedMember = Math.max(daysApart(mFrom, asAtMember), 0);
      earnedPremium += fee * (elapsedMember / coverDays);
    } else if (hasPolicy && totalPolicyDays > 0) {
      earnedPremium += fee * (elapsedDays / totalPolicyDays);
    }
    // If no dates at all, member earns nothing yet (conservative)
  }

  let paid = 0, outstanding = 0;
  const monthly: Record<string, number> = {};

  for (const row of claimRows) {
    const tdStr = row[CLAIM_DATE_KEYS[0]] != null
      ? String(row[CLAIM_DATE_KEYS[0]])
      : strField(row, CLAIM_DATE_KEYS);
    const td = parseDate(tdStr);
    // Only filter by policy date when we have dates; otherwise include all claims
    if (hasPolicy && td && (td < ps! || td > pe!)) continue;

    const hasConfirmed = 'CLAIM_STATUS' in row;
    let isPaid = false;
    let paidAmt = 0;

    if (hasConfirmed) {
      const st = String(row.CLAIM_STATUS ?? '').toLowerCase();
      paidAmt = numField(row, ['AmtPaid', ...PAID_AMOUNT_KEYS]);
      isPaid = PAID_SUBSTRINGS.some(s => st.includes(s)) || paidAmt > 0;
      if (isPaid) paid += paidAmt;
      else outstanding += numField(row, ['AmtClaimed', ...BILLED_AMOUNT_KEYS]);
    } else {
      const st = strField(row, STATUS_KEYS).toLowerCase();
      isPaid = ['paid','approved','settled','processed'].some(s => st.includes(s))
        || !!strField(row, PAYMENT_DATE_KEYS).trim()
        || numField(row, PAID_AMOUNT_KEYS) > 0;
      paidAmt = numField(row, PAID_AMOUNT_KEYS);
      if (isPaid) paid += paidAmt;
      else { const b = numField(row, BILLED_AMOUNT_KEYS); if (b > 0) outstanding += b; }
    }

    // Monthly IBNR bucket: confirmed path uses exact "Paid Claims" + AmtPaid
    const countForIbnr = hasConfirmed
      ? String(row.CLAIM_STATUS ?? '').trim() === 'Paid Claims'
      : isPaid;
    if (countForIbnr && td && (!ps || td >= ps)) {
      const amt = hasConfirmed ? numField(row, ['AmtPaid']) : paidAmt;
      const ym = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}`;
      monthly[ym] = (monthly[ym] ?? 0) + amt;
    }
  }

  const curYm = `${asAt.getFullYear()}-${String(asAt.getMonth() + 1).padStart(2, '0')}`;
  const completed = Object.entries(monthly).filter(([ym]) => ym !== curYm).map(([, v]) => v);
  let ibnr: number, ibnrMethod: string;
  if (completed.length >= 2) {
    const avg = completed.reduce((a, b) => a + b, 0) / completed.length;
    ibnr = Math.max(avg - (monthly[curYm] ?? 0), 0);
    ibnrMethod = 'Trend-based';
  } else {
    ibnr = paid * 0.075;
    ibnrMethod = 'Fallback (7.5%)';
  }

  const totalIncurred = paid + outstanding + ibnr;
  const lossRatio = (claimsOk && hasPolicy && earnedPremium > 0)
    ? +((totalIncurred / earnedPremium) * 100).toFixed(2)
    : null;
  const cor = lossRatio == null ? null
    : Math.round(brokerage > 0 ? lossRatio + 2 + 12 + brokerage : lossRatio + 2 + 15);
  const riskStatus = lossRatio == null ? 'Unknown'
    : lossRatio <= 60 ? 'Healthy'
    : lossRatio <= 80 ? 'Watchlist'
    : lossRatio <= 100 ? 'High Risk'
    : 'Critical';

  return {
    totalPremium:       +totalPremium.toFixed(2),
    earnedPremium:      +earnedPremium.toFixed(2),
    paidClaims:         +paid.toFixed(2),
    outstandingClaims:  +outstanding.toFixed(2),
    estimatedIBNR:      +ibnr.toFixed(2),
    ibnrMethod,
    totalIncurredClaims: +totalIncurred.toFixed(2),
    lossRatio,
    lossRatioPct: lossRatio !== null ? Math.round(lossRatio) : null,
    cor,
    brokerage,
    nhiaFee: 2,
    adminFee: brokerage > 0 ? 12 : 15,
    riskStatus,
    elapsedDays,
    totalPolicyDays,
  };
}

// ── Scheme Health Score ───────────────────────────────────────────────────────
function computeHealthScore({
  lossRatio, cor, utilizationRate, outstandingClaims, paidClaims,
}: {
  lossRatio: number | null;
  cor: number | null;
  utilizationRate: number | null;
  outstandingClaims: number;
  paidClaims: number;
}): { score: number; label: string } {
  // Loss ratio (50%)
  const lrScore = lossRatio === null ? 50
    : lossRatio <= 60 ? 100
    : lossRatio <= 70 ? 85
    : lossRatio <= 80 ? 70
    : lossRatio <= 90 ? 50
    : lossRatio <= 100 ? 30
    : 10;

  // COR (20%)
  const corScore = cor === null ? 50
    : cor <= 80 ? 100
    : cor <= 95 ? 75
    : cor <= 110 ? 50
    : cor <= 125 ? 30
    : 10;

  // Utilization rate (20%) — 15–35% is the healthy range
  const u = utilizationRate;
  const utilScore = u === null ? 50
    : u >= 15 && u <= 35 ? 100
    : u > 35 && u <= 50 ? 75
    : u > 50 && u <= 65 ? 50
    : u > 65 ? 30
    : 60; // < 15%: slight penalty for under-access

  // Claims settlement ratio (10%)
  const total = paidClaims + outstandingClaims;
  const settleScore = total === 0 ? 100
    : outstandingClaims / total < 0.10 ? 100
    : outstandingClaims / total < 0.20 ? 80
    : outstandingClaims / total < 0.30 ? 60
    : 40;

  const score = Math.round(lrScore * 0.50 + corScore * 0.20 + utilScore * 0.20 + settleScore * 0.10);

  const label = score >= 85 ? 'Excellent'
    : score >= 70 ? 'Healthy'
    : score >= 55 ? 'Watchlist'
    : score >= 40 ? 'At Risk'
    : 'Critical';

  return { score, label };
}

// Store this month's snapshot; read previous quarter for trend (raw SQL — graceful if table not yet migrated)
async function upsertHealthSnapshot(groupId: string, yearMonth: string, snap: {
  score: number; lossRatio: number | null; cor: number | null; utilRate: number | null; riskStatus: string | null;
}): Promise<void> {
  try {
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO scheme_health_snapshots (id,"groupId","yearMonth",score,"lossRatio",cor,"utilRate","riskStatus","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
       ON CONFLICT ("groupId","yearMonth") DO UPDATE SET
         score=$4,"lossRatio"=$5,cor=$6,"utilRate"=$7,"riskStatus"=$8,"updatedAt"=NOW()`,
      id, groupId, yearMonth, snap.score, snap.lossRatio, snap.cor, snap.utilRate, snap.riskStatus,
    );
  } catch { /* table not yet migrated — silent until first deploy */ }
}

async function getPreviousQuarterScore(groupId: string, currentYM: string): Promise<number | null> {
  try {
    const [y, m] = currentYM.split('-').map(Number);
    const pm = m - 3;
    const py = y + Math.floor((pm - 1) / 12);
    const prevYM = `${py}-${String(((pm - 1 + 12) % 12) + 1).padStart(2, '0')}`;
    const rows = await prisma.$queryRawUnsafe<{ score: number }[]>(
      `SELECT score FROM scheme_health_snapshots WHERE "groupId"=$1 AND "yearMonth"=$2 LIMIT 1`,
      groupId, prevYM,
    );
    return rows.length > 0 ? Number(rows[0].score) : null;
  } catch { return null; }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DashboardStats {
  activeLives: number | null;
  principalLives: number | null;
  dependantLives: number | null;
  newThisMonth: number | null;
  newThisMonthLabel: string | null;
  // Premium
  totalPremium: number | null;
  earnedPremium: number | null;
  elapsedDays: number | null;
  totalPolicyDays: number | null;
  // Claims
  claimsPaid: number | null;
  outstandingClaims: number | null;
  estimatedIBNR: number | null;
  ibnrMethod: string | null;
  totalIncurredClaims: number | null;
  amtClaimed: number | null;
  uniqueClaimsCount: number | null;
  membersUtilized: number | null;
  utilizationRatePct: number | null;
  // Loss ratio / COR
  lossRatioPct: number | null;
  lossRatioExact: number | null;
  cor: number | null;
  brokerage: number | null;
  nhiaFee: number | null;
  adminFee: number | null;
  riskStatus: string | null;
  // Top breakdowns
  topProviders: { name: string; location: string; visits: number; amtPaid: number }[];
  allProviders: { name: string; location: string; visits: number; amtPaid: number }[];
  topServices: { service: string; visits: number; amtPaid: number }[];
  // Scheme Health Score
  schemeHealthScore: number | null;
  schemeHealthLabel: string | null;
  schemeHealthTrend: number | null;      // delta vs same month 3 months ago
  schemeHealthTrendLabel: string | null; // e.g. "+3 from last quarter"
  // Policy
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

    const [premiumResult, claimsResult, allPolicies] = await Promise.all([
      fetchJson(token, `/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`),
      fetchJson(token, `/api/CorporateProfile/GetGroupClaims?groupid=${groupId}`),
      getAllPolicies(token),
    ]);

    const premiumRaw = premiumResult.data;
    const claimsRaw  = claimsResult.data;
    const claimsOk   = claimsResult.ok && claimsResult.data !== null;

    // ── Policy period + brokerage from GetAllPolicies ────────────────────────
    const policy = findPolicy(allPolicies, groupId, policyNumber);

    let policyPeriod: string | null   = null;
    let policyYear: number | null     = null;
    let policyFromDate: string | null = null;
    let policyToDate: string | null   = null;
    let brokerage = 0;

    if (policy) {
      const fromStr = extractDateStr(policy, 'Fromdate','FromDate','StartDate','InceptionDate','CommencementDate','PolicyStartDate');
      const toStr   = extractDateStr(policy, 'Todate',  'ToDate',  'EndDate',  'ExpiryDate',  'RenewalDate',    'PolicyEndDate');
      const fromD   = parseDate(fromStr);
      const toD     = parseDate(toStr);

      if (fromD && toD) {
        policyPeriod   = `${fmtOrdinalDate(fromD)} – ${fmtOrdinalDate(toD)}`;
        policyYear     = fromD.getFullYear();
        policyFromDate = fromStr;
        policyToDate   = toStr;
      }

      // Auto-detect brokered: brokerate field on the policy row (> 0 → brokered)
      const brokerateRaw = policy.brokerate ?? policy.Brokerate ?? policy.BrokerRate
        ?? policy.BrokerageRate ?? policy.brokerage ?? policy.Brokerage ?? 0;
      brokerage = parseFloat(String(brokerateRaw).replace(/[^0-9.]/g, '')) || 0;
    }

    // ── Active lives from GetGroupPremium ────────────────────────────────────
    const rows = toRows(premiumRaw);

    // Fallback: derive policy dates from premium rows when GetAllPolicies didn't resolve them
    if ((!policyFromDate || !policyToDate) && rows.length > 0) {
      const sample = rows[0];
      const fromStr = extractDateStr(sample, 'Fromdate','FromDate','PolicyFromDate','PolicyFrom','StartDate','InceptionDate');
      const toStr   = extractDateStr(sample, 'Todate',  'ToDate',  'PolicyToDate',  'PolicyTo',  'EndDate',  'ExpiryDate');
      if (fromStr && toStr) {
        const fromD = parseDate(fromStr);
        const toD   = parseDate(toStr);
        if (fromD && toD) {
          policyFromDate = fromStr;
          policyToDate   = toStr;
          policyPeriod   = `${fmtOrdinalDate(fromD)} – ${fmtOrdinalDate(toD)}`;
          policyYear     = fromD.getFullYear();
        }
      }
    }
    const activeRows = rows.filter(
      (r) => String(r.MemberStatus_Desc ?? r.MemberStatusDesc ?? r.Status ?? '').toLowerCase() === 'active'
    );
    const activeIds = new Set(
      activeRows.map((r) => String(r.Member_EnrolleeID ?? r.MemberEnrolleeID ?? r.EnrolleeID ?? '')).filter(Boolean)
    );
    const activeLives    = activeIds.size > 0 ? activeIds.size : null;
    const principalLives = [...activeIds].filter((id) => id.endsWith('/0')).length || null;
    const dependantLives = activeLives !== null && principalLives !== null ? activeLives - principalLives : null;

    // ── New members this calendar month ──────────────────────────────────────
    const now = new Date();
    const currentYear  = now.getFullYear();
    const currentMonth = now.getMonth();

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

    // ── Actuarial: earned premium, incurred claims, loss ratio, COR ──────────
    const claimRows = toRows(claimsRaw);

    const lr = computeLossRatio({
      premiumRows: rows,
      claimRows,
      claimsOk,
      policyStart: policyFromDate ?? '',
      policyEnd:   policyToDate   ?? '',
      brokerage,
    });

    // ── Utilization metrics ───────────────────────────────────────────────────
    const uniqueClaimNos = new Set(
      claimRows.map((r) => String(r.ClaimNumber ?? r.Claim_Number ?? '').trim()).filter(Boolean)
    );
    const uniqueClaimsCount = uniqueClaimNos.size > 0 ? uniqueClaimNos.size : null;

    const utilizedMemberIds = new Set(
      claimRows.map((r) => String(r.MemberShipNo ?? r.MembershipNo ?? r.MemberNo ?? '').trim()).filter(Boolean)
    );
    const membersUtilized = utilizedMemberIds.size > 0 ? utilizedMemberIds.size : null;

    const utilizationRatePct =
      membersUtilized !== null && activeLives && activeLives > 0
        ? Math.round((membersUtilized / activeLives) * 100)
        : null;

    // ── Top 5 providers ───────────────────────────────────────────────────────
    const providerMap = new Map<string, { location: string; visits: Set<string>; amtPaid: number }>();
    for (const r of claimRows) {
      const name     = String(r.Provider ?? r.ProviderName ?? '').trim();
      const location = String(r.ProviderLocation ?? r.Location ?? r.State ?? '').trim();
      const claimNo  = String(r.ClaimNumber ?? r.Claim_Number ?? '').trim();
      const memberId = String(r.MemberShipNo ?? r.MembershipNo ?? r.MemberNo ?? '').trim();
      const txDate   = String(r.TreatmentDate ?? r.DateOfService ?? '').trim().slice(0, 10);
      // Unique visit key: prefer ClaimNumber; fall back to member+date to avoid missing rows
      const visitKey = claimNo || (memberId && txDate ? `${memberId}|${txDate}` : '');
      const paid     = toNumber(r.AmtPaid ?? r.AmountPaid) ?? 0;
      if (!name) continue;
      const existing = providerMap.get(name);
      if (existing) {
        if (visitKey) existing.visits.add(visitKey);
        existing.amtPaid += paid;
      } else {
        const visits = new Set<string>();
        if (visitKey) visits.add(visitKey);
        providerMap.set(name, { location, visits, amtPaid: paid });
      }
    }
    const allProvidersSorted = [...providerMap.entries()]
      .map(([name, d]) => ({ name, location: d.location, visits: d.visits.size, amtPaid: d.amtPaid }))
      .sort((a, b) => b.visits - a.visits);
    const topProviders = allProvidersSorted.slice(0, 5);

    // ── Top 5 service types ───────────────────────────────────────────────────
    const serviceMap = new Map<string, { visits: Set<string>; amtPaid: number }>();
    for (const r of claimRows) {
      const svc      = String(r.SERVICE ?? r.ServiceType ?? r.Service ?? '').trim();
      const claimNo  = String(r.ClaimNumber ?? r.Claim_Number ?? '').trim();
      const memberId = String(r.MemberShipNo ?? r.MembershipNo ?? r.MemberNo ?? '').trim();
      const txDate   = String(r.TreatmentDate ?? r.DateOfService ?? '').trim().slice(0, 10);
      const visitKey = claimNo || (memberId && txDate ? `${memberId}|${txDate}` : '');
      const paid     = toNumber(r.AmtPaid ?? r.AmountPaid) ?? 0;
      if (!svc) continue;
      const existing = serviceMap.get(svc);
      if (existing) {
        if (visitKey) existing.visits.add(visitKey);
        existing.amtPaid += paid;
      } else {
        const visits = new Set<string>();
        if (visitKey) visits.add(visitKey);
        serviceMap.set(svc, { visits, amtPaid: paid });
      }
    }
    const topServices = [...serviceMap.entries()]
      .map(([service, d]) => ({ service, visits: d.visits.size, amtPaid: d.amtPaid }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);

    const amtClaimed = claimRows.length > 0
      ? claimRows.reduce((sum, r) => sum + (toNumber(r.AmtClaimed ?? r.AmountClaimed) ?? 0), 0)
      : null;

    // ── Scheme Health Score ───────────────────────────────────────────────────
    const hs = computeHealthScore({
      lossRatio:       lr.lossRatio,
      cor:             lr.cor,
      utilizationRate: utilizationRatePct,
      outstandingClaims: lr.outstandingClaims,
      paidClaims:      lr.paidClaims,
    });

    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Persist this month's snapshot and retrieve last quarter's for trend (non-blocking)
    const [, prevScore] = await Promise.all([
      upsertHealthSnapshot(groupId, currentYM, {
        score: hs.score, lossRatio: lr.lossRatio, cor: lr.cor,
        utilRate: utilizationRatePct, riskStatus: lr.riskStatus,
      }),
      getPreviousQuarterScore(groupId, currentYM),
    ]);

    const schemeHealthTrend = prevScore !== null ? hs.score - prevScore : null;
    const schemeHealthTrendLabel = schemeHealthTrend !== null
      ? schemeHealthTrend > 0
        ? `▲ +${schemeHealthTrend} from last quarter`
        : schemeHealthTrend < 0
          ? `▼ ${schemeHealthTrend} from last quarter`
          : 'No change from last quarter'
      : null;

    const stats: DashboardStats = {
      activeLives,
      principalLives,
      dependantLives,
      newThisMonth,
      newThisMonthLabel,
      totalPremium:       lr.totalPremium,
      earnedPremium:      lr.earnedPremium,
      elapsedDays:        lr.elapsedDays,
      totalPolicyDays:    lr.totalPolicyDays,
      claimsPaid:         lr.paidClaims,
      outstandingClaims:  lr.outstandingClaims,
      estimatedIBNR:      lr.estimatedIBNR,
      ibnrMethod:         lr.ibnrMethod,
      totalIncurredClaims: lr.totalIncurredClaims,
      amtClaimed,
      uniqueClaimsCount,
      membersUtilized,
      utilizationRatePct,
      lossRatioPct:       lr.lossRatioPct,
      lossRatioExact:     lr.lossRatio,
      cor:                lr.cor,
      brokerage:          lr.brokerage,
      nhiaFee:            lr.nhiaFee,
      adminFee:           lr.adminFee,
      riskStatus:         lr.riskStatus,
      schemeHealthScore:      hs.score,
      schemeHealthLabel:      hs.label,
      schemeHealthTrend,
      schemeHealthTrendLabel,
      topProviders,
      allProviders: allProvidersSorted,
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
        claimsOk,
        sampleClaimRow: claimRows[0] ?? null,
        actuarial: {
          totalPremium:    lr.totalPremium,
          earnedPremium:   lr.earnedPremium,
          elapsedDays:     lr.elapsedDays,
          totalPolicyDays: lr.totalPolicyDays,
          paidClaims:      lr.paidClaims,
          outstandingClaims: lr.outstandingClaims,
          estimatedIBNR:   lr.estimatedIBNR,
          ibnrMethod:      lr.ibnrMethod,
          totalIncurred:   lr.totalIncurredClaims,
          lossRatio:       lr.lossRatio,
          cor:             lr.cor,
          brokerage:       lr.brokerage,
          riskStatus:      lr.riskStatus,
        },
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
