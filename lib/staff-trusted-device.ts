// "Remember this device for 45 days" for internal staff sign-in — skips the
// OTP step on a recognized browser. Only ever an opaque random token in the
// cookie; the DB stores its hash, same pattern as OTP storage, so a stolen
// cookie value alone can't be reverse-engineered into anything meaningful
// and a leaked DB row can't be replayed as a cookie.
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export const TRUST_COOKIE_NAME = 'staff_trusted_device';
const TRUST_TTL_MS = 45 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function isDeviceTrusted(staffUserId: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(TRUST_COOKIE_NAME)?.value;
  if (!token) return false;

  const row = await prisma.staffTrustedDevice.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.staffUserId !== staffUserId || row.expiresAt < new Date()) return false;
  return true;
}

export async function trustThisDevice(staffUserId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TRUST_TTL_MS);

  await prisma.staffTrustedDevice.create({
    data: { staffUserId, tokenHash: hashToken(token), expiresAt },
  });

  const jar = await cookies();
  jar.set(TRUST_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}
