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

  let body: {
    email: string; enroleeId: string; memberName: string; memberType?: string;
    planName?: string; schemeName?: string; photoDataUri?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, enroleeId, memberName, memberType, planName, schemeName, photoDataUri } = body;
  if (!email || !enroleeId || !memberName) {
    return NextResponse.json({ error: 'email, enroleeId and memberName are required' }, { status: 400 });
  }

  const photoCell = photoDataUri
    ? `<img src="${photoDataUri}" alt="" width="76" height="90" style="width:76px;height:90px;object-fit:cover;border-radius:10px;border:2px solid #E5E7F1;display:block;" />`
    : `<div style="width:76px;height:90px;border-radius:10px;border:2px solid #E5E7F1;background:#F7F8FC;"></div>`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#F56B22,#FF8C4B);padding:32px 40px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Leadway Health</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Your Digital Health ID Card</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
        Dear <strong>${memberName}</strong>, here is your Leadway Health e-card. Present it at any accredited hospital or pharmacy when accessing care.
      </p>
      <table role="presentation" width="100%" style="border:1.5px solid #E5E7F1;border-radius:16px;background:#fff;">
        <tr>
          <td style="padding:20px;width:96px;vertical-align:top;">${photoCell}</td>
          <td style="padding:20px 20px 20px 0;vertical-align:top;">
            <p style="margin:0 0 2px;font-size:15px;font-weight:800;color:#131C4E;text-transform:uppercase;">${memberName}</p>
            <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#F56B22;text-transform:uppercase;">${memberType ?? ''}</p>
            <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#9CA3B8;">Member No.</p>
            <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#131C4E;font-family:'Courier New',monospace;">${enroleeId}</p>
            <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#9CA3B8;">Plan / Scheme</p>
            <p style="margin:0;font-size:13px;font-weight:700;color:#374151;">${planName ?? ''}${schemeName ? ` &middot; ${schemeName}` : ''}</p>
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#9CA3B8;line-height:1.6;">
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
        Subject: `Your Leadway Health e-Card — ${enroleeId}`,
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
    console.log(`[send-ecard] SendEmailAlert → HTTP ${res.status}: ${text.slice(0, 500)}`);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;
    // Prognosis can return HTTP 200 with a logical failure embedded in the
    // body — never trust res.ok alone.
    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');
    if (!res.ok || (apiStatus && !['success', '200', 'ok', 'true'].includes(apiStatus))) {
      return NextResponse.json({ error: apiMessage || `Email send failed (HTTP ${res.status})` }, { status: 502 });
    }

    console.log(`[send-ecard] Sent to ${email} via Prognosis`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[send-ecard] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send email' }, { status: 500 });
  }
}
