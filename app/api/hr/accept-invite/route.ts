// Completes a portal-user invitation: validates the invite token, registers the
// account with Prognosis, enforces the password policy, activates the account.
//
// The Prognosis step is new and not optional. Sign-in checks every HR password
// against Prognosis on every attempt, and an invited colleague only ever existed
// in this app's own users table, so an account activated here without a
// Prognosis account behind it could never sign in. That is why this form now
// asks for date of birth, gender and phone: CorporateUserSignUp needs them.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getServiceToken } from '@/lib/corporate-welcome';
import { callCorporateUserSignUp } from '@/lib/corporate-user-signup';
import { verifyHrPasswordWithPrognosis } from '@/lib/prognosis-hr-login';

export async function POST(req: Request) {
  let body: {
    token?: string; email?: string; password?: string;
    dateOfBirth?: string; gender?: string; phone?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const dateOfBirth = (body.dateOfBirth ?? '').trim();
  const gender = (body.gender ?? '').trim();
  const phone = (body.phone ?? '').trim();

  if (!token || !email || !password) {
    return NextResponse.json({ error: 'Token, email and password are required.' }, { status: 400 });
  }
  if (!dateOfBirth) return NextResponse.json({ error: 'Date of birth is required.' }, { status: 400 });
  if (!gender)      return NextResponse.json({ error: 'Gender is required.' }, { status: 400 });
  if (!phone)       return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });

  // Leadway password complexity policy
  if (password.length < 8)              return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
  if (!/[A-Z]/.test(password))          return NextResponse.json({ error: 'Password must include at least one uppercase letter (A-Z).' }, { status: 400 });
  if (!/[a-z]/.test(password))          return NextResponse.json({ error: 'Password must include at least one lowercase letter (a-z).' }, { status: 400 });
  if (!/[0-9]/.test(password))          return NextResponse.json({ error: 'Password must include at least one number (0-9).' }, { status: 400 });
  if (!/[^A-Za-z0-9]/.test(password))  return NextResponse.json({ error: 'Password must include at least one special character.' }, { status: 400 });

  try {
    const invite = await prisma.verificationToken.findUnique({ where: { token } });
    if (!invite || invite.identifier !== `invite:${email}`) {
      return NextResponse.json({ error: 'This invitation link is invalid.' }, { status: 400 });
    }
    if (invite.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.json({ error: 'This invitation has expired. Ask your administrator to send a new one.' }, { status: 410 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: 'Invited account not found. Ask your administrator to re-invite you.' }, { status: 404 });

    // Prognosis first. If this fails the account stays inactive rather than
    // being activated into a state where it cannot sign in.
    const parts = (user.name ?? '').trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || email.split('@')[0];
    const surname = parts.slice(1).join(' ') || firstName;

    const serviceToken = await getServiceToken();
    const signup = await callCorporateUserSignUp(serviceToken, {
      email, password, phoneNumber: phone, firstName, surname,
      groupId: user.companyId ?? '', dateOfBirth, gender,
    });
    if (!signup.success) {
      console.error(`[accept-invite] CorporateUserSignUp failed for ${email}: ${signup.error}`);
      return NextResponse.json({
        error: signup.error || 'Could not register your account with Leadway Health. Please try again.',
      }, { status: 502 });
    }

    // Already known to Prognosis: its password is not the one just typed and
    // cannot be overwritten from here, so the only safe move is to confirm the
    // person knows the existing one. Same rule as the main registration flow.
    if (signup.alreadyExisted) {
      const check = await verifyHrPasswordWithPrognosis(email, password);
      if (check.outcome === 'unreachable') {
        console.error(`[accept-invite] ${email} could not be verified: ${check.detail}`);
        return NextResponse.json({
          error: 'We could not reach Leadway Health to confirm your details. Please try again in a few minutes.',
        }, { status: 503 });
      }
      if (check.outcome !== 'ok') {
        console.log(`[accept-invite] ${email} already exists at Prognosis and the password was refused: ${check.detail}`);
        return NextResponse.json({
          error: 'You already have a Leadway Health account with this email. Use that account\'s password here, '
            + 'or reset it with Leadway Health first.',
        }, { status: 409 });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        active: true,
        prognosisSynced: true,
        mobile: user.mobile ?? phone,
      },
    });
    await prisma.verificationToken.delete({ where: { token } });
    console.log(`[accept-invite] ${email} activated and registered with Prognosis`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[accept-invite] Error:', err);
    return NextResponse.json({ error: 'Failed to activate your account. Please try again.' }, { status: 500 });
  }
}
