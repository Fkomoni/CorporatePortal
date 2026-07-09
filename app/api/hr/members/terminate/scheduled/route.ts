// List / cancel pending scheduled terminations for the HR's company.
//   GET  ?cifNumber=...  → pending schedule for a specific member (or all if omitted)
//   DELETE { id }        → cancel a pending scheduled termination
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { isAdminRole } from '@/lib/roles';

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  const { searchParams } = new URL(req.url);
  const cifNumber = searchParams.get('cifNumber');

  const rows = await prisma.scheduledTermination.findMany({
    where: {
      status: 'pending',
      ...(groupId ? { groupId } : {}),
      ...(cifNumber ? { cifNumber } : {}),
    },
    orderBy: { effectiveDate: 'asc' },
  });

  return NextResponse.json({ scheduled: rows });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  let body: { id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const groupId = session.user.companyId;
  const row = await prisma.scheduledTermination.findUnique({ where: { id: body.id } });
  if (!row || (groupId && row.groupId !== groupId)) {
    return NextResponse.json({ error: 'Scheduled termination not found' }, { status: 404 });
  }
  if (row.status !== 'pending') {
    return NextResponse.json({ error: 'This termination has already been processed and cannot be cancelled.' }, { status: 409 });
  }

  await prisma.scheduledTermination.update({ where: { id: row.id }, data: { status: 'cancelled', processedAt: new Date() } });

  void logAudit({ session, action: 'CANCEL_SCHEDULED_TERMINATION', resource: 'members', request: req,
    details: { cifNumber: row.cifNumber, memberName: row.memberName, effectiveDate: row.effectiveDate } });

  return NextResponse.json({ success: true });
}
