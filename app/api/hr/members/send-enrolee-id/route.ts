import { auth } from '@/auth';
import { NextResponse } from 'next/server';

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

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? 'noreply@leadwayhealth.com';

  if (!apiKey) {
    console.error('[send-enrolee-id] RESEND_API_KEY not set');
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#F56B22,#FF8C4B);padding:32px 40px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Leadway Health</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Your Health Insurance Member ID</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        Dear <strong>${memberName}</strong>,
      </p>
      <p style="margin:0 0 28px;font-size:14px;color:#6B7280;line-height:1.6;">
        You have been enrolled on the <strong style="color:#131C4E;">${schemeName ?? 'Leadway Health'}</strong> plan.
        Please find your Enrolee ID below — you will need this when visiting any Leadway Health provider or making a claim.
      </p>

      <!-- ID Card -->
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

    <!-- Footer -->
    <div style="border-top:1px solid #F0F1F5;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#C4C9D9;">© ${new Date().getFullYear()} Leadway Health. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Leadway Health <${fromEmail}>`,
        to: [email],
        subject: `Your Leadway Health Enrolee ID — ${enroleeId}`,
        html,
      }),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      console.error('[send-enrolee-id] Resend error:', data);
      return NextResponse.json({ error: String(data?.message ?? 'Failed to send email') }, { status: 502 });
    }

    console.log(`[send-enrolee-id] Sent to ${email}, id=${data.id}`);
    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error('[send-enrolee-id] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send email' }, { status: 500 });
  }
}
