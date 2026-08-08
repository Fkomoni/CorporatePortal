// Changes an HR user's password, on both sides or on neither.
//
// Sign-in requires the local bcrypt hash and Prognosis to accept the password on
// every attempt, so a change that lands on one side alone locks the account out.
// This route used to call Prognosis's ChangePassword with the shared integration
// token, which has no username in its model and so acted on the integration
// account rather than the user: it could never have worked, and it was then
// refused outright rather than left to mislead.
//
// It works now because the user hands over their current password, which is
// enough to authenticate as them and get a token that is theirs. Prognosis is
// changed first; the local hash is written only if that succeeded, so the two
// can never be left disagreeing.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/lib/audit';
import { changePrognosisPassword } from '@/lib/prognosis-change-password';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: { currentPassword?: string; newPassword?: string; confirmPassword?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const currentPassword = body.currentPassword ?? '';
  const newPassword = body.newPassword ?? '';
  const confirmPassword = body.confirmPassword ?? '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'All password fields are required.' }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'New passwords do not match.' }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: 'New password must be different from the current password.' }, { status: 400 });
  }

  // Leadway password complexity policy
  if (newPassword.length < 8)             return NextResponse.json({ error: 'New password must be at least 8 characters long.' }, { status: 400 });
  if (!/[A-Z]/.test(newPassword))         return NextResponse.json({ error: 'New password must include at least one uppercase letter (A-Z).' }, { status: 400 });
  if (!/[a-z]/.test(newPassword))         return NextResponse.json({ error: 'New password must include at least one lowercase letter (a-z).' }, { status: 400 });
  if (!/[0-9]/.test(newPassword))         return NextResponse.json({ error: 'New password must include at least one number (0-9).' }, { status: 400 });
  if (!/[^A-Za-z0-9]/.test(newPassword)) return NextResponse.json({ error: 'New password must include at least one special character.' }, { status: 400 });

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email ?? '' } });
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    // Local check first: it is free, and it keeps a wrong current password from
    // reaching Prognosis as a login attempt.
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      void logAudit({ session, action: 'CHANGE_PASSWORD_FAILED', resource: 'password', request: req,
        details: { reason: 'incorrect current password' } });
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    const result = await changePrognosisPassword(user.email, currentPassword, newPassword);

    if (result.outcome !== 'ok') {
      console.error(`[change-password] ${user.email} not changed: ${result.outcome} (${result.detail})`);
      void logAudit({ session, action: 'CHANGE_PASSWORD_FAILED', resource: 'password', request: req,
        details: { reason: result.outcome } });

      // Nothing has been written on either side, which is what makes each of
      // these safe to retry.
      const message =
        result.outcome === 'wrong-current'
          ? 'Leadway Health did not accept your current password. If you have changed it with Leadway, use that password here.'
        : result.outcome === 'unreachable'
          ? 'We could not reach Leadway Health to change your password. Nothing has changed. Please try again in a few minutes.'
        : result.outcome === 'no-user-token'
          ? 'Leadway Health would not authorise a password change for this account. Please contact Leadway Health.'
          : 'Leadway Health refused the new password. It may not meet their password rules. Nothing has changed.';
      return NextResponse.json({ error: message }, { status: result.outcome === 'unreachable' ? 503 : 400 });
    }

    // Prognosis holds the new password, so the local hash follows it.
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(newPassword, 12), prognosisSynced: true },
    });

    console.log(`[change-password] ${user.email} changed on Prognosis and locally`);
    void logAudit({ session, action: 'CHANGE_PASSWORD', resource: 'password', request: req, details: { prognosisSynced: true } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[change-password] Error:', err);
    return NextResponse.json({ error: 'Failed to change password. Please try again.' }, { status: 500 });
  }
}
