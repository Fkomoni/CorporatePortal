// Called right after a successful staff sign-in, only if the user opted
// into "Remember this device for 45 days" — sets the trust cookie so the
// next login from this browser skips the OTP step.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { trustThisDevice } from '@/lib/staff-trusted-device';

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // id is the underlying StaffUser id for both the general staff console
  // session (loginType 'staff') and an internal-admin-as-HR session
  // (loginType 'hr' with isInternalStaff) — never for a real HR/company account.
  if (session.user.loginType !== 'staff' && !session.user.isInternalStaff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await trustThisDevice(session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[staff/trust-device] Error:', err);
    return NextResponse.json({ error: 'Failed to remember this device.' }, { status: 500 });
  }
}
