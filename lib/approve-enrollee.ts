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
//     { "CifNumber": 0, "rejectionreason": "string", "terminationdate": "yyyy-mm-dd", "useremail": "string" }
// terminationdate is a bare date (e.g. "2026-07-27"), not a full ISO
// datetime — confirmed from a working example. Each call operates on a
// single member's own CIF, not a family/parentCif, so every beneficiary,
// principal included, must be decided on individually.
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

// dd/mm/yyyy -> plain yyyy-mm-dd, matching the confirmed working example
// ("terminationdate": "2026-07-27") — a bare date, not a full ISO datetime.
function toIsoDate(ddMmYyyy: string): string {
  const m = ddMmYyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date();
  return d.toISOString().slice(0, 10);
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

async function callDecide(endpoint: 'ApproveEnrollees' | 'RejectEnrollees', opts: DecisionOptions, userEmail: string): Promise<{ res: Response; text: string; r: Record<string, unknown> }> {
  const requestBody = JSON.stringify({
    CifNumber: Number(opts.cifNumber) || opts.cifNumber,
    rejectionreason: opts.reason,
    terminationdate: toIsoDate(opts.effectiveDate || todayDdMmYyyy()),
    useremail: userEmail,
  });
  const url = `${BASE}/api/CorporatePortal/${endpoint}`;
  console.log(`[${endpoint}] → POST ${url} body=${requestBody}`);
  const res = await callWithRetry(url, requestBody);
  const text = await res.text();
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { raw = text; }
  console.log(`[${endpoint}] ← HTTP ${res.status}: ${text.slice(0, 2000)}`);
  return { res, text, r: raw as Record<string, unknown> };
}

async function decide(endpoint: 'ApproveEnrollees' | 'RejectEnrollees', opts: DecisionOptions): Promise<ApproveResult> {
  try {
    // An empty useremail is rejected by Prognosis as "Invalid user." — the exact
    // same message a genuinely unknown account gets, which previously made this
    // look like Prognosis refusing valid HR logins. It isn't: probing confirmed
    // real HR emails ARE accepted, while '' is not. Fail fast with a message
    // that says what's actually wrong instead of sending a blank and guessing.
    if (!opts.userEmail?.trim()) {
      console.error(`[${endpoint}] Refusing to call Prognosis with an empty useremail (cif=${opts.cifNumber}) — the acting user's email is missing from the session.`);
      return { success: false, error: 'Your account has no email address on file, which Prognosis requires to record this decision. Please contact support.' };
    }

    let { res, text, r } = await callDecide(endpoint, opts, opts.userEmail);

    // Prognosis validates useremail against ITS OWN account list. Confirmed by
    // probing with a deliberately nonexistent CIF (so useremail is evaluated in
    // isolation): HR portal logins are accepted, whereas the Prognosis
    // service-login account (PROGNOSIS_USERNAME), a corporate contact address,
    // and an empty string are all rejected with "Invalid user.". So this retry
    // is a last resort for the rare account Prognosis genuinely doesn't know,
    // and only fires when a confirmed-valid fallback has been configured.
    if (res.status === 400 && /invalid user/i.test(text) && process.env.PROGNOSIS_APPROVAL_FALLBACK_EMAIL) {
      console.warn(`[${endpoint}] "${opts.userEmail}" rejected as invalid user — retrying with configured fallback account`);
      ({ res, text, r } = await callDecide(endpoint, opts, process.env.PROGNOSIS_APPROVAL_FALLBACK_EMAIL));
    }

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');
    const recordsUpdatedRaw = r?.recordsUpdated ?? r?.RecordsUpdated;
    const recordsUpdated = recordsUpdatedRaw != null ? Number(recordsUpdatedRaw) : undefined;

    if (!res.ok || (apiStatus && !['success', '200', 'ok', 'true'].includes(apiStatus))) {
      // "Invalid user." means Prognosis doesn't recognise the acting user's
      // email — nothing to do with the member being approved, and it affects
      // principals and dependants alike. Say so, because the raw message sends
      // people looking at the wrong thing.
      if (/invalid user/i.test(text)) {
        console.error(`[${endpoint}] Prognosis does not recognise "${opts.userEmail}" as a user${process.env.PROGNOSIS_APPROVAL_FALLBACK_EMAIL ? ' (and the configured fallback was also rejected)' : ' and no PROGNOSIS_APPROVAL_FALLBACK_EMAIL is configured'}.`);
        return {
          success: false,
          error: `Prognosis does not recognise "${opts.userEmail}" as an authorised user, so it will not record this decision. This is an account setup issue, not a problem with this member — ask Leadway to register this HR email on Prognosis (or configure an approved fallback account).`,
        };
      }
      return { success: false, error: apiMessage || `${endpoint} failed (${res.status})` };
    }
    // Prognosis can return HTTP 200 + status:"success" while recordsUpdated
    // is explicitly 0 — nothing on their side actually changed even though
    // it reads as a success. Treat that as a failure so HR isn't told a
    // member was approved when Prognosis silently no-op'd it.
    if (recordsUpdated === 0) {
      return { success: false, error: apiMessage || `${endpoint} reported success but updated no records — the member's status was not changed on Prognosis.` };
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
