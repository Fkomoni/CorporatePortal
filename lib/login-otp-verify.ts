// OTP verification for HR 2FA — kept separate from issuance (lib/login-otp.ts)
// because this module is reachable from Edge middleware via auth.ts and must
// not pull in email templating or other Node-only dependencies.
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const MAX_ATTEMPTS = 5;

export function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export type OtpCheck = 'ok' | 'invalid' | 'expired' | 'locked';

// Verifies and consumes the pending OTP for a user. Increments the attempt
// counter on failure and invalidates the code after MAX_ATTEMPTS.
export async function verifyLoginOtp(userId: string, code: string): Promise<OtpCheck> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.loginOtpHash || !user.loginOtpExpiresAt) return 'invalid';

  if (user.loginOtpAttempts >= MAX_ATTEMPTS) return 'locked';
  if (user.loginOtpExpiresAt < new Date()) return 'expired';

  if (hashOtp(code) !== user.loginOtpHash) {
    const attempts = user.loginOtpAttempts + 1;
    await prisma.user.update({
      where: { id: userId },
      data: attempts >= MAX_ATTEMPTS
        ? { loginOtpAttempts: attempts, loginOtpHash: null, loginOtpExpiresAt: null }
        : { loginOtpAttempts: attempts },
    });
    return attempts >= MAX_ATTEMPTS ? 'locked' : 'invalid';
  }

  // Success: consume the code
  await prisma.user.update({
    where: { id: userId },
    data: { loginOtpHash: null, loginOtpExpiresAt: null, loginOtpAttempts: 0 },
  });
  return 'ok';
}
