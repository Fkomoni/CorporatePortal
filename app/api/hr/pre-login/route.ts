// First step of HR login. Validates credentials; if the account has 2FA
// enabled, issues and emails a login OTP. The client then calls signIn with
// email + password + otp (authorize() re-verifies everything).
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { issueLoginOtp } from '@/lib/login-otp';

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
  // Same generic message for unknown account / wrong password — no user enumeration
  if (!user || !user.active || !user.password || !(await bcrypt.compare(password, user.password))) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  if (!user.twoFaEnabled) {
    return NextResponse.json({ twoFaRequired: false });
  }

  const method = user.twoFaMethod === 'sms' ? 'sms' : 'email';
  const sent = await issueLoginOtp(user, method);
  return NextResponse.json({ twoFaRequired: true, otpSent: sent, method });
}
