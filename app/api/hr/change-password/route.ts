import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';

// HR sign-in requires both the local bcrypt hash and Prognosis to accept the
// password, on every attempt. This route can only change the first of those:
// Prognosis's ChangePassword model carries no username or email, so it acts on
// whoever the bearer token belongs to, and the only token this app holds is the
// shared integration account's. It was being called here with that token, which
// could never have changed the signed-in user's password and would have rotated
// the integration credential if it had landed.
//
// So a portal password change on its own leaves an account unable to sign in.
// This route says that plainly rather than reporting success.
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  // Refused before anything is read or written. Writing a new local hash would
  // leave this account with two passwords and no working one: the new password
  // would pass bcrypt and be refused by Prognosis, the old one would pass
  // Prognosis and be refused by bcrypt. Since the portal cannot change the
  // Prognosis side, the only outcome available here is a locked-out account, so
  // it is not offered. Validating the new password first and then refusing would
  // only waste the user's time.
  void logAudit({ session, action: 'CHANGE_PASSWORD_REFUSED', resource: 'password', request: req,
    details: { reason: 'portal cannot change the Prognosis password' } });
  return NextResponse.json({
    error: 'Your sign-in password is held by Leadway Health, not the portal, and is checked there every time you sign in. '
      + 'Change it with Leadway Health, then use the new password here. Changing it in the portal alone would lock you out.',
  }, { status: 409 });
}
