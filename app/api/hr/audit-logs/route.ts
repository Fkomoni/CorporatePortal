import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { companyId: groupId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where: { companyId: groupId } }),
    ]);

    return NextResponse.json({ logs, total, limit, offset });
  } catch (err) {
    console.error('[hr/audit-logs] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
