// Approve / reject a member's pending enrolment on Prognosis. Used both for
// auto-approving HR-initiated registrations and for the Pending Enrolees
// review screen (mobile-app / link self-registrations awaiting HR decision).
//
// Confirmed signature (from Prognosis's updated Swagger — a JSON body, not
// query params like we previously assumed). Both endpoints use the IDENTICAL
// field names below — ApproveEnrollees's Swagger doc also shows
// rejectionreason/terminationdate, not approvereason/effective_date, so this
// is presumably a shared DTO on Prognosis's side rather than a doc typo:
//   POST /api/CorporatePortal/RejectEnrollees
//   POST /api/CorporatePortal/ApproveEnrollees
//     { "CifNumber": 0, "rejectionreason": "string", "terminationdate": "<ISO datetime>", "useremail": "string" }
// Each operates on a single member's own CIF, not a family/parentCif, so every
// beneficiary, principal included, must be decided on individually.
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

// dd/mm/yyyy -> ISO datetime string, matching Swagger's example
// ("2026-07-13T13:48:03.914Z").
function toIsoDateTime(ddMmYyyy: string): string {
  const m = ddMmYyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date();
  return d.toISOString();
}

function todayDdMmYyyy(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

async function callWithRetry(url: string, body: string): Promise<Response> {
  let token = await getServiceToken();
  const call = (t: string) => fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body,
  });
  let res = await call(token);
  if (res.status === 401 || res.status === 403) {
    token = await getServiceToken();
    res = await call(token);
  }
  return res;
}

async function decide(endpoint: 'ApproveEnrollees' | 'RejectEnrollees', opts: DecisionOptions): Promise<ApproveResult> {
  try {
    const requestBody = JSON.stringify({
      CifNumber: Number(opts.cifNumber) || opts.cifNumber,
      rejectionreason: opts.reason,
      terminationdate: toIsoDateTime(opts.effectiveDate || todayDdMmYyyy()),
      useremail: opts.userEmail,
    });
    const url = `${BASE}/api/CorporatePortal/${endpoint}`;
    console.log(`[${endpoint}] → POST ${url} body=${requestBody}`);
    const res = await callWithRetry(url, requestBody);
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;
    console.log(`[${endpoint}] ← HTTP ${res.status}: ${text.slice(0, 500)}`);

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
