// Shared call to Prognosis's TerminateMember: used by the immediate HR
// action and the scheduled-termination cron job (kept only for rows already
// queued before TerminateMember was confirmed to accept a future
// terminationdate directly; new terminations no longer need scheduling).
// Confirmed shape (same DTO family as Approve/RejectEnrollees):
//   { CifNumber, rejectionreason, terminationdate: "yyyy-mm-dd", useremail }
import { PROGNOSIS_ACTING_USER_EMAIL } from '@/lib/prognosis-acting-user';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getServiceToken(): Promise<string> {
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

export interface TerminateResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface TerminateOptions {
  reason: string;
  terminationDate: string; // yyyy-mm-dd
  userEmail: string;
}

export async function callTerminateMember(cifNumber: string, opts: TerminateOptions): Promise<TerminateResult> {
  try {
    let token = await getServiceToken();

    // The acting HR user's own email goes on the termination wherever Prognosis
    // will take it, falling back to the shared account only when Prognosis
    // answers "Invalid user." for that address. Every termination used to be
    // filed under the fallback regardless of who performed it.
    const actor = opts.userEmail?.trim() ?? '';
    let filedAs = actor || PROGNOSIS_ACTING_USER_EMAIL;

    const url = `${BASE}/api/CorporatePortal/TerminateMember`;
    const callApi = async (t: string, useremail: string) => {
      const requestBody = JSON.stringify({
        CifNumber: Number(cifNumber) || cifNumber,
        rejectionreason: opts.reason,
        terminationdate: opts.terminationDate,
        useremail,
      });
      console.log(`[TerminateMember] → POST ${url} body=${requestBody}`);
      return fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: requestBody,
      });
    };

    let res = await callApi(token, filedAs);
    if (res.status === 401 || res.status === 403) {
      cachedToken = null; tokenExpiry = 0;
      token = await getServiceToken();
      res = await callApi(token, filedAs);
    }

    let text = await res.text();
    console.log(`[TerminateMember] ← HTTP ${res.status}: ${text.slice(0, 500)}`);

    if (actor && filedAs === actor && /invalid user/i.test(text)) {
      console.log(`[TerminateMember] Prognosis does not recognise ${actor}: refiling as ${PROGNOSIS_ACTING_USER_EMAIL}`);
      filedAs = PROGNOSIS_ACTING_USER_EMAIL;
      res = await callApi(token, filedAs);
      text = await res.text();
      console.log(`[TerminateMember] ← HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
    if (filedAs !== actor) {
      console.log(`[TerminateMember] cif=${cifNumber} requested by ${actor || 'unknown'}, filed on Prognosis as ${filedAs}`);
    }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');

    if (!res.ok || (apiStatus && apiStatus !== 'success')) {
      // Reaching here means the fallback was refused too: the acting user's own
      // email was already retried against it above. That account failing takes
      // every termination with it, not just this member.
      if (/invalid user/i.test(text)) {
        console.error(`[TerminateMember] Prognosis rejected both ${actor || '(no acting user)'} and the fallback account "${PROGNOSIS_ACTING_USER_EMAIL}": all terminations will fail until this is resolved.`);
        return {
          success: false,
          error: 'Prognosis did not accept your account or the account this portal falls back to, so it will not record this termination. This affects all terminations, not just this member. Please contact Leadway.',
        };
      }
      // A 5xx is Prognosis failing internally, not the termination being
      // refused. Nothing was written, and retrying later usually works.
      if (res.status >= 500) {
        console.error(`[TerminateMember] Prognosis ${res.status} for cif=${cifNumber}: treating as transient: ${text.slice(0, 300)}`);
        return {
          success: false,
          error: "Leadway's system is temporarily unavailable and could not record this termination. Nothing has been changed. Please try again in a few minutes.",
        };
      }
      return { success: false, error: apiMessage || `Termination failed (${res.status})` };
    }
    return { success: true, message: apiMessage || 'Member terminated successfully.' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to terminate member' };
  }
}
