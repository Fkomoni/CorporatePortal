import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  let body: { token?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const token = String(body.token ?? '').trim();
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

  const invitation = await prisma.memberInvitation.findUnique({ where: { token } });
  if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  if (invitation.groupId !== session.user.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.memberInvitation.delete({ where: { token } });

  void logAudit({
    session, request: req, resource: 'members', action: 'DELETE_PENDING_INVITATION',
    details: { email: invitation.email, employeeCode: invitation.employeeCode, inviteType: invitation.inviteType },
  });

  return NextResponse.json({ success: true });
}
