// Terminates a member's cover in Prognosis. HR chooses an effective date of
// today or later — Prognosis's TerminateMember only takes a CIF, so the date
// is validated here and recorded in the audit log for traceability, even
// though it isn't sent upstream.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { isAdminRole } from '@/lib/roles';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getServiceToken(): Promise<string> {
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

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  let body: { cifNumber?: string | number; effectiveDate?: string; memberName?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const cifNumber = String(body.cifNumber ?? '').trim();
  const effectiveDate = String(body.effectiveDate ?? '').trim();

  if (!cifNumber) return NextResponse.json({ error: 'CIF number is required.' }, { status: 400 });
  if (!effectiveDate) return NextResponse.json({ error: 'Effective date is required.' }, { status: 400 });

  // Only today or a future date is allowed — no backdated terminations
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const chosen = new Date(effectiveDate); chosen.setHours(0, 0, 0, 0);
  if (isNaN(chosen.getTime())) return NextResponse.json({ error: 'Invalid effective date.' }, { status: 400 });
  if (chosen < today) return NextResponse.json({ error: 'Effective date must be today or a future date.' }, { status: 400 });

  try {
    let token = await getServiceToken();

    const callApi = async (t: string) =>
      fetch(`${BASE}/api/CorporatePortal/TerminateMember`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ CifNumber: Number(cifNumber) || cifNumber }),
      });

    let res = await callApi(token);
    if (res.status === 401 || res.status === 403) {
      cachedToken = null; tokenExpiry = 0;
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
      void logAudit({ session, action: 'TERMINATE_MEMBER_FAILED', resource: 'members', request: req,
        details: { cifNumber, effectiveDate, memberName: body.memberName, error: apiMessage || `HTTP ${res.status}` } });
      return NextResponse.json({ error: apiMessage || `Termination failed (${res.status})` }, { status: res.ok ? 422 : res.status });
    }

    void logAudit({ session, action: 'TERMINATE_MEMBER', resource: 'members', request: req,
      details: { cifNumber, effectiveDate, memberName: body.memberName } });

    return NextResponse.json({ success: true, message: apiMessage || 'Member terminated successfully.' });
  } catch (err) {
    console.error('[members/terminate] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to terminate member' }, { status: 500 });
  }
}
