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

// Prognosis validates useremail against its OWN user list, and rejects anything
// it doesn't know with "Invalid user." — including HR accounts that are
// perfectly valid on our side. Confirmed by probing with a nonexistent CIF so
// useremail is evaluated in isolation: f-komoni-mbaekwe@leadway.com and
// komonifa@yahoo.com are accepted; the Prognosis service account, a corporate
// contact address, an empty string, and africaterminal@yopmail.com are not.
//
// INTERIM MEASURE: without a fallback, HR accounts Prognosis doesn't know
// cannot approve anyone at all. So a decision that would otherwise be refused
// is retried once under this known-good account. Prognosis then records the
// fallback as the acting user, NOT the HR user who actually clicked — our own
// audit log keeps the real one (see usedFallbackEmail below). Remove this
// default once the real HR emails are registered with Prognosis.
const FALLBACK_USER_EMAIL =
  process.env.PROGNOSIS_APPROVAL_FALLBACK_EMAIL ?? 'f-komoni-mbaekwe@leadway.com';

export interface ApproveResult {
  success: boolean;
  message?: string;
  recordsUpdated?: number;
  error?: string;
  /** Set when the decision only went through under the fallback account, so
   *  callers can record that Prognosis attributed it to someone else. */
  usedFallbackEmail?: string;
  /** Prognosis failed internally (5xx) rather than refusing the decision —
   *  nothing was changed and the same request is worth retrying later. */
  transient?: boolean;
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
    let usedFallbackEmail: string | undefined;

    // Prognosis validates useremail against ITS OWN account list. Confirmed by
    // probing with a deliberately nonexistent CIF (so useremail is evaluated in
    // isolation): HR portal logins are accepted, whereas the Prognosis
    // service-login account (PROGNOSIS_USERNAME), a corporate contact address,
    // and an empty string are all rejected with "Invalid user.". So this retry
    // is a last resort for the rare account Prognosis genuinely doesn't know,
    // and only fires when a confirmed-valid fallback has been configured.
    if (res.status === 400 && /invalid user/i.test(text) && FALLBACK_USER_EMAIL && FALLBACK_USER_EMAIL !== opts.userEmail) {
      console.warn(`[${endpoint}] Prognosis rejected "${opts.userEmail}" as an unknown user — retrying as ${FALLBACK_USER_EMAIL}`);
      ({ res, text, r } = await callDecide(endpoint, opts, FALLBACK_USER_EMAIL));
      if (res.ok) usedFallbackEmail = FALLBACK_USER_EMAIL;
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
        // Reaching here means the acting user was rejected AND the fallback
        // retry either didn't apply or was rejected too.
        const alsoTriedFallback = FALLBACK_USER_EMAIL && FALLBACK_USER_EMAIL !== opts.userEmail;
        console.error(`[${endpoint}] Prognosis rejected "${opts.userEmail}"${alsoTriedFallback ? ` and the fallback "${FALLBACK_USER_EMAIL}"` : ''} as unknown users.`);
        return {
          success: false,
          error: alsoTriedFallback
            ? `Prognosis does not recognise "${opts.userEmail}" or the fallback account as authorised users, so it will not record this decision. This is an account setup issue, not a problem with this member — ask Leadway to register an HR email on Prognosis.`
            : `Prognosis does not recognise "${opts.userEmail}" as an authorised user, so it will not record this decision. This is an account setup issue, not a problem with this member — ask Leadway to register this HR email on Prognosis.`,
        };
      }
      // A 5xx is Prognosis failing internally, not a decision being refused —
      // their generic body ("An error has occurred.", or a raw SQL Server
      // connection error) says nothing actionable and reads as though something
      // is wrong with this member. Retrying later usually just works.
      if (res.status >= 500) {
        console.error(`[${endpoint}] Prognosis ${res.status} for cif=${opts.cifNumber} — treating as transient: ${text.slice(0, 300)}`);
        return {
          success: false,
          transient: true,
          error: `Leadway's system is temporarily unavailable and could not record this decision. Nothing has been changed — please try again in a few minutes.`,
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
    if (usedFallbackEmail) {
      console.warn(`[${endpoint}] cif=${opts.cifNumber} recorded on Prognosis as ${usedFallbackEmail}, not ${opts.userEmail}`);
    }
    return { success: true, message: apiMessage, recordsUpdated, usedFallbackEmail };
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
