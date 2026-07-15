// Step 1 of internal staff sign-in: validates the Leadway email/AD password
// against Prognosis and sends the 2FA OTP. The actual session is only ever
// granted by NextAuth's staff-credentials authorize() (see auth.ts), which
// re-validates everything here — this route exists purely to surface the
// linked-clients list (which may be empty — the general staff console is
// always reachable regardless) and trigger the OTP before that final step.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { staffLogin } from '@/lib/prognosis-staff-login';
import { issueStaffLoginOtp } from '@/lib/staff-login-otp';
import { isDeviceTrusted } from '@/lib/staff-trusted-device';

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

  try {
    const staff = await staffLogin(email, password);
    if (!staff) {
      return NextResponse.json({ error: 'Invalid credentials. Please check your Leadway staff email and password.' }, { status: 401 });
    }

    // A valid Leadway AD login is not enough on its own — the account must
    // also have been explicitly enabled for this portal by an admin
    // (/admin/staff-access). Never auto-create or auto-enable here.
    const staffUser = await prisma.staffUser.findUnique({ where: { email: staff.email } });
    if (!staffUser || !staffUser.active) {
      console.log(`[staff/request-login-otp] email=${staff.email} rejected: not enabled for internal admin portal`);
      return NextResponse.json({
        error: 'Your account has not been enabled for the internal admin portal. Contact your administrator to be granted access.',
      }, { status: 403 });
    }

    await prisma.staffUser.update({ where: { id: staffUser.id }, data: { name: staff.name, role: staff.role } });

    const clients = await prisma.staffClientAccess.findMany({ where: { staffEmail: staff.email } });

    // Recognized device — skip sending an OTP entirely; the final sign-in
    // step re-checks trust server-side rather than trusting this response.
    if (await isDeviceTrusted(staffUser.id)) {
      return NextResponse.json({
        success: true,
        otpRequired: false,
        clients: clients.map((c) => ({ companyId: c.companyId, companyName: c.companyName })),
      });
    }

    const sent = await issueStaffLoginOtp(staffUser);
    if (!sent) return NextResponse.json({ error: 'Could not send the verification code. Please try again.' }, { status: 502 });

    return NextResponse.json({
      success: true,
      otpRequired: true,
      clients: clients.map((c) => ({ companyId: c.companyId, companyName: c.companyName })),
    });
  } catch (err) {
    console.error('[staff/request-login-otp] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to process login' }, { status: 500 });
  }
}
