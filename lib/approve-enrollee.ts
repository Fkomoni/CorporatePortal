// Approve / reject a member's pending enrolment on Prognosis. Used both for
// auto-approving HR-initiated registrations and for the Pending Enrolees
// review screen (mobile-app / link self-registrations awaiting HR decision).
//
// Confirmed signatures (from real Prognosis requests — each operates on a
// single member's own CIF, not a family/parentCif, so every beneficiary,
// principal included, must be decided on individually):
//   POST /api/CorporatePortal/ApproveEnrollees
//     ?cifnumber=<cif>&approvereason=<text>&effective_date=<dd/mm/yyyy>&useremail=<hr email>
//   POST /api/CorporatePortal/RejectEnrollees
//     ?cifnumber=<cif>&rejectionreason=<text>&terminationdate=<dd/mm/yyyy>&useremail=<hr email>
// A successful call returns HTTP 200 with an empty body ({}) — no status/
// message/recordsUpdated fields to read back.
import { getServiceToken } from '@/lib/corporate-welcome';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export interface ApproveResult {
  success: boolean;
  message?: string;
  recordsUpdated?: number;
  error?: string;
}

export interface DecisionOptions {
  cifNumber: string | number;
  reason: string;
  userEmail: string;
  effectiveDate?: string; // dd/mm/yyyy — defaults to today
}

function todayDdMmYyyy(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

async function callWithRetry(url: string): Promise<Response> {
  let token = await getServiceToken();
  const call = (t: string) => fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } });
  let res = await call(token);
  if (res.status === 401 || res.status === 403) {
    token = await getServiceToken();
    res = await call(token);
  }
  return res;
}

async function decide(endpoint: 'ApproveEnrollees' | 'RejectEnrollees', opts: DecisionOptions): Promise<ApproveResult> {
  try {
    const reasonKey = endpoint === 'ApproveEnrollees' ? 'approvereason' : 'rejectionreason';
    const dateKey = endpoint === 'ApproveEnrollees' ? 'effective_date' : 'terminationdate';
    const params = new URLSearchParams({
      cifnumber: String(opts.cifNumber),
      [reasonKey]: opts.reason,
      [dateKey]: opts.effectiveDate || todayDdMmYyyy(),
      useremail: opts.userEmail,
    });
    const res = await callWithRetry(`${BASE}/api/CorporatePortal/${endpoint}?${params.toString()}`);
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');
    const recordsUpdated = Number(r?.recordsUpdated ?? r?.RecordsUpdated ?? 0) || undefined;

    if (!res.ok || (apiStatus && !['success', '200', 'ok', 'true'].includes(apiStatus))) {
      return { success: false, error: apiMessage || `${endpoint} failed (${res.status})` };
    }
    return { success: true, message: apiMessage, recordsUpdated };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : `Failed to call ${endpoint}` };
  }
}

export async function approveEnrollee(opts: DecisionOptions): Promise<ApproveResult> {
  return decide('ApproveEnrollees', { ...opts, reason: opts.reason || 'Active' });
}

export async function rejectEnrollee(opts: DecisionOptions): Promise<ApproveResult> {
  return decide('RejectEnrollees', opts);
}
