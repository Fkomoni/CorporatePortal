// Nigerian mobile number handling, in one place: used by every form that
// collects a phone number and by every route that forwards one to Prognosis.
//
// Accepted input shapes (all the same number):
//   08012345678      11 digits, national format with trunk '0'
//   8012345678       10 digits, trunk '0' omitted
//   2348012345678    13 digits, country code without '+'
//   +2348012345678   E.164
// Separators (spaces, dashes, brackets) are ignored.
//
// The 10-digit core must start 7, 8 or 9: every Nigerian mobile network code
// (70x, 71x, 80x, 81x, 90x, 91x) falls in that range, while landlines and
// invalid junk do not. Prognosis stores these as +234XXXXXXXXXX.

/** Strips everything except digits. Use to sanitise numeric inputs as they're typed. */
export function digitsOnly(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Reduces any accepted shape to the 10-digit national core (e.g. "8012345678"),
 * or '' if the input can't be one. Does not validate the network code.
 */
function coreDigits(value: unknown): string {
  const raw = String(value ?? '').trim();
  // Separators are fine, but anything else (letters especially) means this was
  // never a phone number. Don't strip it down into a plausible-looking one.
  if (/[^\d\s()+.\-]/.test(raw)) return '';
  const d = digitsOnly(raw);
  if (!d) return '';
  if (d.length === 13 && d.startsWith('234')) return d.slice(3);
  if (d.length === 14 && d.startsWith('2340')) return d.slice(4); // +234 0XXXXXXXXXX
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  if (d.length === 10) return d;
  return '';
}

/** True if the value is a usable Nigerian mobile number. */
export function isValidNigerianMobile(value: unknown): boolean {
  return /^[789]\d{9}$/.test(coreDigits(value));
}

/**
 * Normalises to the +234XXXXXXXXXX form Prognosis expects.
 * Returns '' for empty input, and the original trimmed value when it isn't a
 * recognisable Nigerian mobile: callers should validate first rather than rely
 * on this to sanitise.
 */
export function normalizeNigerianMobile(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const core = coreDigits(raw);
  return /^[789]\d{9}$/.test(core) ? `+234${core}` : raw;
}

/** Shared message so every form/route words the rejection identically. */
export const MOBILE_FORMAT_MESSAGE =
  'Enter a valid Nigerian mobile number: 11 digits starting with 0 (e.g. 08012345678).';

/**
 * Validates an optional mobile field. Returns an error message, or null if the
 * value is acceptable (including empty, when the field isn't required).
 */
export function validateMobile(value: unknown, { required = false, label = 'Mobile number' } = {}): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return required ? `${label} is required.` : null;
  if (!isValidNigerianMobile(raw)) return `${label}: ${MOBILE_FORMAT_MESSAGE}`;
  return null;
}

/**
 * Live hint while a mobile number is being typed. Returns null when the value is
 * empty or already acceptable, so it can be rendered unconditionally.
 *
 * Inputs strip non-digits and cap at 11, so in practice the only way to be wrong
 * is to stop short: say how many digits are missing rather than waiting for a
 * submit-time rejection.
 */
export function mobileLengthHint(value: unknown): string | null {
  const d = digitsOnly(String(value ?? ''));
  if (!d) return null;
  if (isValidNigerianMobile(d)) return null;
  // 11 digits with the trunk '0' (08012345678), 10 without (8012345678).
  const expected = d.startsWith('0') ? 11 : 10;
  if (d.length < expected) {
    const missing = expected - d.length;
    return `${missing} more digit${missing === 1 ? '' : 's'} needed`;
  }
  return MOBILE_FORMAT_MESSAGE;
}

/** Live hint while a NIN is being typed. Null when empty or complete. */
export function ninLengthHint(value: unknown): string | null {
  const d = digitsOnly(String(value ?? ''));
  if (!d || d.length === 11) return null;
  const missing = 11 - d.length;
  return `${missing} more digit${missing === 1 ? '' : 's'} needed`;
}

/** NIN is exactly 11 digits. */
export function isValidNin(value: unknown): boolean {
  return /^\d{11}$/.test(digitsOnly(String(value ?? '')));
}

export const NIN_FORMAT_MESSAGE = 'NIN must be exactly 11 digits.';
