// Terminates a single dependant (beneficiary) via Prognosis's
// EnrolleeProfile/TerminateBeneficiary — unlike TerminateMember (used for
// principals), this endpoint accepts an effective date and a reason, so
// dependant terminations don't need the ScheduledTermination workaround.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { isAdminRole } from '@/lib/roles';
import { cacheBust } from '@/lib/server-cache';

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

export interface TerminateBeneficiaryPayload {
  enrolleeId: string;
  cifNumber?: string | number;
  effectiveDate: string;
  reason: string;
  memberName?: string;
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

  let body: TerminateBeneficiaryPayload;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { enrolleeId, effectiveDate, reason, memberName } = body;
  if (!enrolleeId) return NextResponse.json({ error: 'enrolleeId is required' }, { status: 400 });
  if (!effectiveDate) return NextResponse.json({ error: 'Effective date is required' }, { status: 400 });
  if (!reason?.trim()) return NextResponse.json({ error: 'A reason for termination is required' }, { status: 400 });

  const groupId = session.user.companyId ?? '';

  try {
    const token = await getServiceToken();

    const profileRes = await fetch(
      `${BASE}/api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID?enrolleeid=${encodeURIComponent(enrolleeId)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    const profileText = await profileRes.text();
    let profileRaw: unknown;
    try { profileRaw = JSON.parse(profileText); } catch { profileRaw = null; }
    if (!profileRes.ok || !profileRaw) {
      return NextResponse.json({ error: `Could not load current member record (${profileRes.status})` }, { status: 502 });
    }
    const p = profileRaw as Record<string, unknown>;
    const row = ((p?.result ?? p?.Result ?? p?.data ?? p?.Data ?? p) as Record<string, unknown>) ?? {};

    const cifNumber = body.cifNumber ?? row['Cif_Number'] ?? row['CIF_Number'] ?? row['CifNo'] ?? row['Cif'] ?? row['cifNumber'];

    const beneficiary = {
      ...row,
      groupid: Number(groupId) || groupId || row['groupid'] || row['GroupId'] || 0,
      Cif_number: Number(cifNumber) || cifNumber || 0,
      Effectivedate: effectiveDate,
      Reason: reason.trim(),
      Activated: false,
    };

    const res = await fetch(`${BASE}/api/EnrolleeProfile/TerminateBeneficiary`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ AddBeneficiary: [beneficiary] }),
    });
    const text = await res.text();
    console.log(`[hr/members/terminate-beneficiary] Prognosis HTTP ${res.status}: ${text.slice(0, 500)}`);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;

    if (!res.ok) {
      const msg = r?.Message ?? r?.message ?? r?.error ?? r?.Error ?? text.slice(0, 300);
      void logAudit({ session, action: 'TERMINATE_BENEFICIARY_FAILED', resource: 'members', request: req,
        details: { enrolleeId, cifNumber, effectiveDate, reason, memberName, error: String(msg) } });
      return NextResponse.json({ error: String(msg) }, { status: res.status });
    }

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');
    if (apiStatus && apiStatus !== 'success' && apiStatus !== '200') {
      void logAudit({ session, action: 'TERMINATE_BENEFICIARY_FAILED', resource: 'members', request: req,
        details: { enrolleeId, cifNumber, effectiveDate, reason, memberName, error: apiMessage } });
      return NextResponse.json({ error: apiMessage || `Termination failed (${apiStatus})` }, { status: 422 });
    }

    // Best-effort — not critical if this table isn't relevant to beneficiary terminations.
    try {
      await prisma.scheduledTermination.updateMany({
        where: { cifNumber: String(cifNumber), status: 'pending' },
        data: { status: 'completed', processedAt: new Date() },
      });
    } catch { /* no matching scheduled row — fine */ }

    void logAudit({ session, action: 'TERMINATE_BENEFICIARY', resource: 'members', request: req,
      details: { enrolleeId, cifNumber, effectiveDate, reason, memberName } });

    if (groupId) cacheBust(`members-${groupId}`);

    return NextResponse.json({ success: true, message: apiMessage || 'Beneficiary termination submitted.' });
  } catch (err) {
    console.error('[hr/members/terminate-beneficiary] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to terminate beneficiary' }, { status: 500 });
  }
}
