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
import { isEmailAuthorizedForGroup, getServiceToken } from '@/lib/corporate-welcome';
import { issueLoginOtp } from '@/lib/login-otp';
import { callCorporateUserSignUp } from '@/lib/corporate-user-signup';

export async function POST(req: Request) {
  let body: {
    email?: string; groupId?: string; policyNumber?: string; companyName?: string; name?: string; mobile?: string;
    firstName?: string; surname?: string; dateOfBirth?: string; gender?: string; phone?: string; password?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const firstName = (body.firstName ?? '').trim();
  const surname = (body.surname ?? '').trim();
  const dateOfBirth = (body.dateOfBirth ?? '').trim();
  const gender = (body.gender ?? '').trim();
  const phone = (body.phone ?? body.mobile ?? '').trim();
  const password = body.password ?? '';

  if (!firstName || !surname) return NextResponse.json({ error: 'First name and surname are required.' }, { status: 400 });
  if (!dateOfBirth) return NextResponse.json({ error: 'Date of birth is required.' }, { status: 400 });
  if (!gender) return NextResponse.json({ error: 'Gender is required.' }, { status: 400 });
  if (!phone) return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
  if (!password) return NextResponse.json({ error: 'Password is required.' }, { status: 400 });

  // Leadway password complexity policy
  if (password.length < 8)              return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
  if (!/[A-Z]/.test(password))          return NextResponse.json({ error: 'Password must include at least one uppercase letter (A–Z).' }, { status: 400 });
  if (!/[a-z]/.test(password))          return NextResponse.json({ error: 'Password must include at least one lowercase letter (a–z).' }, { status: 400 });
  if (!/[0-9]/.test(password))          return NextResponse.json({ error: 'Password must include at least one number (0–9).' }, { status: 400 });
  if (!/[^A-Za-z0-9]/.test(password))  return NextResponse.json({ error: 'Password must include at least one special character.' }, { status: 400 });

  try {
    const authorized = await isEmailAuthorizedForGroup(email, body.groupId || null);
    if (!authorized) {
      return NextResponse.json({
        error: 'This email is not currently registered with Leadway Health as your corporate account contact. Please contact Leadway Health to confirm your registered email.',
      }, { status: 403 });
    }

    // Register this HR user with Prognosis so it recognises the account for
    // future login validation. Must succeed before we issue an OTP.
    const token = await getServiceToken();
    const signup = await callCorporateUserSignUp(token, {
      email, password, phoneNumber: phone, firstName, surname,
      groupId: body.groupId || '', dateOfBirth, gender,
    });
    if (!signup.success) {
      return NextResponse.json({ error: signup.error || 'Failed to register with Prognosis. Please try again.' }, { status: 502 });
    }

    const fullName = `${firstName} ${surname}`.trim() || email;

    // Only a genuine (not "already existed") CorporateUserSignUp confirms
    // Prognosis now has this exact password — otherwise its stored password
    // may be an earlier one, and the login gate must not assume they match.
    const prognosisSynced = !signup.alreadyExisted;

    // Pre-register the HR user record if it doesn't already exist (e.g. the
    // link was reached without going through the welcome/send-signup step).
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        companyId: body.groupId || undefined,
        companyName: body.companyName || undefined,
        policyNumber: body.policyNumber || undefined,
        name: fullName,
        mobile: phone || undefined,
        prognosisSynced,
      },
      create: {
        email,
        password: '',
        name: fullName,
        role: 'hr_admin',
        companyId: body.groupId || null,
        companyName: body.companyName || null,
        policyNumber: body.policyNumber || null,
        active: false,
        mobile: phone || null,
        prognosisSynced,
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
