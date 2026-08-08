// Approve / reject a member's pending enrolment on Prognosis. Used both for
// auto-approving HR-initiated registrations and for the Pending Enrolees
// review screen (mobile-app / link self-registrations awaiting HR decision).
//
// Confirmed signature (from Prognosis's updated Swagger: a JSON body, not
// query params like we previously assumed). Both endpoints use the IDENTICAL
// field names below. ApproveEnrollees's Swagger doc also shows
// rejectionreason/terminationdate, not approvereason/effective_date, so this
// is presumably a shared DTO on Prognosis's side rather than a doc typo:
//   POST /api/CorporatePortal/RejectEnrollees
//   POST /api/CorporatePortal/ApproveEnrollees
//     { "CifNumber": 0, "rejectionreason": "string", "terminationdate": "yyyy-mm-dd", "useremail": "string" }
// terminationdate is a bare date (e.g. "2026-07-27"), not a full ISO
// datetime: confirmed from a working example. Each call operates on a
// single member's own CIF, not a family/parentCif, so every beneficiary,
// principal included, must be decided on individually.
import { getServiceToken } from '@/lib/corporate-welcome';
import { PROGNOSIS_ACTING_USER_EMAIL } from '@/lib/prognosis-acting-user';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');


export interface ApproveResult {
  success: boolean;
  message?: string;
  recordsUpdated?: number;
  error?: string;
  /** The account Prognosis recorded this decision against, when it differs from
   *  the HR user who made it: so callers can audit the real actor separately. */
  prognosisUserEmail?: string;
  /** Prognosis failed internally (5xx) rather than refusing the decision -
   *  nothing was changed and the same request is worth retrying later. */
  transient?: boolean;
}

export interface DecisionOptions {
  cifNumber: string | number;
  reason: string;
  userEmail: string;
  effectiveDate?: string; // dd/mm/yyyy: defaults to today
}

// dd/mm/yyyy -> plain yyyy-mm-dd, matching the confirmed working example
// ("terminationdate": "2026-07-27"): a bare date, not a full ISO datetime.
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
    // The acting HR user's own email goes on the decision wherever Prognosis
    // will take it. It only falls back to the shared account when Prognosis
    // answers "Invalid user.", which is its way of saying it does not know that
    // address. Every decision used to be filed under the fallback regardless, so
    // Prognosis's record showed one person approving every enrolee for every
    // company.
    const actor = opts.userEmail?.trim() ?? '';
    let filedAs = actor || PROGNOSIS_ACTING_USER_EMAIL;
    let { res, text, r } = await callDecide(endpoint, opts, filedAs);

    if (actor && filedAs === actor && /invalid user/i.test(text)) {
      console.log(`[${endpoint}] Prognosis does not recognise ${actor}: refiling as ${PROGNOSIS_ACTING_USER_EMAIL}`);
      filedAs = PROGNOSIS_ACTING_USER_EMAIL;
      ({ res, text, r } = await callDecide(endpoint, opts, filedAs));
    }
    if (filedAs !== actor) {
      console.log(`[${endpoint}] cif=${opts.cifNumber} requested by ${actor || 'unknown'}, filed on Prognosis as ${filedAs}`);
    }

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');
    const recordsUpdatedRaw = r?.recordsUpdated ?? r?.RecordsUpdated;
    const recordsUpdated = recordsUpdatedRaw != null ? Number(recordsUpdatedRaw) : undefined;

    if (!res.ok || (apiStatus && !['success', '200', 'ok', 'true'].includes(apiStatus))) {
      // "Invalid user." means Prognosis doesn't recognise the acting user's
      // email: nothing to do with the member being approved, and it affects
      // principals and dependants alike. Say so, because the raw message sends
      // people looking at the wrong thing.
      if (/invalid user/i.test(text)) {
        // Reaching here means the fallback was refused too: the acting user's
        // own email was already retried against it above. That one account
        // failing takes every approval with it, not just this member.
        console.error(`[${endpoint}] Prognosis rejected both ${actor || '(no acting user)'} and the fallback account "${PROGNOSIS_ACTING_USER_EMAIL}": all approvals/rejections will fail until this is resolved.`);
        return {
          success: false,
          error: `Prognosis did not accept your account or the account this portal falls back to, so it will not record this decision. This affects all approvals, not just this member. Please contact Leadway.`,
        };
      }
      // A 5xx is Prognosis failing internally, not a decision being refused -
      // their generic body ("An error has occurred.", or a raw SQL Server
      // connection error) says nothing actionable and reads as though something
      // is wrong with this member. Retrying later usually just works.
      if (res.status >= 500) {
        console.error(`[${endpoint}] Prognosis ${res.status} for cif=${opts.cifNumber}: treating as transient: ${text.slice(0, 300)}`);
        return {
          success: false,
          transient: true,
          error: `Leadway's system is temporarily unavailable and could not record this decision. Nothing has been changed. Please try again in a few minutes.`,
        };
      }
      return { success: false, error: apiMessage || `${endpoint} failed (${res.status})` };
    }
    // Prognosis can return HTTP 200 + status:"success" while recordsUpdated
    // is explicitly 0: nothing on their side actually changed even though
    // it reads as a success. Treat that as a failure so HR isn't told a
    // member was approved when Prognosis silently no-op'd it.
    if (recordsUpdated === 0) {
      return { success: false, error: apiMessage || `${endpoint} reported success but updated no records: the member's status was not changed on Prognosis.` };
    }
    return {
      success: true,
      message: apiMessage,
      recordsUpdated,
      // Only set when the decision could not be filed under the acting user, so
      // callers can say whose name it went under instead of implying it always
      // goes under someone else's.
      prognosisUserEmail: filedAs !== actor ? filedAs : undefined,
    };
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
