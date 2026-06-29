import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

// All pre-employment screening requests go to these four recipients
const TO_ADDRESSES = [
  'o-adeniji@leadway.com',
  'j-akajaye@leadway.com',
  't-adegbite@leadway.com',
  'v-ating@leadway.com',
];

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
    candidateName: string;
    candidateEmail: string;
    candidatePhone: string;
    gender: string;
    dob: string;
    state: string;
    facilityName: string;
    facilityAddress: string;
    preferredDate: string;
    tests: string[];
    notes?: string;
    companyName?: string;
  };

  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const hrEmail = session.user.email ?? '';
  const companyName = body.companyName ?? session.user.companyName ?? hrEmail;

  const testsHtml = body.tests.map((t) => `<li style="padding:3px 0;font-size:13px;color:#374151;">${t}</li>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#131C4E,#3A4382);padding:32px 40px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.7);">Leadway Health — Corporate Portal</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Pre-employment Screening Request</p>
    </div>

    <div style="padding:36px 40px;">
      <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.7;">
        A pre-employment screening quote request has been submitted via the Corporate Portal.
      </p>

      <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3B8;">Requesting Company</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px;">
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;width:38%;">Company</td>
          <td style="padding:10px 0;color:#131C4E;">${companyName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">HR Contact</td>
          <td style="padding:10px 0;color:#131C4E;">${hrEmail}</td>
        </tr>
      </table>

      <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3B8;">Candidate Details</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px;">
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;width:38%;">Full Name</td>
          <td style="padding:10px 0;color:#131C4E;font-weight:600;">${body.candidateName}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Email</td>
          <td style="padding:10px 0;color:#131C4E;">${body.candidateEmail}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Phone</td>
          <td style="padding:10px 0;color:#131C4E;">${body.candidatePhone}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Gender</td>
          <td style="padding:10px 0;color:#131C4E;">${body.gender}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Date of Birth</td>
          <td style="padding:10px 0;color:#131C4E;">${body.dob}</td>
        </tr>
      </table>

      <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3B8;">Screening Details</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px;">
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;width:38%;">State</td>
          <td style="padding:10px 0;color:#131C4E;">${body.state}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Facility</td>
          <td style="padding:10px 0;color:#131C4E;font-weight:600;">${body.facilityName}</td>
        </tr>
        <tr style="border-bottom:1px solid #F0F1F5;">
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Address</td>
          <td style="padding:10px 0;color:#131C4E;">${body.facilityAddress}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-weight:700;color:#9CA3B8;">Preferred Date</td>
          <td style="padding:10px 0;color:#131C4E;font-weight:600;">${body.preferredDate}</td>
        </tr>
      </table>

      <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3B8;">Tests Requested (${body.tests.length})</p>
      <ul style="margin:0 0 24px 20px;padding:0;">
        ${testsHtml}
      </ul>

      ${body.notes ? `<p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3B8;">Additional Notes</p>
      <p style="margin:0 0 24px;font-size:13px;color:#374151;line-height:1.6;background:#FAFBFC;border:1px solid #E5E7F1;border-radius:10px;padding:14px 16px;">${body.notes}</p>` : ''}
    </div>

    <div style="border-top:1px solid #F0F1F5;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#C4C9D9;">&copy; Leadway Health Corporate Portal · Please reply to the HR contact above to confirm the quote.</p>
    </div>
  </div>
</body>
</html>`;

  const subject = `Pre-employment Screening Request — ${body.candidateName} [${companyName}]`;

  try {
    const token = await getServiceToken();

    // Send one email to each recipient
    const results = await Promise.allSettled(
      TO_ADDRESSES.map((addr) =>
        fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            EmailAddress: addr,
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
        }).then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 100)}`);
        })
      )
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === TO_ADDRESSES.length) {
      const msg = (failed[0] as PromiseRejectedResult).reason?.message ?? 'All sends failed';
      throw new Error(msg);
    }

    console.log(`[pre-employment] Sent to ${TO_ADDRESSES.length - failed.length}/${TO_ADDRESSES.length} recipients`);
    return NextResponse.json({ success: true, sent: TO_ADDRESSES.length - failed.length });
  } catch (err) {
    console.error('[pre-employment] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send' }, { status: 500 });
  }
}
