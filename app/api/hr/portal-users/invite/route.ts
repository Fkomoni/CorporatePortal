// Invite a colleague to the corporate portal. Creates an inactive user in
// the inviter's company and emails an invitation link where they set their
// password (token stored in verification_tokens, valid 7 days).
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { getServiceToken } from '@/lib/corporate-welcome';
import { logAudit } from '@/lib/audit';
import { isAdminRole } from '@/lib/roles';
import { emailFooter } from '@/lib/email-footer';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  let body: { name?: string; email?: string; role?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const role = (body.role ?? '').trim() || 'Viewer';

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.password) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
    }

    // Create (or refresh) the invited user — inactive until they set a password
    await prisma.user.upsert({
      where: { email },
      update: { name, role, companyId: groupId, companyName: session.user.companyName ?? null, policyNumber: session.user.policyNumber ?? null },
      create: {
        email,
        password: '',
        name,
        role,
        companyId: groupId,
        companyName: session.user.companyName ?? null,
        policyNumber: session.user.policyNumber ?? null,
        active: false,
      },
    });

    // One invite token per email — replace any previous one
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.verificationToken.deleteMany({ where: { identifier: `invite:${email}` } });
    await prisma.verificationToken.create({
      data: {
        identifier: `invite:${email}`,
        token,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const appBase = (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://corporateportal.onrender.com').replace(/\/$/, '');
    const inviteLink = `${appBase}/accept-invite?token=${token}&email=${encodeURIComponent(email)}`;

    const companyName = session.user.companyName ?? 'your company';
    const emailBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#131C4E;padding:24px 32px;border-radius:12px 12px 0 0;">
    <p style="font-size:22px;font-weight:900;color:#fff;margin:0;letter-spacing:-0.02em">LEADWAY <span style="color:#F56B22;">HEALTH</span></p>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:2px 0 0;letter-spacing:0.1em">CORPORATE PORTAL</p>
  </div>
  <div style="background:#fff;padding:36px 32px;border:1px solid #E5E7F1;border-top:none;">
    <p style="font-size:20px;font-weight:700;color:#131C4E;margin:0 0 8px">You've been invited</p>
    <p style="font-size:14px;color:#6B7280;line-height:1.6;margin:0 0 28px">
      ${session.user.name ?? 'Your administrator'} has invited you to the Leadway Health
      Corporate Portal for <strong>${companyName}</strong> as <strong>${role}</strong>.
      Click below to set your password and activate your account. This link expires in 7 days.
    </p>
    <a href="${inviteLink}" style="display:inline-block;background:#F56B22;color:#fff;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;">
      Accept Invitation
    </a>
    <p style="font-size:12px;color:#9CA3B8;margin:28px 0 0;line-height:1.7">
      Or copy and paste this link:<br/>
      <a href="${inviteLink}" style="color:#F56B22;word-break:break-all;">${inviteLink}</a>
    </p>
    <hr style="border:none;border-top:1px solid #F0F1F5;margin:28px 0"/>
    <p style="font-size:11px;color:#B0B7C9;margin:0">If you did not expect this email, you can safely ignore it.</p>
  </div>
${emailFooter()}
</div>`.trim();

    let emailSent = false;
    try {
      const svcToken = await getServiceToken();
      const emailRes = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${svcToken}` },
        body: JSON.stringify({
          EmailAddress: email,
          CC: '',
          BCC: '',
          Subject: `You've been invited to the Leadway Health Corporate Portal`,
          MessageBody: emailBody,
          Attachments: null,
          Category: '',
          UserId: 0,
          ProviderId: 0,
          ServiceId: 0,
          Reference: '',
          TransactionType: '',
        }),
      });
      emailSent = emailRes.ok;
      console.log(`[portal-users/invite] invite email to ${email} → HTTP ${emailRes.status}`);
    } catch (e) {
      console.error('[portal-users/invite] email send failed:', e);
    }

    void logAudit({ session, action: 'INVITE_USER', resource: 'portal-users', request: req,
      details: { invitedEmail: email, invitedName: name, role, emailSent } });

    return NextResponse.json({ success: true, emailSent });
  } catch (err) {
    console.error('[portal-users/invite] Error:', err);
    return NextResponse.json({ error: 'Failed to send invitation.' }, { status: 500 });
  }
}
