import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/roles';
import { approveEnrollee } from '@/lib/approve-enrollee';
import { getServiceToken } from '@/lib/corporate-welcome';
import { getPrincipalFamily, findDuplicateDependent } from '@/lib/dependent-checks';
import { logAudit } from '@/lib/audit';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  let body: { parentCif?: string | number; principalName?: string; beneficiaryName?: string; relationship?: string; dateOfBirth?: string; cifNumbers?: (string | number)[]; effectiveDate?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parentCif = String(body.parentCif ?? '').trim();
  if (!parentCif) return NextResponse.json({ error: 'parentCif is required' }, { status: 400 });

  // ApproveEnrollees requires an explicit dd/mm/yyyy effective date — it
  // drives the member's waiting period on Prognosis, so HR must choose it
  // rather than have it silently default to "today".
  const effectiveDate = String(body.effectiveDate ?? '').trim();
  const dmy = effectiveDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dmy) {
    return NextResponse.json({ error: 'effectiveDate (dd/mm/yyyy) is required' }, { status: 400 });
  }
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const effectiveDateVal = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  if (effectiveDateVal < todayMidnight) {
    return NextResponse.json({ error: 'Effective date cannot be in the past.' }, { status: 400 });
  }

  // ApproveEnrollees operates on a single member's own CIF, not a family
  // grouping — approve every member in this family (principal + dependants)
  // individually. Fall back to just the parentCif if no member list was sent.
  const cifNumbers = [...new Set((body.cifNumbers ?? [parentCif]).map((c) => String(c).trim()).filter(Boolean))];
  const userEmail = session.user.email ?? '';

  console.log(`[pending/approve] cifNumbers=${cifNumbers.join(',')} effectiveDate=${effectiveDate} userEmail=${userEmail}`);

  // Self-registrations via the Enrolee App never go through add-dependents'
  // dedup check, so approval is the only checkpoint left to catch a
  // dependant who was accidentally (or duplicately) registered twice under
  // the same principal — match by date of birth against the family Prognosis
  // already has active.
  const groupId = session.user.companyId ?? '';
  if (body.dateOfBirth && cifNumbers.length === 1 && groupId) {
    try {
      const token = await getServiceToken();
      const family = await getPrincipalFamily(BASE, token, groupId, parentCif);
      const dupe = findDuplicateDependent(family, body.dateOfBirth, cifNumbers[0]);
      if (dupe) {
        return NextResponse.json({ error: `A dependant matching this date of birth (${body.dateOfBirth}) already exists under this principal (${dupe.name}, CIF ${dupe.cifNumber}). Please verify this isn't a duplicate registration before approving.` }, { status: 409 });
      }
    } catch (e) {
      console.warn('[pending/approve] Dependent dedup check failed, proceeding without it:', e);
    }
  }

  const results = await Promise.all(
    cifNumbers.map((cifNumber) => approveEnrollee({ cifNumber, reason: 'Active', userEmail, effectiveDate })),
  );
  const failures = results.filter((r) => !r.success);
  const recordsUpdated = results.reduce((sum, r) => sum + (r.recordsUpdated ?? 0), 0) || undefined;

  console.log(`[pending/approve] result: ${failures.length === 0 ? 'success' : 'failed'} recordsUpdated=${recordsUpdated ?? 0} errors=${failures.map((f) => f.error).join('; ')}`);

  void logAudit({
    session, request: req, resource: 'members',
    action: failures.length === 0 ? 'APPROVE_PENDING_ENROLEE' : 'APPROVE_PENDING_ENROLEE_FAILED',
    details: { parentCif, principalName: body.principalName, beneficiaryName: body.beneficiaryName, relationship: body.relationship, cifNumbers, effectiveDate, recordsUpdated, errors: failures.map((f) => f.error) },
  });

  if (failures.length > 0) {
    return NextResponse.json({ error: failures[0].error ?? 'Approval failed', failedCifs: failures.length }, { status: 422 });
  }
  return NextResponse.json({ success: true, recordsUpdated });
}
