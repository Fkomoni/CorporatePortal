// Changing an HR user's password on Prognosis.
//
// ChangePassword's model is { OldPassword, NewPassword, ConfirmPassword } with
// no username or email, so it acts on whoever the bearer token belongs to. The
// portal's own token is the shared integration account's, which is why calling
// it with that token could never change the signed-in user's password, and
// would have changed the integration account's if it had worked.
//
// The way through is that this flow only runs when the user still knows their
// old password. That is enough to authenticate as them and get a token that is
// theirs, and ChangePassword then acts on the right account.
//
// The forgotten-password case has no old password, so it cannot get a token
// this way and is not served here: SetPassword needs whatever token Prognosis
// issues after its own OTP step, which is not yet known.
import { verifyHrPasswordWithPrognosis } from '@/lib/prognosis-hr-login';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export type ChangeOutcome =
  | 'ok'
  /** Prognosis rejected the old password. */
  | 'wrong-current'
  /** Prognosis accepted the password but would not issue a token for this user. */
  | 'no-user-token'
  /** Prognosis refused the change itself. */
  | 'refused'
  /** Nothing was verified either way. */
  | 'unreachable';

export interface ChangeResult {
  outcome: ChangeOutcome;
  /** For the server log. Never shown to the user verbatim. */
  detail: string;
}

const TOKEN_KEYS = ['accessToken', 'token', 'AccessToken', 'Token', 'bearer', 'Bearer', 'bearerToken', 'BearerToken', 'access_token'];

/**
 * Digs a bearer token out of a login response. The two endpoints wrap their
 * payload differently, and ExternalPortalLogin puts the user record inside a
 * result array, so the wrapper, its first element and the top level are all
 * searched rather than assuming one shape.
 */
function tokenFrom(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  const wrapper = (d.data ?? d.Data ?? d.result ?? d.Result ?? null) as unknown;
  const candidates: Record<string, unknown>[] = [d];
  if (wrapper && typeof wrapper === 'object') {
    if (Array.isArray(wrapper)) {
      if (wrapper[0] && typeof wrapper[0] === 'object') candidates.push(wrapper[0] as Record<string, unknown>);
    } else {
      candidates.push(wrapper as Record<string, unknown>);
    }
  }
  for (const c of candidates) {
    for (const k of TOKEN_KEYS) {
      const v = c[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return '';
}

/**
 * Logs in as the user to obtain a token scoped to their own account.
 *
 * Two endpoints are tried because it is not documented which issues a bearer
 * token for an HR user. ExternalPortalLogin comes first: it is the one built for
 * portal users and the one sign-in already verifies against, so it is the more
 * likely of the two to answer for this account. ApiUsers/Login is the service
 * account's login, tried second in case it accepts these credentials too.
 *
 * Returns '' when Prognosis accepts the credentials but hands back no token,
 * which is a different problem from the password being wrong. The log says which
 * endpoint answered, so the loser can be dropped once that is known.
 */
interface UserSession {
  token: string;
  /** Cookie header to replay, when Prognosis authenticates by session. */
  cookie: string;
}

async function userToken(email: string, password: string): Promise<UserSession> {
  const attempts: { path: string; body: string }[] = [
    {
      path: '/api/Account/ExternalPortalLogin',
      body: JSON.stringify({ UserName: email, Password: password, RememberMe: true, Email: email, LogInSource: 'CorporatePortal' }),
    },
    {
      path: '/api/ApiUsers/Login',
      body: JSON.stringify({ Username: email, Password: password, Email: email }),
    },
  ];

  for (const { path, body } of attempts) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
      });
      const text = await res.text();
      let data: unknown = null;
      try { data = JSON.parse(text); } catch { /* nothing to read a token out of */ }
      const token = tokenFrom(data);
      // Account/Logout sitting beside ChangePassword says this controller keeps
      // a session, so the login may authenticate by cookie and return no token
      // at all. Whatever it sets is replayed on the change.
      const cookie = (res.headers?.getSetCookie?.() ?? [])
        .map((c: string) => c.split(';')[0])
        .join('; ');
      console.log(`[change-password] ${path} for ${email} → HTTP ${res.status}, token ${token ? 'issued' : 'none'}, cookie ${cookie ? 'set' : 'none'}`);
      if (token || cookie) return { token, cookie };
    } catch (e) {
      console.warn(`[change-password] ${path} for ${email} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { token: '', cookie: '' };
}

/**
 * Changes the password Prognosis holds for one HR user.
 *
 * Never writes anything locally: the caller updates its own hash only when this
 * returns 'ok', so the two sides cannot be left disagreeing.
 */
export async function changePrognosisPassword(
  email: string,
  oldPassword: string,
  newPassword: string,
): Promise<ChangeResult> {
  // The old password is checked against Prognosis first. Without this a wrong
  // current password would surface as a failure to get a token, which reads
  // like an outage rather than a typo.
  const check = await verifyHrPasswordWithPrognosis(email, oldPassword);
  if (check.outcome === 'unreachable') return { outcome: 'unreachable', detail: check.detail };
  if (check.outcome !== 'ok') return { outcome: 'wrong-current', detail: check.detail };

  let session: UserSession;
  try {
    session = await userToken(email, oldPassword);
  } catch (e) {
    return { outcome: 'unreachable', detail: e instanceof Error ? e.message : String(e) };
  }
  if (!session.token && !session.cookie) {
    return {
      outcome: 'no-user-token',
      detail: 'the login accepted these credentials but issued neither a bearer token nor a session cookie',
    };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (session.cookie) headers.Cookie = session.cookie;
  const body = JSON.stringify({ OldPassword: oldPassword, NewPassword: newPassword, ConfirmPassword: newPassword });

  // Swagger groups ChangePassword under the Account controller alongside
  // ExternalPortalLogin and Logout, but renders it as a bare "/ChangePassword",
  // so both readings are tried. A 404 on one is not a refusal: it means the
  // route is the other one. The log names whichever answered.
  const paths = ['/api/Account/ChangePassword', '/api/ChangePassword'];
  let lastDetail = '';

  for (const path of paths) {
    let res: Response;
    let text: string;
    try {
      res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body });
      text = await res.text();
    } catch (e) {
      lastDetail = e instanceof Error ? e.message : String(e);
      continue;
    }
    console.log(`[change-password] ${path} for ${email} → HTTP ${res.status}: ${text.slice(0, 300)}`);

    if (res.status === 404 || res.status === 405) { lastDetail = `${path}: HTTP ${res.status}`; continue; }
    if (res.status >= 500) return { outcome: 'unreachable', detail: `${path}: HTTP ${res.status}: ${text.slice(0, 200)}` };

    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const bodyStatus = r.status ?? r.Status;
    const message = String(r.message ?? r.Message ?? r.ErrorMessage ?? '');

    // This family answers HTTP 200 with the failure in the body, so the status
    // code alone would report a refusal as a successful change.
    const refused = !res.ok
      || (bodyStatus != null && Number(bodyStatus) >= 400)
      || /error|invalid|fail|incorrect|not match/i.test(message);
    if (refused) return { outcome: 'refused', detail: `${path}: HTTP ${res.status}: ${message || text.slice(0, 200)}` };

    return { outcome: 'ok', detail: `${path}: ${message || 'changed'}` };
  }

  // Neither path existed, which is a wiring problem rather than a refusal.
  return { outcome: 'refused', detail: `no ChangePassword route answered. ${lastDetail}` };
}
