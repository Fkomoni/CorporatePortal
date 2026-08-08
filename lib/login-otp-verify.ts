// OTP verification for HR 2FA: kept separate from issuance (lib/login-otp.ts)
// because this module is reachable from Edge middleware via auth.ts and must
// not pull in email templating or other Node-only dependencies.
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const MAX_ATTEMPTS = 5;

export function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export type OtpCheck = 'ok' | 'invalid' | 'expired' | 'locked';

// Verifies the pending OTP for a user, consuming it on success. Increments the
// attempt counter on failure and invalidates the code after MAX_ATTEMPTS.
//
// Pass consume: false when a later step can still fail and the code should
// survive for a retry. The password reset does this: it checks the code, then
// asks Prognosis to confirm the password, and burning the emailed code on a
// mistyped password would send the user back for a new one every time.
export async function verifyLoginOtp(
  userId: string,
  code: string,
  options: { consume?: boolean } = {},
): Promise<OtpCheck> {
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

  if (options.consume !== false) await consumeLoginOtp(userId);
  return 'ok';
}

/** Clears a pending OTP and its attempt counter. */
export async function consumeLoginOtp(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { loginOtpHash: null, loginOtpExpiresAt: null, loginOtpAttempts: 0 },
  });
}
