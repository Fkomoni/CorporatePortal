// Approve / reject a member's pending enrolment on Prognosis. Used both for
// auto-approving HR-initiated registrations and for the Pending Enrolees
// review screen (mobile-app self-registrations awaiting HR decision).
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

async function callWithRetry(url: string): Promise<Response> {
  let token = await getServiceToken();
  const call = (t: string) => fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } });
  let res = await call(token);
  if (res.status === 401 || res.status === 403) {
    token = await getServiceToken();
    res = await call(token);
  }
  return res;
}

export async function approveEnrollee(cifNumber: string | number): Promise<ApproveResult> {
  try {
    const res = await callWithRetry(`${BASE}/api/CorporatePortal/ApproveEnrollees?parentCif=${encodeURIComponent(String(cifNumber))}`);
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');
    const recordsUpdated = Number(r?.recordsUpdated ?? r?.RecordsUpdated ?? 0) || undefined;

    if (!res.ok || (apiStatus && apiStatus !== 'success')) {
      return { success: false, error: apiMessage || `Approve failed (${res.status})` };
    }
    return { success: true, message: apiMessage, recordsUpdated };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to approve enrollee' };
  }
}

export async function rejectEnrollee(cifNumber: string | number): Promise<ApproveResult> {
  try {
    const res = await callWithRetry(`${BASE}/api/CorporatePortal/RejectEnrollees?parentCif=${encodeURIComponent(String(cifNumber))}`);
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');
    const recordsUpdated = Number(r?.recordsUpdated ?? r?.RecordsUpdated ?? 0) || undefined;

    if (!res.ok || (apiStatus && apiStatus !== 'success')) {
      return { success: false, error: apiMessage || `Reject failed (${res.status})` };
    }
    return { success: true, message: apiMessage, recordsUpdated };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to reject enrollee' };
  }
}
