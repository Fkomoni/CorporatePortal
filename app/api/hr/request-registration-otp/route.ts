// Sends the registration OTP on explicit user action (reaching the OTP step
// of /verify-registration), rather than automatically alongside the welcome
// email. This keeps the OTP's expiry window aligned with when the user is
// actually ready to enter it.
//
// Email authorisation is Prognosis's call (Company_Email1 via GetAllPolicies)
// — but the OTP itself is generated and verified entirely by us, the same
// mechanism already used for login 2FA and Forgot Password. We stopped
// depending on Prognosis's ClientUserRegistration for this: it's a stricter
// "insured client" check that doesn't reliably recognise a freshly-changed
// contact email, and it also only issues a code on its first call per email,
// which broke re-entry to this step.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isEmailAuthorizedForGroup } from '@/lib/corporate-welcome';
import { issueLoginOtp } from '@/lib/login-otp';

export async function POST(req: Request) {
  let body: { email?: string; groupId?: string; policyNumber?: string; companyName?: string; name?: string; mobile?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  try {
    const authorized = await isEmailAuthorizedForGroup(email, body.groupId || null);
    if (!authorized) {
      return NextResponse.json({
        error: 'This email is not currently registered with Leadway Health as your corporate account contact. Please contact Leadway Health to confirm your registered email.',
      }, { status: 403 });
    }

    // Pre-register the HR user record if it doesn't already exist (e.g. the
    // link was reached without going through the welcome/send-signup step).
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        companyId: body.groupId || undefined,
        companyName: body.companyName || undefined,
        policyNumber: body.policyNumber || undefined,
      },
      create: {
        email,
        password: '',
        name: (body.name ?? '').trim() || email,
        role: 'hr_admin',
        companyId: body.groupId || null,
        companyName: body.companyName || null,
        policyNumber: body.policyNumber || null,
        active: false,
        mobile: body.mobile || null,
      },
    });

    const sent = await issueLoginOtp(user, 'email', 'registration');
    if (!sent) return NextResponse.json({ error: 'Could not send the verification code. Please try again.' }, { status: 502 });

    return NextResponse.json({ success: true, otpEmailSent: true });
  } catch (err) {
    console.error('[request-registration-otp] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send OTP' }, { status: 500 });
  }
}
