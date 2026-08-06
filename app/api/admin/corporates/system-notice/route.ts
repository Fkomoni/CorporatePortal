// Lets Leadway staff set (or clear) the announcement shown in the system
// notice bar on a corporate's dashboard.
//   GET  ?groupId=X          → { notice }
//   POST { groupId, notice } → { success } (empty/blank notice clears the bar)
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.loginType !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const groupId = new URL(req.url).searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'groupId is required' }, { status: 400 });

  const branding = await prisma.companyBranding.findUnique({ where: { groupId } });
  return NextResponse.json({ notice: branding?.systemNotice ?? '' });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.loginType !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { groupId?: string; notice?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const groupId = String(body.groupId ?? '').trim();
  if (!groupId) return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
  const notice = String(body.notice ?? '').trim().slice(0, 500);

  try {
    await prisma.companyBranding.upsert({
      where: { groupId },
      create: { groupId, systemNotice: notice || null },
      update: { systemNotice: notice || null },
    });
    await logAudit({
      session,
      action: 'UPDATE_SYSTEM_NOTICE',
      resource: groupId,
      details: notice ? { set: notice.slice(0, 120) } : { cleared: true },
      request: req,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/corporates/system-notice] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save notice' }, { status: 500 });
  }
}
