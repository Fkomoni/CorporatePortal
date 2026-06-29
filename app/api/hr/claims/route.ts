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
  principalName: string;
  employeeId: string;
  plan: string;
  provider: string;
  providerState: string;
  category: 'Outpatient' | 'Inpatient' | 'Dental' | 'Optical' | 'Maternity' | 'Emergency';
  diagnosis: string;
  icdCode: string;
  icdDescription: string;
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

    // Fetch policy period first; use it to derive the claims date range
    const premiumRes = await fetch(`${BASE}/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const premiumRaw = await premiumRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } });

    const premiumRows = toRows(premiumRaw);
    let policyStart: Date | null = null;
    let policyEnd: Date | null = null;
    if (premiumRows.length > 0) {
      const p = premiumRows[0];
      policyStart = parsePolicyDate(str(p, 'Fromdate', 'Client_DateAccepted', 'Member_Effectivedate', 'StartDate', 'InceptionDate'));
      policyEnd   = parsePolicyDate(str(p, 'Todate', 'Client_ExpiryDate', 'EndDate', 'ExpiryDate'));
    }

    // Fall back to current calendar year if policy dates unavailable
    const now = new Date();
    const fromDate = policyStart
      ? policyStart.toISOString().slice(0, 10)
      : `${now.getFullYear()}-01-01`;
    const toDate = policyEnd
      ? policyEnd.toISOString().slice(0, 10)
      : `${now.getFullYear()}-12-31`;

    const claimsRes = await fetch(
      `${BASE}/api/CorporatePortal/GetPaidClaimsWithDiagnosis?groupId=${groupId}&fromDate=${fromDate}&toDate=${toDate}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    const claimsRaw = await claimsRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } });

    // New response shape: { status: "success", data: [...] }
    const rows: Record<string, unknown>[] = Array.isArray(claimsRaw?.data)
      ? (claimsRaw.data as Record<string, unknown>[])
      : toRows(claimsRaw);

    const claims: LiveClaim[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];

      const rawStatus  = str(r, 'claim_status', 'ClaimStatus', 'Status', 'CLAIM_STATUS');
      const status     = mapStatus(rawStatus);

      const claimIdNum = r['claim_id'] != null ? String(r['claim_id']) : '';
      const claimRef   = claimIdNum || `CLM-${(idx + 1).toString().padStart(6, '0')}`;
      const key        = claimRef;

      // PatientName = person treated; PrincipalName = policy holder
      const memberName = str(r, 'PatientName', 'PrincipalName', 'MemberName', 'EnrolleeName');
      const enrolleeId = str(r, 'EnrolleeID', 'MemberShipNo', 'MembershipNo');
      const cifNumber  = r['cif_number'] != null ? String(r['cif_number']) : '';
      const employeeId = enrolleeId || cifNumber;

      const provider      = str(r, 'HospitalName', 'ProviderName', 'Provider', 'FacilityName');
      const providerState = str(r, 'ProviderState', 'HospitalState', 'State');
      const icdCode       = str(r, 'ICDCode', 'ICD_Code', 'icd_code', 'DiagnosisCode');
      const icdDescription = str(r, 'ICDDescription', 'ICD_Description', 'icd_description', 'DiagnosisDesc');
      // ProcedureName is the procedure; fall back to ICD description if blank
      const diagnosis     = str(r, 'ProcedureName', 'Diagnosis') || icdDescription;
      const catRaw        = str(r, 'FilterType', 'ServiceType', 'ClaimType', 'Category');
      const dateStr       = str(r, 'TreatmentDate', 'claim_date', 'DateOfService', 'ClaimDate');

      const amtClaimed = num(r, 'AmtClaimed', 'BilledAmount', 'ClaimedAmount');
      const amtPaid    = num(r, 'AmtPaid', 'PaidAmount', 'AmountPaid');

      const displayAmount  = status === 'Paid' ? (amtPaid > 0 ? amtPaid : amtClaimed) : amtClaimed;
      const rejectedAmount = status === 'Rejected' ? Math.max(amtClaimed - amtPaid, 0) : 0;

      const principalName = str(r, 'PrincipalName', 'SubscriberName');

      claims.push({
        id: key,
        claimRef,
        memberName,
        principalName,
        employeeId,
        plan: 'Plus Plan',
        provider,
        providerState,
        category: mapCategory(catRaw || diagnosis),
        diagnosis,
        icdCode,
        icdDescription,
        amount: displayAmount,
        amtClaimed,
        rejectedAmount,
        status,
        rawStatus,
        submittedDate: fmtDateStr(dateStr),
      });
    }

    // Sort: most recent first
    const filtered = [...claims].sort((a, b) => (b.submittedDate || '').localeCompare(a.submittedDate || ''));

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
