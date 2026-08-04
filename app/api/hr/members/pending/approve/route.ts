import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/roles';
import { approveEnrollee } from '@/lib/approve-enrollee';
import { getPolicyYearStart, formatPolicyYearStart } from '@/lib/policy-year';
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

  let body: { parentCif?: string | number; principalName?: string; beneficiaryName?: string; relationship?: string; dateOfBirth?: string; cifNumbers?: (string | number)[]; effectiveDate?: string; backdateAcknowledged?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parentCif = String(body.parentCif ?? '').trim();
  const attemptTag = `cifs=${(body.cifNumbers ?? []).join(',')} parentCif=${parentCif} user=${session.user.email ?? ''}`;
  if (!parentCif) {
    console.error(`[pending/approve] REJECTED (${attemptTag}): parentCif is required`);
    return NextResponse.json({ error: 'parentCif is required' }, { status: 400 });
  }

  // ApproveEnrollees requires an explicit dd/mm/yyyy effective date — it
  // drives the member's waiting period on Prognosis, so HR must choose it
  // rather than have it silently default to "today".
  const effectiveDate = String(body.effectiveDate ?? '').trim();
  const dmy = effectiveDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dmy) {
    console.error(`[pending/approve] REJECTED (${attemptTag}): effectiveDate missing/malformed ("${effectiveDate}")`);
    return NextResponse.json({ error: 'effectiveDate (dd/mm/yyyy) is required' }, { status: 400 });
  }
  // Backdating IS allowed here — a member who registered against an invitation
  // dated (say) 1 July but only gets approved in August must still have cover
  // effective from 1 July, otherwise the date HR committed to when issuing the
  // link is silently lost. Two bounds apply: the date can never precede the
  // group's current policy year (cover outside a rated period), and any past
  // date needs HR's acknowledgement of the backdate warning (Leadway settles
  // no claims incurred before the valid enrolment date).
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const effectiveDateVal = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const effectiveIso = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const policyYearStart = await getPolicyYearStart(session.user.companyId ?? '');
  if (effectiveIso < policyYearStart) {
    console.error(`[pending/approve] REJECTED (${attemptTag}): effectiveDate ${effectiveIso} precedes policy year start ${policyYearStart}`);
    return NextResponse.json({ error: `Effective date cannot be earlier than the start of the current policy year (${formatPolicyYearStart(policyYearStart)}).` }, { status: 400 });
  }
  if (effectiveDateVal < todayMidnight && !body.backdateAcknowledged) {
    console.error(`[pending/approve] REJECTED (${attemptTag}): backdated to ${effectiveIso} without acknowledgement`);
    return NextResponse.json({ error: 'You must acknowledge the backdated enrolment warning before proceeding.' }, { status: 400 });
  }

  // ApproveEnrollees operates on a single member's own CIF, not a family
  // grouping — approve every member in this family (principal + dependants)
  // individually. Fall back to just the parentCif if no member list was sent.
  const cifNumbers = [...new Set((body.cifNumbers ?? [parentCif]).map((c) => String(c).trim()).filter(Boolean))];
  const userEmail = session.user.email ?? '';

  console.log(`[pending/approve] cifNumbers=${cifNumbers.join(',')} effectiveDate=${effectiveDate} userEmail=${userEmail}`);

  // Possible-duplicate detection for dependants: a self-registration via the
  // Enrolee App never passes through add-dependents' checks, so approval is the
  // last place to notice the same dependant registered twice under one
  // principal. Matching is by date of birth.
  //
  // This is deliberately NON-BLOCKING. It used to return 409 and refuse the
  // approval, which made dependants unapprovable while principals went through
  // fine: a principal is compared against its own family (itself excluded, so
  // it rarely matches), whereas a dependant is compared against its real
  // siblings — and twins share a date of birth. HR had no way to override a
  // false positive. The match is now reported back as a warning so HR can act
  // on a genuine duplicate, without the approval itself being blocked.
  const groupId = session.user.companyId ?? '';
  let duplicateWarning: string | null = null;
  if (body.dateOfBirth && cifNumbers.length === 1 && groupId) {
    try {
      const token = await getServiceToken();
      const family = await getPrincipalFamily(BASE, token, groupId, parentCif);
      const dupe = findDuplicateDependent(family, body.dateOfBirth, cifNumbers[0]);
      console.log(`[pending/approve] dependant dedup (${attemptTag}): dob=${body.dateOfBirth} familySize=${family.length} match=${dupe ? `${dupe.name}/${dupe.cifNumber}` : 'none'}`);
      if (dupe) {
        duplicateWarning = `Another member under this principal shares this date of birth (${dupe.name}, CIF ${dupe.cifNumber}). If this is a duplicate registration rather than e.g. a twin, terminate the extra record.`;
        console.warn(`[pending/approve] possible duplicate (${attemptTag}): ${dupe.name}/${dupe.cifNumber} — approving anyway`);
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
  // Prognosis files every decision under one account, not the HR user who made
  // it — record which, so the real actor stays traceable on our side.
  const attributedTo = results.find((r) => r.prognosisUserEmail)?.prognosisUserEmail ?? null;

  console.log(`[pending/approve] result: ${failures.length === 0 ? 'success' : 'failed'} recordsUpdated=${recordsUpdated ?? 0} errors=${failures.map((f) => f.error).join('; ')}`);

  void logAudit({
    session, request: req, resource: 'members',
    action: failures.length === 0 ? 'APPROVE_PENDING_ENROLEE' : 'APPROVE_PENDING_ENROLEE_FAILED',
    details: { parentCif, principalName: body.principalName, beneficiaryName: body.beneficiaryName, relationship: body.relationship, cifNumbers, effectiveDate, recordsUpdated, prognosisAttributedTo: attributedTo, errors: failures.map((f) => f.error) },
  });

  if (failures.length > 0) {
    return NextResponse.json({ error: failures[0].error ?? 'Approval failed', failedCifs: failures.length }, { status: 422 });
  }
  return NextResponse.json({ success: true, recordsUpdated, duplicateWarning, attributedTo });
}
