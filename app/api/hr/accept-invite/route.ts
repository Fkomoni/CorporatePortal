// Completes a portal-user invitation: validates the invite token, enforces
// the password policy, activates the account.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  let body: { token?: string; email?: string; password?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  if (!token || !email || !password) {
    return NextResponse.json({ error: 'Token, email and password are required.' }, { status: 400 });
  }

  // Leadway password complexity policy
  if (password.length < 8)              return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
  if (!/[A-Z]/.test(password))          return NextResponse.json({ error: 'Password must include at least one uppercase letter (A–Z).' }, { status: 400 });
  if (!/[a-z]/.test(password))          return NextResponse.json({ error: 'Password must include at least one lowercase letter (a–z).' }, { status: 400 });
  if (!/[0-9]/.test(password))          return NextResponse.json({ error: 'Password must include at least one number (0–9).' }, { status: 400 });
  if (!/[^A-Za-z0-9]/.test(password))  return NextResponse.json({ error: 'Password must include at least one special character.' }, { status: 400 });

  try {
    const invite = await prisma.verificationToken.findUnique({ where: { token } });
    if (!invite || invite.identifier !== `invite:${email}`) {
      return NextResponse.json({ error: 'This invitation link is invalid.' }, { status: 400 });
    }
    if (invite.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.json({ error: 'This invitation has expired. Ask your administrator to send a new one.' }, { status: 410 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: 'Invited account not found. Ask your administrator to re-invite you.' }, { status: 404 });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, active: true },
    });
    await prisma.verificationToken.delete({ where: { token } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[accept-invite] Error:', err);
    return NextResponse.json({ error: 'Failed to activate your account. Please try again.' }, { status: 500 });
  }
}
