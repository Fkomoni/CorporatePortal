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

// Pick the first truthy value from an object across multiple possible key names
function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return null;
}

// Normalise an amount that may be a plain number or a string with symbols
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

// Unwrap common API envelope patterns: { data: ... }, { Data: ... }, { result: ... }, etc.
function unwrap(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const inner = r.data ?? r.Data ?? r.result ?? r.Result ?? r.payload ?? r.Payload ?? r.response ?? r.Response;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) return inner as Record<string, unknown>;
  if (Array.isArray(inner) && inner.length > 0) return inner[0] as Record<string, unknown>;
  return r;
}

// Parse a policy year from a policyNumber string like LGHNG25000721 → 2025
function parsePolicyYear(policyNumber: string): number | null {
  // Try to find a 2-digit year code: first run of exactly 2 digits after alphabetic prefix
  const m = policyNumber.match(/^[A-Z]+(\d{2})/i);
  if (m) {
    const yr = parseInt(m[1], 10);
    // Treat 00–49 as 2000–2049
    return yr >= 0 && yr <= 99 ? 2000 + yr : null;
  }
  return null;
}

export interface DashboardStats {
  activeLives: number | null;
  totalPremium: number | null;
  outstandingPremium: number | null;
  claimsPaid: number | null;
  lossRatioPct: number | null;
  policyStartDate: string | null;
  policyEndDate: string | null;
  policyYear: number | null;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  const policyNumber = session.user.policyNumber ?? '';
  const policyYearFromCode = parsePolicyYear(policyNumber);

  try {
    const token = await getServiceToken();

    const [premiumRaw, detailsRaw] = await Promise.all([
      fetchJson(token, `/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`),
      fetchJson(token, `/api/CorporateProfile/GetGroupDetails?groupid=${groupId}`),
    ]);

    const premium = unwrap(premiumRaw);
    const details = unwrap(detailsRaw);

    // Active lives — try premium payload first, then details
    const activeLives =
      toNumber(pick(premium, 'TotalLives', 'ActiveLives', 'NoOfLives', 'LivesCount', 'Lives', 'TotalEnrollees', 'Enrollees', 'MemberCount', 'Members')) ??
      toNumber(pick(details, 'TotalLives', 'ActiveLives', 'NoOfLives', 'LivesCount', 'TotalMembers', 'ActiveMembers', 'MemberCount'));

    // Premium totals
    const totalPremium =
      toNumber(pick(premium, 'TotalPremium', 'GrossPremium', 'AnnualPremium', 'NetPremium', 'PremiumAmount', 'Premium', 'TotalAmount', 'Amount')) ??
      toNumber(pick(details, 'TotalPremium', 'GrossPremium', 'AnnualPremium', 'PremiumAmount'));

    const outstandingPremium =
      toNumber(pick(premium, 'OutstandingPremium', 'BalancePremium', 'UnpaidPremium', 'Balance', 'AmountDue')) ??
      toNumber(pick(details, 'OutstandingPremium', 'BalancePremium', 'Balance'));

    const claimsPaid =
      toNumber(pick(premium, 'ClaimsPaid', 'TotalClaims', 'ClaimAmount', 'TotalClaimAmount', 'PaidClaims')) ??
      toNumber(pick(details, 'ClaimsPaid', 'TotalClaims', 'ClaimAmount'));

    // Loss ratio
    let lossRatioPct =
      toNumber(pick(premium, 'LossRatio', 'ClaimsRatio', 'LossRatioPct', 'LossRatioPercent')) ??
      toNumber(pick(details, 'LossRatio', 'ClaimsRatio'));
    // If not directly available but we have both claims and premium, compute it
    if (lossRatioPct === null && claimsPaid !== null && totalPremium && totalPremium > 0) {
      lossRatioPct = Math.round((claimsPaid / totalPremium) * 100);
    }

    // Policy dates
    const policyStartDate = String(
      pick(premium, 'PolicyStartDate', 'StartDate', 'InceptionDate', 'CommencementDate', 'FromDate') ??
      pick(details, 'PolicyStartDate', 'StartDate', 'InceptionDate', 'CommencementDate', 'FromDate') ?? ''
    ) || null;

    const policyEndDate = String(
      pick(premium, 'PolicyEndDate', 'EndDate', 'ExpiryDate', 'RenewalDate', 'ToDate') ??
      pick(details, 'PolicyEndDate', 'EndDate', 'ExpiryDate', 'RenewalDate', 'ToDate') ?? ''
    ) || null;

    // Derive policyYear: prefer API date, then parse from policyNumber code
    let policyYear: number | null = policyYearFromCode;
    if (policyStartDate) {
      const y = parseInt(policyStartDate.slice(0, 4), 10);
      if (!isNaN(y) && y > 2000) policyYear = y;
    }

    const stats: DashboardStats = {
      activeLives,
      totalPremium,
      outstandingPremium,
      claimsPaid,
      lossRatioPct,
      policyStartDate,
      policyEndDate,
      policyYear,
    };

    return NextResponse.json({ stats, _debug: { premiumRaw, detailsRaw } });
  } catch (err) {
    console.error('[hr/dashboard-stats] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), stats: null },
      { status: 500 }
    );
  }
}
