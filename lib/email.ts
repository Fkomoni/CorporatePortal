// Email validation, in one place — used by every form that collects an address
// and every route that forwards one to Prognosis or sends mail to it.
//
// Prognosis stores whatever it is given without complaint: production already
// contains a member whose address is the literal string "noemail.com". It also
// rejects malformed addresses at send time with HTTP 200 and
// "fail: Invalid email address format" in the body, so a bad address silently
// costs the member their enrolee ID, e-card and every future notification.
//
// The pattern is deliberately conservative rather than RFC-complete: one @, no
// whitespace, and a dot-separated domain with a 2+ character TLD. That rejects
// the mistakes people actually make (missing @, trailing comma, "noemail.com",
// "user@localhost") without trying to out-lawyer the RFC.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/;

/** Trim and lowercase — Prognosis is case-sensitive when matching duplicates. */
export function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value: unknown): boolean {
  return EMAIL_RE.test(normalizeEmail(value));
}

export const EMAIL_FORMAT_MESSAGE = 'Enter a valid email address, e.g. amaka@company.com.';

/**
 * Validates an optional email field. Returns an error message, or null if the
 * value is acceptable (including empty, when the field isn't required).
 */
export function validateEmail(value: unknown, { required = false, label = 'Email' } = {}): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return required ? `${label} is required.` : null;
  if (!isValidEmail(raw)) return `${label}: ${EMAIL_FORMAT_MESSAGE}`;
  return null;
}
