// Terminates a member's cover. Prognosis's TerminateMember takes no date
// parameter, so:
//   - effective date = today  → call TerminateMember immediately
//   - effective date = future → hold it in ScheduledTermination; the
//     /api/cron/process-terminations job sends it to Prognosis on that date
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { isAdminRole } from '@/lib/roles';
import { callTerminateMember } from '@/lib/terminate-member';

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
  const memberName = body.memberName;

  if (!cifNumber) return NextResponse.json({ error: 'CIF number is required.' }, { status: 400 });
  if (!effectiveDate) return NextResponse.json({ error: 'Effective date is required.' }, { status: 400 });

  // Only today or a future date is allowed — no backdated terminations
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const chosen = new Date(effectiveDate); chosen.setHours(0, 0, 0, 0);
  if (isNaN(chosen.getTime())) return NextResponse.json({ error: 'Invalid effective date.' }, { status: 400 });
  if (chosen < today) return NextResponse.json({ error: 'Effective date must be today or a future date.' }, { status: 400 });

  const groupId = session.user.companyId ?? null;

  // Future date → schedule it, don't call Prognosis yet
  if (chosen > today) {
    try {
      const scheduled = await prisma.scheduledTermination.create({
        data: {
          cifNumber, memberName, groupId,
          effectiveDate: chosen,
          requestedBy: session.user.email ?? '',
        },
      });
      void logAudit({ session, action: 'SCHEDULE_TERMINATION', resource: 'members', request: req,
        details: { cifNumber, effectiveDate, memberName } });
      return NextResponse.json({
        success: true, scheduled: true, scheduledId: scheduled.id,
        message: `Termination scheduled for ${effectiveDate}.`,
      });
    } catch (err) {
      console.error('[members/terminate] schedule error:', err);
      return NextResponse.json({ error: 'Failed to schedule termination.' }, { status: 500 });
    }
  }

  // Today → terminate immediately
  const result = await callTerminateMember(cifNumber);

  if (!result.success) {
    void logAudit({ session, action: 'TERMINATE_MEMBER_FAILED', resource: 'members', request: req,
      details: { cifNumber, effectiveDate, memberName, error: result.error } });
    return NextResponse.json({ error: result.error ?? 'Termination failed' }, { status: 422 });
  }

  void logAudit({ session, action: 'TERMINATE_MEMBER', resource: 'members', request: req,
    details: { cifNumber, effectiveDate, memberName } });

  return NextResponse.json({ success: true, scheduled: false, message: result.message });
}
