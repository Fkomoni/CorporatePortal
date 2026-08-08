// Prognosis is the authority on an HR user's password. Every HR sign-in is
// checked against it, and a check that does not come back 'ok' means no session.
//
// Kept in its own module with nothing but fetch in it, because both the
// NextAuth provider (reachable from Edge middleware) and the pre-login route
// need it, and neither can afford Node-only dependencies here.
//
// Three outcomes, not two. The old boolean collapsed "Prognosis says these
// credentials are wrong" and "Prognosis did not answer" into false, which meant
// an outage was reported to HR as a bad password and looked identical in the
// logs. Both still deny entry: the difference is what HR is told and what
// support can see afterwards.
const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export type HrLoginOutcome = 'ok' | 'rejected' | 'unreachable';

export interface HrLoginCheck {
  outcome: HrLoginOutcome;
  /** Why, for the server log. Never shown to the person signing in. */
  detail: string;
}

/** Success-like values seen in this API's status field. */
const OK_STATUS = ['success', 'true', '200', 'ok'];

/**
 * Verifies an email and password against Prognosis ExternalPortalLogin.
 *
 * Endpoints in this system routinely answer HTTP 200 on a rejected login with
 * the failure in a status or ErrorMessage field, so the status code alone is
 * never a pass/fail signal. Anything this function cannot read as an accepted
 * login is a denial.
 */
export async function verifyHrPasswordWithPrognosis(
  email: string,
  password: string,
): Promise<HrLoginCheck> {
  const url = `${BASE}/api/Account/ExternalPortalLogin`;
  let res: Response;
  let text: string;

  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        UserName: email,
        Password: password,
        RememberMe: true,
        Email: email,
        LogInSource: 'CorporatePortal',
      }),
    });
    text = await res.text();
  } catch (err) {
    // DNS, TLS, connection refused, timeout: nothing was verified either way.
    return { outcome: 'unreachable', detail: err instanceof Error ? err.message : String(err) };
  }

  const head = text.slice(0, 500);
  console.log(`[prognosis-hr-login] email=${email} → HTTP ${res.status}: ${head}`);

  // 5xx is Prognosis failing, not a verdict on the password. 4xx is a verdict.
  if (res.status >= 500) {
    return { outcome: 'unreachable', detail: `HTTP ${res.status}: ${head}` };
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // An HTML error page or a proxy notice: no verdict was expressed. Treating
    // this as a rejection would tell HR their password is wrong during an
    // outage, so it is reported as unreachable and still denied.
    return { outcome: 'unreachable', detail: `non-JSON response (HTTP ${res.status}): ${head}` };
  }

  if (!res.ok) {
    return { outcome: 'rejected', detail: `HTTP ${res.status}: ${head}` };
  }

  const status = String(data?.status ?? data?.Status ?? '').toLowerCase();
  if (status && !OK_STATUS.includes(status)) {
    return { outcome: 'rejected', detail: `status=${status}` };
  }
  if (data?.ErrorMessage || data?.errorMessage || data?.error || data?.Error) {
    return { outcome: 'rejected', detail: 'error field present in response' };
  }

  const payload = (data?.result ?? data?.Result ?? data?.data ?? data?.Data) as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;
  if (!payload) {
    return { outcome: 'rejected', detail: 'no result/data wrapper in response' };
  }

  const record = Array.isArray(payload) ? (payload[0] as Record<string, unknown>) : payload;
  if (!record || typeof record !== 'object') {
    return { outcome: 'rejected', detail: 'wrapper payload is not an object' };
  }

  // An accepted login comes back describing the user. Without both an address
  // and an id there is no evidence the password was accepted.
  const emailRaw = record.email ?? record.Email ?? record.EmailAddress ?? null;
  const idRaw = record.id ?? record.Id ?? record.userId ?? record.UserId ?? null;
  if (!emailRaw || !idRaw) {
    return { outcome: 'rejected', detail: `missing email/id in record, keys=${Object.keys(record).join(',')}` };
  }

  return { outcome: 'ok', detail: 'accepted' };
}
