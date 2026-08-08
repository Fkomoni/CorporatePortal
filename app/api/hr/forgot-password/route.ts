// Recovery for HR logins that can no longer sign in.
//   POST { action: 'request', email }                  → email a code
//   POST { action: 'reset', email, code, newPassword } → check code, confirm the
//                                                        password with Prognosis,
//                                                        then store it locally
//
// Not a password reset any more, despite the route name. Sign-in requires both
// the local hash and Prognosis to accept the password on every attempt, and the
// portal cannot write to the Prognosis side, so the only repair available is to
// bring the local hash into line with the password Leadway Health already holds.
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { issueLoginOtp, verifyLoginOtp } from '@/lib/login-otp';
import { consumeLoginOtp } from '@/lib/login-otp-verify';
import { isEmailAuthorizedForGroup } from '@/lib/corporate-welcome';
import { verifyHrPasswordWithPrognosis } from '@/lib/prognosis-hr-login';

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
      // Don't reveal whether the account exists/is active: always report success.
      // For the primary HR admin contact (role=hr_admin), Prognosis's
      // Company_Email1 must still recognise this email for that company -
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
          console.warn(`[forgot-password] ${email} is no longer the Prognosis-authorised contact: reset code withheld.`);
        }
      }
      return NextResponse.json({ success: true, message: 'If an account exists for this email, a reset code has been sent.' });
    }

    case 'reset': {
      const code = String(body.code ?? '').trim();
      const newPassword = String(body.newPassword ?? '');
      if (!code) return NextResponse.json({ error: 'Reset code is required.' }, { status: 400 });
      if (!newPassword) return NextResponse.json({ error: 'Your Leadway Health password is required.' }, { status: 400 });
      // No complexity rules here any more. This no longer invents a password:
      // it points the portal at the one Leadway Health already holds, and
      // rejecting a correct password for failing the portal's own rules would
      // leave the account locked out for the wrong reason.
      if (!user || !user.active) return NextResponse.json({ error: 'Invalid or expired reset code.' }, { status: 400 });

      // Checked but not consumed: the Prognosis step below can still fail, and
      // burning the emailed code on a mistyped password would send the user back
      // for a new one every time.
      const check = await verifyLoginOtp(user.id, code, { consume: false });
      if (check === 'locked')  return NextResponse.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 });
      if (check === 'expired') return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 });
      if (check !== 'ok')      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });

      // This route used to set a portal-only password and call Prognosis's
      // ChangePassword with the shared integration token to "sync" it. That call
      // carries no username, so it could never have changed this user's password,
      // and every reset left an account whose portal password Prognosis had never
      // seen. Sign-in checks Prognosis every time now, so such an account cannot
      // sign in at all.
      //
      // What it does instead: confirm the password the user gave is the one
      // Leadway Health already accepts, and only then store it locally. The two
      // sides cannot be left disagreeing, and a locked-out account has a way back
      // without a new Prognosis endpoint. The emailed code still gates this, so
      // it is not an open oracle for testing passwords against Prognosis.
      const prognosis = await verifyHrPasswordWithPrognosis(user.email, newPassword);
      if (prognosis.outcome === 'unreachable') {
        console.error(`[forgot-password] ${user.email} could not be verified: ${prognosis.detail}`);
        return NextResponse.json({
          error: 'We could not reach Leadway Health to confirm that password. Please try again in a few minutes.',
        }, { status: 503 });
      }
      if (prognosis.outcome !== 'ok') {
        console.log(`[forgot-password] ${user.email} refused by Prognosis: ${prognosis.detail}`);
        return NextResponse.json({
          error: 'Leadway Health did not recognise that password. Enter your current Leadway Health password, '
            + 'or reset it with Leadway Health first.',
        }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: passwordHash, prognosisSynced: true },
      });
      await consumeLoginOtp(user.id);
      console.log(`[forgot-password] ${user.email} portal password re-pointed at the Prognosis password`);

      return NextResponse.json({ success: true, prognosisSynced: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
