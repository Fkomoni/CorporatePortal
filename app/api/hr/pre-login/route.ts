// First step of HR login. Validates credentials; if the account has 2FA
// enabled, issues and emails a login OTP. The client then calls signIn with
// email + password + otp (authorize() re-verifies everything).
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { issueLoginOtp } from '@/lib/login-otp';
import { verifyHrPasswordWithPrognosis } from '@/lib/prognosis-hr-login';

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  const password = body.password ?? '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Same generic message for unknown account / wrong password: no user enumeration
  if (!user || !user.active || !user.password || !(await bcrypt.compare(password, user.password))) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  // Prognosis has the final say, and authorize() enforces it again when signIn
  // runs, so this call is not the security boundary. It is here for two reasons:
  // a 2FA account should not be emailed a code for credentials that are going to
  // be refused a moment later, and the sign-in form cannot explain an outage if
  // the only signal it gets back is NextAuth's generic failure.
  //
  // After the bcrypt check on purpose: an unauthenticated caller cannot use this
  // route to push traffic at Prognosis without a valid local password first.
  const prognosis = await verifyHrPasswordWithPrognosis(user.email, password);
  if (prognosis.outcome === 'unreachable') {
    console.error(`[hr/pre-login] email=${user.email} could not be verified: ${prognosis.detail}`);
    return NextResponse.json({
      error: 'We could not reach Leadway Health to verify your sign-in. Please try again in a few minutes.',
    }, { status: 503 });
  }
  if (prognosis.outcome !== 'ok') {
    // Same wording as a wrong local password. Saying "your portal password is
    // right but Leadway rejected it" would confirm a valid password to whoever
    // typed it.
    console.log(`[hr/pre-login] email=${user.email} refused by Prognosis: ${prognosis.detail}`);
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  if (!user.twoFaEnabled) {
    return NextResponse.json({ twoFaRequired: false });
  }

  const method = user.twoFaMethod === 'sms' ? 'sms' : 'email';
  const sent = await issueLoginOtp(user, method);
  return NextResponse.json({ twoFaRequired: true, otpSent: sent, method });
}
