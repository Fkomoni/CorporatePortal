import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { emailFooter } from '@/lib/email-footer';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

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

  let body: { email: string; enroleeId: string; memberName: string; schemeName?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, enroleeId, memberName, schemeName } = body;
  if (!email || !enroleeId || !memberName) {
    return NextResponse.json({ error: 'email, enroleeId and memberName are required' }, { status: 400 });
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#F56B22,#FF8C4B);padding:32px 40px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Leadway Health</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Your Health Insurance Member ID</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        Dear <strong>${memberName}</strong>,
      </p>
      <p style="margin:0 0 28px;font-size:14px;color:#6B7280;line-height:1.6;">
        You have been enrolled on the <strong style="color:#131C4E;">${schemeName ?? 'Leadway Health'}</strong> plan.
        Please find your Enrolee ID below &mdash; you will need this when visiting any Leadway Health provider or making a claim.
      </p>
      <div style="background:#F7F8FC;border:1.5px solid #E5E7F1;border-radius:16px;padding:28px 32px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3B8;">Enrolee ID</p>
        <p style="margin:0;font-size:36px;font-weight:900;letter-spacing:0.06em;color:#131C4E;font-family:'Courier New',monospace;">${enroleeId}</p>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#9CA3B8;line-height:1.6;">
        Keep this ID safe. Present it at any Leadway Health accredited hospital or pharmacy when accessing care.
      </p>
      <p style="margin:0;font-size:13px;color:#9CA3B8;line-height:1.6;">
        If you have any questions, please contact your HR team or reach Leadway Health support.
      </p>
    </div>
${emailFooter()}
  </div>
</body>
</html>`;

  try {
    const token = await getServiceToken();
    const res = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        EmailAddress: email,
        CC: '',
        BCC: '',
        Subject: `Your Leadway Health Enrolee ID — ${enroleeId}`,
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

    if (!res.ok) {
      const text = await res.text();
      console.error('[send-enrolee-id] SendEmailAlert error:', text.slice(0, 300));
      return NextResponse.json({ error: `Email send failed (HTTP ${res.status})` }, { status: 502 });
    }

    console.log(`[send-enrolee-id] Sent to ${email} via Prognosis`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[send-enrolee-id] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send email' }, { status: 500 });
  }
}
