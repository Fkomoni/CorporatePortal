// Company logo persistence (stored as a data URL per groupId).
//   GET    → { logoUrl }
//   POST   { logoDataUrl } → save
//   DELETE → remove
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

// 300 KB file → ~400 KB base64 data URL
const MAX_DATA_URL_LENGTH = 420_000;

export async function GET() {
  const session = await auth();
  if (!session || session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  const branding = await prisma.companyBranding.findUnique({ where: { groupId } });
  return NextResponse.json({ logoUrl: branding?.logoDataUrl ?? null });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  let body: { logoDataUrl?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const logoDataUrl = body.logoDataUrl ?? '';
  if (!logoDataUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Invalid image data.' }, { status: 400 });
  }
  if (logoDataUrl.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ error: 'Logo is too large — please use an image under 300 KB.' }, { status: 413 });
  }

  await prisma.companyBranding.upsert({
    where: { groupId },
    update: { logoDataUrl },
    create: { groupId, logoDataUrl },
  });

  void logAudit({ session, action: 'UPDATE_COMPANY_LOGO', resource: 'company-profile', request: req });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  await prisma.companyBranding.updateMany({ where: { groupId }, data: { logoDataUrl: null } });

  void logAudit({ session, action: 'UPDATE_COMPANY_LOGO', resource: 'company-profile', request: req, details: { removed: true } });
  return NextResponse.json({ success: true });
}
