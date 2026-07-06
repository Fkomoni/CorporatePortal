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
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  try {
    const users = await prisma.user.findMany({
      where: { companyId: groupId },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        active:    true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    void logAudit({ session, action: 'VIEW_PORTAL_USERS', resource: 'portal-users', request: req });

    return NextResponse.json({
      users: users.map((u) => ({
        id:        u.id,
        name:      u.name,
        email:     u.email,
        role:      u.role,
        status:    u.active ? 'Active' : 'Inactive',
        lastLogin: u.updatedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    console.error('[hr/portal-users] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  let body: { userId?: string; active?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { userId, active } = body;
  if (!userId || typeof active !== 'boolean') {
    return NextResponse.json({ error: 'userId and active are required' }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true, name: true, email: true } });
    if (!target || target.companyId !== groupId) {
      return NextResponse.json({ error: 'User not found in your company' }, { status: 404 });
    }

    await prisma.user.update({ where: { id: userId }, data: { active } });

    void logAudit({ session, action: 'TOGGLE_USER_STATUS', resource: 'portal-users', request: req,
      details: { targetUserId: userId, targetUserName: target.name, targetEmail: target.email, newStatus: active ? 'Active' : 'Inactive' } });

    return NextResponse.json({ success: true, active });
  } catch (err) {
    console.error('[hr/portal-users PATCH] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update user' },
      { status: 500 }
    );
  }
}
