// Lets Leadway staff revoke or restore an HR admin's portal login for a
// specific corporate group. Scoped to role='hr_admin' so this never touches
// manually invited sub-users (Viewer, Finance, custom roles) under the group.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.loginType !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { groupId?: string; active?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { groupId, active } = body;
  if (!groupId || typeof active !== 'boolean') {
    return NextResponse.json({ error: 'groupId and active are required' }, { status: 400 });
  }

  try {
    const result = await prisma.user.updateMany({
      where: { companyId: String(groupId), role: 'hr_admin' },
      data: { active },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'No HR admin account found for this group.' }, { status: 404 });
    }

    void logAudit({ session, action: 'TOGGLE_USER_STATUS', resource: 'corporates', request: req,
      details: { groupId, newStatus: active ? 'Active' : 'Inactive', accountsUpdated: result.count } });

    return NextResponse.json({ success: true, active, accountsUpdated: result.count });
  } catch (err) {
    console.error('[admin/corporates/toggle-hr-access] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update HR access' }, { status: 500 });
  }
}
