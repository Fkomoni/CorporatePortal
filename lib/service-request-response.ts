// The link that lets Leadway staff answer a service request from the email,
// without a portal login.
//
// Anyone holding the link may respond: it is mailed to the queue and the
// assigned admins, and a mail that gets forwarded to the colleague who actually
// owns the answer should still work. That is a deliberate trade, so the token
// is built to be worth no more than the one request it opens:
//
//   - 256 bits from crypto.randomBytes, so it cannot be guessed or enumerated
//   - scoped to one request. It carries no session and grants nothing else
//   - read-only plus one reply. It cannot see other requests, other companies,
//     or any member data
//   - expires, so an old forwarded email stops working
//   - cleared once the request is resolved, so a link cannot reopen a closed
//     ticket or overwrite an answer
import crypto from 'crypto';

/** Long enough that guessing is hopeless, short enough to survive email clients. */
export function newResponseToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** How long a mailed link stays usable. */
export const RESPONSE_TOKEN_DAYS = 30;

export function responseTokenExpiry(from: Date): Date {
  return new Date(from.getTime() + RESPONSE_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

/** Statuses a responder may set. Anything else is rejected. */
export const RESPONSE_STATUSES = ['Responded', 'Resolved'] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export function isResponseStatus(v: unknown): v is ResponseStatus {
  return typeof v === 'string' && (RESPONSE_STATUSES as readonly string[]).includes(v);
}

export const MAX_RESPONSE_LENGTH = 4000;

/** Absolute URL for the emailed link. */
export function responseUrl(token: string): string {
  const base = (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://corporateportal.onrender.com')
    .replace(/\/$/, '');
  return `${base}/respond/${token}`;
}

/**
 * Why a token cannot be used, or null when it can.
 * Kept here so the page and the write path cannot disagree about it.
 */
export function tokenRefusal(
  req: { responseToken: string | null; responseTokenExpires: Date | null; status: string },
  now: Date,
): string | null {
  if (!req.responseToken) {
    return 'This request has already been resolved, so the link is no longer active.';
  }
  if (req.responseTokenExpires && req.responseTokenExpires < now) {
    return `This link expired after ${RESPONSE_TOKEN_DAYS} days. Reply to the original email instead.`;
  }
  return null;
}
