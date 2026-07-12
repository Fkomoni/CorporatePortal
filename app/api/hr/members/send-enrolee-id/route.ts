import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { renderEmailTemplate } from '@/lib/email-template';

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

  const html = renderEmailTemplate({
    category: 'Member Services',
    eyebrow: 'Enrolee ID',
    headline: 'Your Health Insurance Member ID',
    body: `Dear <strong>${memberName}</strong>, you have been enrolled on the <strong style="color:#131C4E;">${schemeName ?? 'Leadway Health'}</strong> plan. Present the Enrolee ID below at any Leadway Health accredited hospital or pharmacy when accessing care or making a claim.`,
    highlight: `<span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3B8;margin-bottom:6px;">Enrolee ID</span><span style="display:block;font-size:28px;font-weight:900;letter-spacing:0.05em;color:#131C4E;font-family:'Courier New',monospace;">${enroleeId}</span>`,
    footnote: 'Keep this ID safe. If you have any questions, please contact your HR team or reach Leadway Health support.',
  });

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

    const text = await res.text();
    console.log(`[send-enrolee-id] SendEmailAlert → HTTP ${res.status}: ${text.slice(0, 500)}`);
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

    console.log(`[send-enrolee-id] Sent to ${email} via Prognosis`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[send-enrolee-id] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send email' }, { status: 500 });
  }
}
