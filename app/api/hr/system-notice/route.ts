// The dashboard's system-notice bar. Read-only for HR — the notice itself is
// set per corporate by Leadway staff in the admin console.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session || session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  try {
    const branding = await prisma.companyBranding.findUnique({ where: { groupId } });
    const notice = branding?.systemNotice?.trim() || null;
    return NextResponse.json({ notice });
  } catch (err) {
    console.error('[hr/system-notice] Error:', err);
    // The bar simply doesn't render — never block the dashboard on this.
    return NextResponse.json({ notice: null });
  }
}
