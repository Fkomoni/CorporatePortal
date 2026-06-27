import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'staff') {
    return NextResponse.json({ error: 'Forbidden: Staff accounts only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit      = Math.min(parseInt(searchParams.get('limit')      ?? '100', 10), 500);
  const offset     = parseInt(searchParams.get('offset')     ?? '0', 10);
  const companyId  = searchParams.get('companyId')  ?? undefined;
  const loginType  = searchParams.get('loginType')  ?? undefined;
  const action     = searchParams.get('action')     ?? undefined;
  const search     = searchParams.get('search')     ?? undefined;

  const where = {
    ...(companyId ? { companyId } : {}),
    ...(loginType ? { loginType } : {}),
    ...(action    ? { action }    : {}),
    ...(search    ? {
      OR: [
        { userEmail:   { contains: search, mode: 'insensitive' as const } },
        { userName:    { contains: search, mode: 'insensitive' as const } },
        { companyName: { contains: search, mode: 'insensitive' as const } },
        { action:      { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { timestamp: 'desc' }, take: limit, skip: offset }),
      prisma.auditLog.count({ where }),
    ]);

    void logAudit({ session, action: 'VIEW_CORPORATES', resource: 'audit-logs', request: req,
      details: { filter: { companyId, loginType, action, search }, resultCount: logs.length } });

    return NextResponse.json({ logs, total, limit, offset });
  } catch (err) {
    console.error('[admin/audit-logs] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
