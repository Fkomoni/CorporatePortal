// Self-service password reset for HR logins.
//   POST { action: 'request', email }                       → email a reset code
//   POST { action: 'reset', email, code, newPassword }       → verify code, set new password
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { issueLoginOtp, verifyLoginOtp } from '@/lib/login-otp';

export async function POST(req: Request) {
  let body: { action?: string; email?: string; code?: string; newPassword?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  switch (body.action) {
    case 'request': {
      // Don't reveal whether the account exists/is active — always report success.
      if (user?.active) {
        try {
          await issueLoginOtp(user, 'email', 'reset');
        } catch (e) {
          console.error('[forgot-password] Failed to send reset code:', e);
        }
      }
      return NextResponse.json({ success: true, message: 'If an account exists for this email, a reset code has been sent.' });
    }

    case 'reset': {
      const code = String(body.code ?? '').trim();
      const newPassword = String(body.newPassword ?? '');
      if (!code) return NextResponse.json({ error: 'Reset code is required.' }, { status: 400 });
      if (newPassword.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
      if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
        return NextResponse.json({ error: 'Password must include uppercase, lowercase, a number and a special character.' }, { status: 400 });
      }
      if (!user || !user.active) return NextResponse.json({ error: 'Invalid or expired reset code.' }, { status: 400 });

      const check = await verifyLoginOtp(user.id, code);
      if (check === 'locked')  return NextResponse.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 });
      if (check === 'expired') return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 });
      if (check !== 'ok')      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { password: passwordHash } });

      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
