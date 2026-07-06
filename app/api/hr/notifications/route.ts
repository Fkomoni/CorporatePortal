import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULTS = {
  invoiceIssued: true,
  invoiceDue: true,
  claimUpdates: false,
  enrolmentConfirm: true,
  bulkUpload: true,
};

export async function GET() {
  const session = await auth();
  if (!session || session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prefs = await prisma.notificationPreferences.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(prefs ?? { ...DEFAULTS });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session || session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data = {
    invoiceIssued:    typeof body.invoiceIssued    === 'boolean' ? body.invoiceIssued    : DEFAULTS.invoiceIssued,
    invoiceDue:       typeof body.invoiceDue       === 'boolean' ? body.invoiceDue       : DEFAULTS.invoiceDue,
    claimUpdates:     typeof body.claimUpdates     === 'boolean' ? body.claimUpdates     : DEFAULTS.claimUpdates,
    enrolmentConfirm: typeof body.enrolmentConfirm === 'boolean' ? body.enrolmentConfirm : DEFAULTS.enrolmentConfirm,
    bulkUpload:       typeof body.bulkUpload       === 'boolean' ? body.bulkUpload       : DEFAULTS.bulkUpload,
  };

  const prefs = await prisma.notificationPreferences.upsert({
    where:  { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });

  return NextResponse.json(prefs);
}
