// Short tag for console.log lines so a specific HR user's actions can be
// picked out of the shared Render log stream, since most routes previously
// logged with no indication of which logged-in user triggered them.
export function logTag(email?: string | null): string {
  return email ? `[user:${email}]` : '[user:unknown]';
}
