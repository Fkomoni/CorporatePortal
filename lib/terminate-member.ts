// Shared call to Prognosis's TerminateMember — used by the immediate HR
// action and the scheduled-termination cron job.
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

export async function callTerminateMember(cifNumber: string): Promise<TerminateResult> {
  try {
    let token = await getServiceToken();

    const requestBody = JSON.stringify({ CifNumber: Number(cifNumber) || cifNumber });
    const url = `${BASE}/api/CorporatePortal/TerminateMember`;
    console.log(`[TerminateMember] → POST ${url} body=${requestBody}`);

    const callApi = async (t: string) =>
      fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: requestBody,
      });

    let res = await callApi(token);
    if (res.status === 401 || res.status === 403) {
      cachedToken = null; tokenExpiry = 0;
      token = await getServiceToken();
      res = await callApi(token);
    }

    const text = await res.text();
    console.log(`[TerminateMember] ← HTTP ${res.status}: ${text.slice(0, 500)}`);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');

    if (!res.ok || (apiStatus && apiStatus !== 'success')) {
      return { success: false, error: apiMessage || `Termination failed (${res.status})` };
    }
    return { success: true, message: apiMessage || 'Member terminated successfully.' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to terminate member' };
  }
}
