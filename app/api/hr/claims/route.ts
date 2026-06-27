import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';

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

// Recursively finds the first array-of-objects in any response shape
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

// Parse DD/MM/YYYY or ISO date string into Date
function parsePolicyDate(raw: string): Date | null {
  if (!raw) return null;
  const dmy = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = raw.trim().slice(0, 10);
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

function num(row: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
    if (!isNaN(n)) return n;
  }
  return 0;
}

function mapStatus(raw: string): 'Paid' | 'Processing' | 'Queried' | 'Rejected' {
  const s = raw.toLowerCase();
  if (s.includes('paid') || s.includes('settled') || s.includes('approved') || s.includes('complete') || s.includes('reimburse')) return 'Paid';
  if (s.includes('reject') || s.includes('declin') || s.includes('denied') || s.includes('cancel')) return 'Rejected';
  if (s.includes('quer') || s.includes('dispute') || s.includes('review') || s.includes('investigat')) return 'Queried';
  return 'Processing';
}

function mapCategory(raw: string): 'Outpatient' | 'Inpatient' | 'Dental' | 'Optical' | 'Maternity' | 'Emergency' {
  const s = raw.toLowerCase();
  if (s.includes('inpat') || s.includes('admit') || s.includes('ward') || s.includes('hospital')) return 'Inpatient';
  if (s.includes('dental') || s.includes('tooth') || s.includes('orthodon')) return 'Dental';
  if (s.includes('optic') || s.includes('eye') || s.includes('vision') || s.includes('spectac')) return 'Optical';
  if (s.includes('matern') || s.includes('antenatal') || s.includes('delivery') || s.includes('obstet')) return 'Maternity';
  if (s.includes('emerg') || s.includes('accident') || s.includes('urgent') || s.includes('casualt')) return 'Emergency';
  return 'Outpatient';
}

function fmtDateStr(raw: string): string {
  if (!raw) return '';
  const s = raw.trim().slice(0, 10);
  // DD/MM/YYYY → YYYY-MM-DD
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return s;
}

export interface LiveClaim {
  id: string;
  claimRef: string;
  memberName: string;
  employeeId: string;
  plan: string;
  provider: string;
  category: 'Outpatient' | 'Inpatient' | 'Dental' | 'Optical' | 'Maternity' | 'Emergency';
  diagnosis: string;
  amount: number;
  amtClaimed: number;
  rejectedAmount: number;
  status: 'Paid' | 'Processing' | 'Queried' | 'Rejected';
  submittedDate: string;
  settledDate?: string;
  rawStatus: string;
}

export interface ClaimsStats {
  totalPaidAmount: number;
  paidCount: number;
  processingAmount: number;
  processingCount: number;
  queriedCount: number;
  rejectedCount: number;
  rejectedAmount: number;
  totalClaims: number;
  policyStart: string | null;
  policyEnd: string | null;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  try {
    const token = await getServiceToken();

    const [claimsRes, premiumRes] = await Promise.all([
      fetch(`${BASE}/api/CorporateProfile/GetGroupClaims?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      fetch(`${BASE}/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
    ]);

    const [claimsRaw, premiumRaw] = await Promise.all([
      claimsRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } }),
      premiumRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } }),
    ]);

    // Extract policy period from premium data (first row's Fromdate / Todate)
    const premiumRows = toRows(premiumRaw);
    let policyStart: Date | null = null;
    let policyEnd: Date | null = null;
    if (premiumRows.length > 0) {
      const p = premiumRows[0];
      policyStart = parsePolicyDate(str(p, 'Fromdate', 'Client_DateAccepted', 'Member_Effectivedate', 'StartDate', 'InceptionDate'));
      policyEnd   = parsePolicyDate(str(p, 'Todate', 'Client_ExpiryDate', 'EndDate', 'ExpiryDate'));
    }

    const rows = toRows(claimsRaw);

    // Deduplicate by ClaimNumber — accumulate amount per unique claim
    const claimMap = new Map<string, { row: Record<string, unknown>; amtPaid: number; amtClaimed: number }>();

    for (const r of rows) {
      const claimNo  = str(r, 'ClaimNumber', 'Claim_Number', 'ClaimNo', 'ClaimRef', 'Ref');
      const memberId = str(r, 'MemberShipNo', 'MembershipNo', 'MemberNo', 'EnrolleeID', 'Member_ID', 'CifNo');
      const dateStr  = str(r, 'TreatmentDate', 'DateOfService', 'ServiceDate', 'ClaimDate', 'Treatment_Date');
      const key      = claimNo || (memberId && dateStr ? `${memberId}|${dateStr.slice(0, 10)}` : `row-${claimMap.size}`);

      const amtPaid    = num(r, 'AmtPaid', 'PaidAmount', 'AmountPaid', 'Paid_Amount', 'ClaimPaidAmount', 'NetPaid');
      const amtClaimed = num(r, 'AmtClaimed', 'BilledAmount', 'ClaimedAmount', 'Amount_Billed', 'AmountBilled', 'ClaimAmount');

      if (claimMap.has(key)) {
        const existing = claimMap.get(key)!;
        existing.amtPaid    += amtPaid;
        existing.amtClaimed += amtClaimed;
      } else {
        claimMap.set(key, { row: r, amtPaid, amtClaimed });
      }
    }

    const PAID_SUBSTRINGS = ['paid', 'settled', 'approved', 'complete', 'processed', 'reimbursed'];

    const claims: LiveClaim[] = [];
    let idx = 0;

    for (const [key, { row: r, amtPaid, amtClaimed }] of claimMap.entries()) {
      idx++;
      const rawStatus = str(r, 'CLAIM_STATUS', 'ClaimStatus', 'Status', 'claim_status', 'PaymentStatus', 'Claim_Status');
      const status    = mapStatus(rawStatus);

      const memberId  = str(r, 'MemberShipNo', 'MembershipNo', 'MemberNo', 'EnrolleeID', 'Member_ID', 'CifNo');
      const fullName  = str(r, 'MemberName', 'FullName', 'Name', 'EnrolleeName', 'PatientName', 'Enrollee_Name');
      const provider  = str(r, 'ProviderName', 'Provider', 'HospitalName', 'FacilityName', 'Provider_Name', 'ServiceProvider');
      const diagnosis = str(r, 'Diagnosis', 'DiagnosisDesc', 'Diagnoses', 'Condition', 'PrimaryDiagnosis', 'MainDiagnosis');
      const catRaw    = str(r, 'ServiceType', 'ClaimType', 'Category', 'BenefitType', 'ServiceCategory', 'ClaimCategory', 'CareType');
      const dateStr   = str(r, 'TreatmentDate', 'DateOfService', 'ServiceDate', 'ClaimDate', 'Treatment_Date', 'ClaimSubmitDate');
      const paidDate  = str(r, 'PaymentDate', 'Payment_Date', 'DatePaid', 'PaidDate', 'DateSettled', 'SettlementDate');
      const planRaw   = str(r, 'PlanName', 'Plan', 'BenefitPlan', 'ProductName', 'PackageName', 'SchemeName');

      // Dashboard-aligned: when CLAIM_STATUS exists and claim is paid with AmtPaid=0,
      // use AmtClaimed as effective paid amount (Prognosis data quality gap).
      const hasConfirmed = 'CLAIM_STATUS' in r;
      let displayAmount: number;
      let rejectedAmount = 0;

      if (hasConfirmed) {
        const st = String(r.CLAIM_STATUS ?? '').toLowerCase();
        const isPaid = PAID_SUBSTRINGS.some(s => st.includes(s)) || amtPaid > 0;
        if (isPaid) {
          displayAmount = amtPaid > 0 ? amtPaid : amtClaimed;
          rejectedAmount = amtClaimed - displayAmount;
        } else {
          displayAmount = amtClaimed;
          rejectedAmount = status === 'Rejected' ? amtClaimed : 0;
        }
      } else {
        displayAmount = status === 'Paid' ? (amtPaid > 0 ? amtPaid : amtClaimed) : amtClaimed;
        rejectedAmount = status === 'Rejected' ? amtClaimed - amtPaid : 0;
      }

      // Generate a ref if none available
      const claimRef = str(r, 'ClaimNumber', 'Claim_Number', 'ClaimNo', 'ClaimRef', 'Ref') || `CLM-${idx.toString().padStart(6, '0')}`;

      claims.push({
        id: key,
        claimRef,
        memberName: fullName,
        employeeId: memberId,
        plan: planRaw || 'Plus Plan',
        provider,
        category: mapCategory(catRaw || diagnosis),
        diagnosis,
        amount: displayAmount,
        amtClaimed,
        rejectedAmount: Math.max(rejectedAmount, 0),
        status,
        rawStatus,
        submittedDate: fmtDateStr(dateStr),
        settledDate: paidDate ? fmtDateStr(paidDate) : undefined,
      });
    }

    // Filter to current active policy period only
    const filtered = policyStart && policyEnd
      ? claims.filter((c) => {
          if (!c.submittedDate) return false;
          const d = new Date(`${c.submittedDate}T00:00:00`);
          return !isNaN(d.getTime()) && d >= policyStart! && d <= policyEnd!;
        })
      : claims;

    // Sort: most recent first
    filtered.sort((a, b) => (b.submittedDate || '').localeCompare(a.submittedDate || ''));

    const stats: ClaimsStats = {
      totalPaidAmount:  filtered.filter((c) => c.status === 'Paid').reduce((s, c) => s + c.amount, 0),
      paidCount:        filtered.filter((c) => c.status === 'Paid').length,
      processingAmount: filtered.filter((c) => c.status === 'Processing').reduce((s, c) => s + c.amtClaimed, 0),
      processingCount:  filtered.filter((c) => c.status === 'Processing').length,
      queriedCount:     filtered.filter((c) => c.status === 'Queried').length,
      rejectedCount:    filtered.filter((c) => c.status === 'Rejected').length,
      rejectedAmount:   filtered.reduce((s, c) => s + c.rejectedAmount, 0),
      totalClaims:      filtered.length,
      policyStart: policyStart ? policyStart.toISOString().slice(0, 10) : null,
      policyEnd:   policyEnd   ? policyEnd.toISOString().slice(0, 10)   : null,
    };

    void logAudit({ session, action: 'VIEW_CLAIMS', resource: 'claims', request: req,
      details: { totalClaims: filtered.length, groupId } });

    return NextResponse.json({ claims: filtered, stats });
  } catch (err) {
    console.error('[hr/claims] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}
