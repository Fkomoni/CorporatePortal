// Turns a backend/Prognosis error into something worth showing an HR user.
//
// Prognosis leaks its internals on failure — a raw SQL Server connection trace
// ("A network-related or instance-specific error occurred while establishing a
// connection to SQL Server...") or a bare "An error has occurred." Rendering
// those verbatim tells HR nothing, gets truncated mid-sentence, and exposes
// Leadway's infrastructure detail. The raw text still belongs in our logs.
const OUTAGE_PATTERNS = [
  /sql server/i,
  /network-related or instance-specific/i,
  /an error has occurred/i,
  /timeout expired/i,
  /a transport-level error/i,
  /econnrefused|etimedout|enotfound|socket hang up/i,
  /prognosis error 5\d\d/i,
  /\b5\d\d\b.*(gateway|unavailable|internal server)/i,
  // When Prognosis throws, IIS answers with an ASP.NET error page instead of
  // JSON. Our routes wrap that as "Service login non-JSON (500): <!DOCTYPE
  // html>…", which matched none of the patterns above, so 240 characters of
  // raw markup were rendered to HR — truncated mid-word. Catch the shape of
  // the failure rather than its wording.
  /non-json/i,
  /<!doctype|<html|<head|<title>runtime error/i,
  /no token from/i,
];

export const OUTAGE_MESSAGE =
  "Leadway's system is temporarily unavailable, so this couldn't be loaded. Please try again in a few minutes.";

/**
 * @param raw     the error text from the API
 * @param fallback shown when there is no usable message at all
 */
export function friendlyError(raw: unknown, fallback = OUTAGE_MESSAGE): string {
  const text = String(raw ?? '').trim();
  if (!text) return fallback;
  if (OUTAGE_PATTERNS.some((re) => re.test(text))) return OUTAGE_MESSAGE;
  // Our own validation messages are written for HR and should pass through, but
  // cap the length so an unexpected stack trace can't fill the screen.
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}
