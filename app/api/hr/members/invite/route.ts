import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: {
    email: string;
    employeeCode: string;
    schemeId: string;
    schemeName: string;
    scope?: string;
    inviteType?: 'principal' | 'dependent';
    parentCif?: string;
    maxDependents?: number;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    email, employeeCode, schemeId, schemeName,
    scope = 'self',
    inviteType = 'principal',
    parentCif,
    maxDependents = 1,
  } = body;

  if (!email || !employeeCode || !schemeId) {
    return NextResponse.json({ error: 'email, employeeCode and schemeId are required' }, { status: 400 });
  }
  if (inviteType === 'dependent' && !parentCif) {
    return NextResponse.json({ error: 'parentCif is required for dependent invitations' }, { status: 400 });
  }

  const groupId = session.user.companyId ?? '';

  // For dependent invites, don't block on "already enrolled" — a principal can get multiple dep links
  if (inviteType === 'principal') {
    const existing = await prisma.memberInvitation.findFirst({
      where: { email, employeeCode, groupId, inviteType: 'principal', used: false, expiresAt: { gt: new Date() } },
    });
    if (existing) {
      const base = process.env.NEXTAUTH_URL ?? 'https://corporateportal.onrender.com';
      return NextResponse.json({ token: existing.token, url: `${base}/enroll/${existing.token}`, reused: true });
    }
    const usedInvite = await prisma.memberInvitation.findFirst({
      where: { email, employeeCode, groupId, inviteType: 'principal', used: true },
    });
    if (usedInvite) {
      return NextResponse.json({ error: 'This staff member has already enrolled via an invitation link.' }, { status: 409 });
    }
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await prisma.memberInvitation.create({
    data: {
      email,
      employeeCode,
      schemeId,
      schemeName,
      groupId,
      scope,
      inviteType,
      parentCif: parentCif ?? null,
      maxDependents,
      expiresAt,
      createdBy: session.user.email ?? '',
    },
  });

  const base = process.env.NEXTAUTH_URL ?? 'https://corporateportal.onrender.com';
  const url = `${base}/enroll/${invitation.token}`;

  // Send enrolment link email to the staff member
  let emailSent = false;
  let emailError: string | null = null;
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? 'noreply@leadwayhealth.com';

  if (apiKey) {
    const isDependent = inviteType === 'dependent';
    const subject = isDependent
      ? 'Leadway Health — Add Your Dependants'
      : 'Leadway Health — Complete Your Health Insurance Enrolment';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#F56B22,#FF8C4B);padding:32px 40px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Leadway Health</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">${isDependent ? 'Add Your Dependants' : 'Complete Your Enrolment'}</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Hi there,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.7;">
        ${isDependent
          ? `Your HR team has sent you a link to add your dependants (spouse, children, etc.) to your <strong style="color:#131C4E;">${schemeName}</strong> health insurance plan.`
          : `Your HR team has invited you to enrol on the <strong style="color:#131C4E;">${schemeName}</strong> health insurance plan. Click the button below to complete your enrolment — it only takes a few minutes.`}
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#F56B22,#FF8C4B);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:0.02em;">
          ${isDependent ? 'Add Dependants Now' : 'Start Enrolment'}
        </a>
      </div>
      <div style="background:#F7F8FC;border:1.5px solid #E5E7F1;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3B8;">Or copy this link</p>
        <p style="margin:0;font-size:12px;color:#131C4E;font-family:'Courier New',monospace;word-break:break-all;">${url}</p>
      </div>
      <p style="margin:0 0 8px;font-size:12px;color:#9CA3B8;line-height:1.6;">⏰ This link expires in <strong>7 days</strong>. If it expires, please contact your HR team for a new one.</p>
      ${!isDependent ? `<p style="margin:0;font-size:12px;color:#9CA3B8;line-height:1.6;">🔒 You will need your <strong>email address</strong> and <strong>employee code (${employeeCode})</strong> to verify your identity.</p>` : ''}
    </div>
    <div style="border-top:1px solid #F0F1F5;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#C4C9D9;">© ${new Date().getFullYear()} Leadway Health. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `Leadway Health <${fromEmail}>`, to: [email], subject, html }),
      });
      const emailData = await emailRes.json() as Record<string, unknown>;
      if (emailRes.ok) {
        emailSent = true;
        console.log(`[invite] Email sent to ${email}, id=${emailData.id}`);
      } else {
        emailError = String(emailData?.message ?? 'Email send failed');
        console.error('[invite] Email error:', emailData);
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Email send failed';
      console.error('[invite] Email exception:', err);
    }
  } else {
    emailError = 'RESEND_API_KEY not configured';
    console.warn('[invite] Email skipped: RESEND_API_KEY not set');
  }

  return NextResponse.json({ token: invitation.token, url, reused: false, emailSent, emailError });
}
