// HR flags an existing member's record as needing a correction (wrong DOB,
// misspelled name, wrong plan, etc). We have no live "support ticket" system
// backing the Service Desk page yet, so this emails the correction request
// straight to Leadway Health support with the member's details, rather than
// pretending to file it somewhere that doesn't persist.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { renderEmailTemplate } from '@/lib/email-template';
import { getServiceToken } from '@/lib/corporate-welcome';
import { logAudit } from '@/lib/audit';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

const SUPPORT_EMAIL = process.env.LEADWAY_SUPPORT_EMAIL ?? 'healthcare@leadwayhealth.com';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: { enrolleeId?: string; cifNumber?: string | number | null; memberName?: string; description?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const enrolleeId = String(body.enrolleeId ?? '').trim();
  const memberName = String(body.memberName ?? '').trim();
  const description = String(body.description ?? '').trim();
  if (!enrolleeId || !memberName || !description) {
    return NextResponse.json({ error: 'enrolleeId, memberName and description are required' }, { status: 400 });
  }

  const html = renderEmailTemplate({
    category: 'Correction Request',
    eyebrow: 'HR Correction Request',
    headline: `Correction needed: ${memberName}`,
    body: `${session.user.name ?? session.user.email} from <strong>${session.user.companyName ?? 'a corporate client'}</strong> has requested a correction to a member's record.`,
    details: [
      { label: 'Member', value: memberName },
      { label: 'Enrolee ID', value: enrolleeId },
      { label: 'CIF Number', value: body.cifNumber != null ? String(body.cifNumber) : '—' },
      { label: 'Company', value: session.user.companyName ?? '—' },
      { label: 'Requested By', value: `${session.user.name ?? ''} (${session.user.email ?? ''})` },
    ],
    highlight: description.replace(/\n/g, '<br/>'),
    footnote: 'Please review and update this member\'s record on Prognosis, then confirm back to the HR contact above.',
  });

  try {
    const token = await getServiceToken();
    const res = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        EmailAddress: SUPPORT_EMAIL,
        CC: session.user.email ?? '',
        BCC: '', Subject: `Correction Request — ${memberName} (${enrolleeId})`, MessageBody: html,
        Attachments: null, Category: '', UserId: 0, ProviderId: 0, ServiceId: 0, Reference: '', TransactionType: '',
      }),
    });
    const text = await res.text();
    console.log(`[request-correction] SendEmailAlert → HTTP ${res.status}: ${text.slice(0, 300)}`);
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to send correction request (HTTP ${res.status})` }, { status: 502 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send correction request' }, { status: 500 });
  }

  void logAudit({
    session, request: req, resource: 'members', action: 'REQUEST_MEMBER_CORRECTION',
    details: { enrolleeId, memberName, description },
  });

  return NextResponse.json({ success: true });
}
