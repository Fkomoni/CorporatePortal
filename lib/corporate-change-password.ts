// Calls Prognosis's ChangePassword to keep it in sync with our local hash.
// ChangePassword's model only takes Old/New/ConfirmPassword — no
// email/username — so it's called with the shared service token, the same
// way every other Prognosis call in this app authenticates.
const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
  raw?: unknown;
}

export async function callPrognosisChangePassword(
  token: string,
  oldPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const requestBody = JSON.stringify({
    OldPassword: oldPassword,
    NewPassword: newPassword,
    ConfirmPassword: newPassword,
  });

  const url = `${BASE}/api/ChangePassword`;
  console.log(`[ChangePassword] → POST ${url}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: requestBody,
    });
    const text = await res.text();
    console.log(`[ChangePassword] ← HTTP ${res.status}: ${text.slice(0, 500)}`);

    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;

    const bodyStatus = r?.status ?? r?.Status;
    const message = String(r?.message ?? r?.Message ?? r?.ErrorMessage ?? '');
    const looksFailed = !res.ok || (bodyStatus != null && Number(bodyStatus) >= 400) || /error|invalid|fail/i.test(message);

    if (looksFailed) {
      return { success: false, error: message || `Prognosis error (${res.status})`, raw };
    }
    return { success: true, raw };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to reach Prognosis', raw: undefined };
  }
}
