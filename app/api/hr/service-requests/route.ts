// Service Desk requests, stored in Postgres.
//   GET  ?limit=N → { requests } newest-first for the signed-in company
//   POST { category, subject, description } → { request }
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { REQUEST_CATEGORIES, FALLBACK_CATEGORY, routeFor } from '@/lib/service-request-routes';
import { sendServiceRequestEmail } from '@/lib/service-request-mail';

// REQ-0007-style reference derived from the atomically allocated sequence.
function refFor(seq: number): string {
  return `REQ-${String(seq).padStart(4, '0')}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shape(r: any) {
  return {
    id: r.id,
    ticketId: refFor(r.seq),
    category: r.category,
    subject: r.subject,
    description: r.description,
    status: r.status,
    submittedDate: r.createdAt.toISOString().slice(0, 10),
    lastUpdated: r.updatedAt.toISOString().slice(0, 10),
    createdByName: r.createdByName,
  };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  const limitRaw = new URL(req.url).searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitRaw ?? '100', 10) || 100, 1), 200);

  try {
    const rows = await prisma.serviceRequest.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({ requests: rows.map(shape) });
  } catch (err) {
    console.error('[hr/service-requests] GET error:', err);
    return NextResponse.json({ error: 'Failed to load requests' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  let body: { category?: string; subject?: string; description?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const subject = String(body.subject ?? '').trim().slice(0, 200);
  const description = String(body.description ?? '').trim().slice(0, 5000);
  const category = REQUEST_CATEGORIES.includes(String(body.category))
    ? String(body.category)
    : FALLBACK_CATEGORY;
  if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });

  let created;
  try {
    created = await prisma.serviceRequest.create({
      data: {
        groupId,
        category,
        subject,
        description,
        createdByName: session.user.name ?? '',
        createdByEmail: session.user.email ?? '',
      },
    });
  } catch (err) {
    console.error('[hr/service-requests] POST error:', err);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }

  const reference = refFor(created.seq);

  // The request is saved and already visible to HR, so routing it is a
  // best-effort step that runs after the write and never fails the response.
  // `notified` tells HR whether the team actually has it, instead of promising
  // a response to an email that bounced.
  const route = routeFor(category);
  const mail = route
    ? await sendServiceRequestEmail({
        route,
        reference,
        companyName: session.user.companyName ?? '',
        groupId,
        hrName: session.user.name ?? '',
        hrEmail: session.user.email ?? '',
        requestSubject: subject,
        details: description,
        submittedAt: created.createdAt,
      })
    : { sent: false, to: '', cc: '' };

  await logAudit({
    session,
    action: 'CREATE_SERVICE_REQUEST',
    resource: reference,
    details: { category, subject, routedTo: mail.to, cc: mail.cc, emailSent: mail.sent },
    request: req,
  });

  return NextResponse.json({ request: shape(created), notified: mail.sent });
}
