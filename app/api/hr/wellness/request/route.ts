import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

const CLIENT_SERVICES_EMAIL = 'clientservices@leadway.com';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Username: process.env.PROGNOSIS_USERNAME, Password: process.env.PROGNOSIS_PASSWORD }),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Service login non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token from ApiUsers/Login');
  cachedToken = token;
  tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
  return token;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: {
    type: 'talk' | 'screening' | 'bookingLink';
    // talk fields
    talkFormat?: string;
    talkCategory?: string;
    talkTopic?: string;
    talkDate?: string;
    talkDuration?: string;
    talkAttendees?: string;
    talkVenue?: string;
    // screening fields
    scrParticipants?: string;
    scrDate?: string;
    scrVenue?: string;
    scrNotes?: string;
    // booking-link fields
    memberName?: string;
    memberId?: string;
    memberEmail?: string;
    memberPlan?: string;
    includeSpouse?: boolean;
    spouseEmail?: string;
    linkMessage?: string;
  };

  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // With three types now, an unrecognised one must not fall through the last
  // branch and be mailed out as an onsite screening request.
  if (body.type !== 'talk' && body.type !== 'screening' && body.type !== 'bookingLink') {
    return NextResponse.json({ error: 'Unknown request type' }, { status: 400 });
  }
  if (body.type === 'bookingLink' && !body.memberName?.trim()) {
    return NextResponse.json({ error: 'Select a member first' }, { status: 400 });
  }

  const companyName = session.user.companyName ?? session.user.email ?? 'HR Team';
  const hrEmail = session.user.email ?? '';

  // HR types free text into these forms, and a stray < or & would otherwise
  // break the table markup in the mail client.
  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const escLines = (v: unknown) => esc(v).replace(/\r?\n/g, '<br />');

  let subject: string;
  let html: string;

  if (body.type === 'talk') {
    subject = `Health Talk Request: ${body.talkTopic ?? 'New Request'} [${companyName}]`;
    html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#F56B22,#FF8C4B);padding:32px 40px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Leadway Health. Corporate Portal</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Health Talk Request</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.7;">A health talk request has been submitted via the Corporate Portal.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;width:40%;">Company</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(companyName)}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">HR Contact</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(hrEmail)}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Format</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(body.talkFormat) || '-'}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Category</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(body.talkCategory) || '-'}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Topic</td>
          <td style="padding:10px 0;color:#131C4E;font-weight:600;">${esc(body.talkTopic) || '-'}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Preferred Date</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(body.talkDate) || '-'}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Duration</td>
          <td style="padding:10px 0;color:#131C4E;">${body.talkDuration ? `${esc(body.talkDuration)} minutes` : '-'}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Expected Attendees</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(body.talkAttendees) || '-'}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Venue / Platform</td>
          <td style="padding:10px 0;color:#131C4E;">${escLines(body.talkVenue) || '-'}</td>
        </tr>
      </table>
    </div>
    <div style="border-top:1px solid #F0F1F5;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#C4C9D9;">&copy; Leadway Health Corporate Portal. Please reply to the HR contact above to confirm.</p>
    </div>
  </div>
</body>
</html>`;
  } else if (body.type === 'bookingLink') {
    // The portal cannot issue a booking link itself, so this asks client
    // services to issue one. Before this existed the button only pushed a row
    // into local state and told HR the member had been emailed.
    const spouseRow = body.includeSpouse
      ? `<tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Spouse</td>
          <td style="padding:10px 0;color:#131C4E;">Include spouse. Send a separate link to ${esc(body.spouseEmail) || '(no email supplied)'}</td>
        </tr>`
      : '';
    const noteRow = body.linkMessage?.trim()
      ? `<tr>
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Note from HR</td>
          <td style="padding:10px 0;color:#131C4E;">${escLines(body.linkMessage.trim())}</td>
        </tr>`
      : '';
    subject = `Screening Booking Link Request: ${body.memberName ?? 'Member'} [${companyName}]`;
    html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#059669,#10B981);padding:32px 40px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Leadway Health. Corporate Portal</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Screening Booking Link Request</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.7;">HR has asked for an annual medical booking link to be issued to the member below.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;width:40%;">Company</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(companyName)}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">HR Contact</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(hrEmail)}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Member</td>
          <td style="padding:10px 0;color:#131C4E;font-weight:600;">${esc(body.memberName) || '-'}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Enrolee ID</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(body.memberId) || '-'}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Member Email</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(body.memberEmail) || '(none on record)'}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Plan</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(body.memberPlan) || '-'}</td>
        </tr>
        ${spouseRow}
        ${noteRow}
      </table>
    </div>
    <div style="border-top:1px solid #F0F1F5;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#C4C9D9;">&copy; Leadway Health Corporate Portal. Please issue the booking link and copy the HR contact above.</p>
    </div>
  </div>
</body>
</html>`;
  } else {
    subject = `Onsite Health Screening Request: ${companyName}`;
    html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2563EB,#3B82F6);padding:32px 40px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Leadway Health. Corporate Portal</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Onsite Screening Request</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.7;">An onsite health screening request has been submitted via the Corporate Portal.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;width:40%;">Company</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(companyName)}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">HR Contact</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(hrEmail)}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Expected Participants</td>
          <td style="padding:10px 0;color:#131C4E;font-weight:600;">${esc(body.scrParticipants) || '-'}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Preferred Date</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(body.scrDate) || '-'}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Venue / Location</td>
          <td style="padding:10px 0;color:#131C4E;">${esc(body.scrVenue) || '-'}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Additional Notes</td>
          <td style="padding:10px 0;color:#131C4E;">${escLines(body.scrNotes) || '-'}</td>
        </tr>
      </table>
    </div>
    <div style="border-top:1px solid #F0F1F5;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#C4C9D9;">&copy; Leadway Health Corporate Portal. Please reply to the HR contact above to confirm logistics.</p>
    </div>
  </div>
</body>
</html>`;
  }

  try {
    const token = await getServiceToken();
    const res = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        EmailAddress: CLIENT_SERVICES_EMAIL,
        CC: hrEmail,
        BCC: '',
        Subject: subject,
        MessageBody: html,
        Attachments: null,
        Category: '',
        UserId: 0,
        ProviderId: 0,
        ServiceId: 0,
        Reference: '',
        TransactionType: '',
      }),
    });
    const text = await res.text();
    // Prognosis reports a rejected address with HTTP 200 and "fail: ..." in the
    // body, so the status code alone is not enough to call this sent. Without
    // this check the form showed a success banner for a mail nobody received.
    if (!res.ok || /fail/i.test(text)) {
      throw new Error(`SendEmailAlert HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    console.log(`[wellness/request] ${body.type} email sent to ${CLIENT_SERVICES_EMAIL} (CC: ${hrEmail})`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[wellness/request] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send request' }, { status: 500 });
  }
}
