import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/roles';
import { rejectEnrollee } from '@/lib/approve-enrollee';
import { getServiceToken } from '@/lib/corporate-welcome';
import { renderEmailTemplate } from '@/lib/email-template';
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

  let body: { parentCif?: string | number; principalName?: string; beneficiaryName?: string; relationship?: string; reason?: string; email?: string; cifNumbers?: (string | number)[]; terminationDate?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parentCif = String(body.parentCif ?? '').trim();
  const reason = (body.reason ?? '').trim();
  if (!parentCif) return NextResponse.json({ error: 'parentCif is required' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: 'A reason for declining is required.' }, { status: 400 });

  // RejectEnrollees requires an explicit dd/mm/yyyy termination date — HR
  // must choose it rather than have it silently default to "today".
  const terminationDate = String(body.terminationDate ?? '').trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(terminationDate)) {
    return NextResponse.json({ error: 'terminationDate (dd/mm/yyyy) is required' }, { status: 400 });
  }

  // RejectEnrollees operates on a single member's own CIF, not a family
  // grouping — reject every member in this family individually.
  const cifNumbers = [...new Set((body.cifNumbers ?? [parentCif]).map((c) => String(c).trim()).filter(Boolean))];
  const userEmail = session.user.email ?? '';

  console.log(`[pending/reject] cifNumbers=${cifNumbers.join(',')} terminationDate=${terminationDate} userEmail=${userEmail}`);

  const results = await Promise.all(
    cifNumbers.map((cifNumber) => rejectEnrollee({ cifNumber, reason, userEmail, effectiveDate: terminationDate })),
  );
  const failures = results.filter((r) => !r.success);
  const recordsUpdated = results.reduce((sum, r) => sum + (r.recordsUpdated ?? 0), 0) || undefined;

  console.log(`[pending/reject] result: ${failures.length === 0 ? 'success' : 'failed'} recordsUpdated=${recordsUpdated ?? 0} errors=${failures.map((f) => f.error).join('; ')}`);

  void logAudit({
    session, request: req, resource: 'members',
    action: failures.length === 0 ? 'REJECT_PENDING_ENROLEE' : 'REJECT_PENDING_ENROLEE_FAILED',
    details: { parentCif, principalName: body.principalName, beneficiaryName: body.beneficiaryName, relationship: body.relationship, reason, cifNumbers, terminationDate, recordsUpdated, errors: failures.map((f) => f.error) },
  });

  if (failures.length > 0) return NextResponse.json({ error: failures[0].error ?? 'Rejection failed', failedCifs: failures.length }, { status: 422 });
  const result = { message: undefined as string | undefined, recordsUpdated };

  // Best-effort notification to the applicant — never blocks the rejection itself
  if (body.email) {
    try {
      const svcToken = await getServiceToken();
      const emailBody = renderEmailTemplate({
        category: 'Enrolment',
        eyebrow: 'Registration Update',
        headline: 'Registration Not Approved',
        body: `Your recent registration${body.beneficiaryName ? ` for <strong style="color:#131C4E;">${body.beneficiaryName}</strong>` : (body.principalName ? ` for ${body.principalName}` : '')} could not be approved by your HR department.`,
        highlight: `<span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#991B1B;margin-bottom:6px;">Reason</span><span style="display:block;font-size:14px;color:#374151;">${reason}</span>`,
        footnote: 'If you believe this was in error, please contact your HR department directly.',
      });

      await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${svcToken}` },
        body: JSON.stringify({
          EmailAddress: body.email, CC: '', BCC: '',
          Subject: 'Update on Your Corporate Portal Registration',
          MessageBody: emailBody, Attachments: null, Category: '',
          UserId: 0, ProviderId: 0, ServiceId: 0, Reference: '', TransactionType: '',
        }),
      });
    } catch (e) {
      console.warn('[pending/reject] Applicant notification email failed:', e);
    }
  }

  return NextResponse.json({ success: true, message: result.message, recordsUpdated: result.recordsUpdated });
}
