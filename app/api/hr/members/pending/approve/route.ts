import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/roles';
import { approveEnrollee } from '@/lib/approve-enrollee';
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

  let body: { parentCif?: string | number; principalName?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parentCif = String(body.parentCif ?? '').trim();
  if (!parentCif) return NextResponse.json({ error: 'parentCif is required' }, { status: 400 });

  const result = await approveEnrollee(parentCif);

  void logAudit({
    session, request: req, resource: 'members',
    action: result.success ? 'APPROVE_PENDING_ENROLEE' : 'APPROVE_PENDING_ENROLEE_FAILED',
    details: { parentCif, principalName: body.principalName, recordsUpdated: result.recordsUpdated, error: result.error },
  });

  if (!result.success) return NextResponse.json({ error: result.error ?? 'Approval failed' }, { status: 422 });
  return NextResponse.json({ success: true, message: result.message, recordsUpdated: result.recordsUpdated });
}
