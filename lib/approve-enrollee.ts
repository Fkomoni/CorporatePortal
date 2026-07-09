// Auto-approves a newly enrolled member on Prognosis so HR-initiated
// registrations don't sit in the insurer's pending queue.
import { getServiceToken } from '@/lib/corporate-welcome';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export interface ApproveResult {
  success: boolean;
  error?: string;
}

export async function approveEnrollee(cifNumber: string | number): Promise<ApproveResult> {
  try {
    let token = await getServiceToken();

    const callApi = async (t: string) =>
      fetch(`${BASE}/api/CorporatePortal/ApproveEnrollees?parentCif=${encodeURIComponent(String(cifNumber))}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
      });

    let res = await callApi(token);
    if (res.status === 401 || res.status === 403) {
      token = await getServiceToken();
      res = await callApi(token);
    }

    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');

    if (!res.ok || (apiStatus && apiStatus !== 'success')) {
      return { success: false, error: apiMessage || `Approve failed (${res.status})` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to auto-approve enrollee' };
  }
}
