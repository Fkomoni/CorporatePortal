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

  let body: { parentCif?: string | number; principalName?: string; cifNumbers?: (string | number)[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parentCif = String(body.parentCif ?? '').trim();
  if (!parentCif) return NextResponse.json({ error: 'parentCif is required' }, { status: 400 });

  // ApproveEnrollees operates on a single member's own CIF, not a family
  // grouping — approve every member in this family (principal + dependants)
  // individually. Fall back to just the parentCif if no member list was sent.
  const cifNumbers = [...new Set((body.cifNumbers ?? [parentCif]).map((c) => String(c).trim()).filter(Boolean))];
  const userEmail = session.user.email ?? '';

  const results = await Promise.all(
    cifNumbers.map((cifNumber) => approveEnrollee({ cifNumber, reason: 'Active', userEmail })),
  );
  const failures = results.filter((r) => !r.success);
  const recordsUpdated = results.reduce((sum, r) => sum + (r.recordsUpdated ?? 0), 0) || undefined;

  void logAudit({
    session, request: req, resource: 'members',
    action: failures.length === 0 ? 'APPROVE_PENDING_ENROLEE' : 'APPROVE_PENDING_ENROLEE_FAILED',
    details: { parentCif, principalName: body.principalName, cifNumbers, recordsUpdated, errors: failures.map((f) => f.error) },
  });

  if (failures.length > 0) {
    return NextResponse.json({ error: failures[0].error ?? 'Approval failed', failedCifs: failures.length }, { status: 422 });
  }
  return NextResponse.json({ success: true, recordsUpdated });
}
