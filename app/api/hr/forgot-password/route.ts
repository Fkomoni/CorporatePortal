// Self-service password reset for HR logins.
//   POST { action: 'request', email }                       → email a reset code
//   POST { action: 'reset', email, code, newPassword }       → verify code, set new password
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { issueLoginOtp, verifyLoginOtp } from '@/lib/login-otp';
import { isEmailAuthorizedForGroup, getServiceToken } from '@/lib/corporate-welcome';
import { callPrognosisChangePassword } from '@/lib/corporate-change-password';

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
      // For the primary HR admin contact (role=hr_admin), Prognosis's
      // Company_Email1 must still recognise this email for that company —
      // same authorisation rule as registration. Manually invited sub-users
      // (Viewer, Finance, custom roles) were never tied to Prognosis this way,
      // so they're exempt from this check.
      if (user?.active) {
        const needsProgCheck = user.role === 'hr_admin';
        const authorized = needsProgCheck ? await isEmailAuthorizedForGroup(email, user.companyId) : true;
        if (authorized) {
          try {
            await issueLoginOtp(user, 'email', 'reset');
          } catch (e) {
            console.error('[forgot-password] Failed to send reset code:', e);
          }
        } else {
          console.warn(`[forgot-password] ${email} is no longer the Prognosis-authorised contact — reset code withheld.`);
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

      // Confirmed with Prognosis: ChangePassword's OldPassword isn't
      // actually verified, so it can be called here too — any placeholder
      // value works — keeping the account in sync even on a forgot-password
      // reset. Still non-blocking: the local reset succeeds regardless.
      let prognosisSynced = user.prognosisSynced;
      try {
        const token = await getServiceToken();
        const result = await callPrognosisChangePassword(token, 'unknown', newPassword);
        prognosisSynced = result.success;
        if (!result.success) {
          console.warn(`[forgot-password] Prognosis ChangePassword failed for ${user.email}: ${result.error}`);
        }
      } catch (err) {
        prognosisSynced = false;
        console.error('[forgot-password] Prognosis ChangePassword error:', err);
      }

      await prisma.user.update({ where: { id: user.id }, data: { password: passwordHash, prognosisSynced } });

      return NextResponse.json({ success: true, prognosisSynced });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
