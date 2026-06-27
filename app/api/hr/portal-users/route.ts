import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
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
