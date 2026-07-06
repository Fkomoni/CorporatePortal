import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/lib/audit';

// HR logins are validated against the local users table (bcrypt), so the
// password change must happen there — not in Prognosis.
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

  // Leadway password complexity policy
  if (newPassword.length < 8)              return NextResponse.json({ error: 'New password must be at least 8 characters long.' }, { status: 400 });
  if (!/[A-Z]/.test(newPassword))          return NextResponse.json({ error: 'New password must include at least one uppercase letter (A–Z).' }, { status: 400 });
  if (!/[a-z]/.test(newPassword))          return NextResponse.json({ error: 'New password must include at least one lowercase letter (a–z).' }, { status: 400 });
  if (!/[0-9]/.test(newPassword))          return NextResponse.json({ error: 'New password must include at least one number (0–9).' }, { status: 400 });
  if (!/[^A-Za-z0-9]/.test(newPassword))  return NextResponse.json({ error: 'New password must include at least one special character.' }, { status: 400 });

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email ?? '' } });
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    const currentOk = await bcrypt.compare(currentPassword, user.password);
    if (!currentOk) {
      void logAudit({ session, action: 'CHANGE_PASSWORD_FAILED', resource: 'password', request: req,
        details: { reason: 'incorrect current password' } });
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      return NextResponse.json({ error: 'New password must be different from the current password.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: passwordHash } });

    void logAudit({ session, action: 'CHANGE_PASSWORD', resource: 'password', request: req });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[change-password] Error:', err);
    return NextResponse.json({ error: 'Failed to change password. Please try again.' }, { status: 500 });
  }
}
