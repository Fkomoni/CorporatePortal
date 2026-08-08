// Reads and answers one service request from its emailed link.
//
// Deliberately unauthenticated: Leadway staff answer from their inbox and do
// not hold portal logins, and the link is often forwarded to whoever actually
// owns the answer. The token is the whole authorisation, so this route must
// never widen beyond the single request it names. It returns that request's own
// fields and nothing that would let a holder reach another company's data.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isResponseStatus, MAX_RESPONSE_LENGTH, tokenRefusal,
} from '@/lib/service-request-response';

function refFor(seq: number): string {
  return `REQ-${String(seq).padStart(4, '0')}`;
}

/** Only the fields needed to answer. No member data, no other requests. */
function shape(r: {
  seq: number; category: string; subject: string; description: string;
  status: string; createdByName: string; createdByEmail: string;
  attachmentNames: string[]; createdAt: Date;
  responses?: { id: string; body: string; authorName: string | null; status: string; createdAt: Date }[];
}) {
  return {
    reference: refFor(r.seq),
    category: r.category,
    subject: r.subject,
    description: r.description,
    status: r.status,
    raisedBy: r.createdByName || r.createdByEmail,
    raisedByEmail: r.createdByEmail,
    attachmentNames: r.attachmentNames,
    createdAt: r.createdAt.toISOString(),
    // Oldest first, so the page reads as a conversation.
    responses: (r.responses ?? []).map((x) => ({
      id: x.id,
      body: x.body,
      authorName: x.authorName,
      status: x.status,
      createdAt: x.createdAt.toISOString(),
    })),
  };
}

/** Every reply on a request, oldest first. */
const withResponses = {
  responses: { orderBy: { createdAt: 'asc' } },
} as const;

export async function GET(req: Request) {
  const token = (new URL(req.url).searchParams.get('token') ?? '').trim();
  if (!token) return NextResponse.json({ error: 'Missing link token.' }, { status: 400 });

  const request = await prisma.serviceRequest.findUnique({
    where: { responseToken: token },
    include: withResponses,
  });
  // The same message whether the token is wrong or unknown: a responder cannot
  // tell a mistyped link from one that never existed, and neither can anyone
  // probing for valid tokens.
  if (!request) return NextResponse.json({ error: 'This link is not valid.' }, { status: 404 });

  const refusal = tokenRefusal(request, new Date());
  if (refusal) return NextResponse.json({ error: refusal, request: shape(request) }, { status: 410 });

  return NextResponse.json({ request: shape(request) });
}

export async function POST(req: Request) {
  let body: { token?: string; response?: string; status?: string; responderName?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  const response = (body.response ?? '').trim();
  const status = body.status ?? '';
  const responderName = (body.responderName ?? '').trim().slice(0, 120);

  if (!token) return NextResponse.json({ error: 'Missing link token.' }, { status: 400 });
  if (!response) return NextResponse.json({ error: 'Please write a response before sending.' }, { status: 400 });
  if (response.length > MAX_RESPONSE_LENGTH) {
    return NextResponse.json({ error: `Response is too long. Keep it under ${MAX_RESPONSE_LENGTH} characters.` }, { status: 400 });
  }
  if (!isResponseStatus(status)) {
    return NextResponse.json({ error: 'Choose whether this is a response or a resolution.' }, { status: 400 });
  }

  const request = await prisma.serviceRequest.findUnique({ where: { responseToken: token } });
  if (!request) return NextResponse.json({ error: 'This link is not valid.' }, { status: 404 });

  const refusal = tokenRefusal(request, new Date());
  if (refusal) return NextResponse.json({ error: refusal }, { status: 410 });

  // Resolving retires the link, so a forwarded email cannot reopen a closed
  // ticket. Responding leaves it live: Leadway may answer, wait on the client,
  // and answer again before the thing is actually finished.
  const resolving = status === 'Resolved';

  // The reply is appended, never overwritten. An earlier answer stays on the
  // record even after a later one supersedes it, which is the point of holding
  // a thread rather than one field.
  const updated = await prisma.serviceRequest.update({
    where: { id: request.id },
    data: {
      status,
      responses: {
        create: { body: response, authorName: responderName || null, status },
      },
      ...(resolving ? { responseToken: null, responseTokenExpires: null } : {}),
    },
    include: withResponses,
  });

  console.log(`[service-desk/respond] ${refFor(request.seq)} → ${status}${responderName ? ` by ${responderName}` : ''} (reply ${updated.responses.length})`);
  return NextResponse.json({ request: shape(updated) });
}
