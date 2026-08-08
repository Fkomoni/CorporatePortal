// Client-safe helpers for the relationship dropdowns. No imports on purpose:
// this is reached from the People page, so it must not pull server-only code
// (Prognosis credentials, prisma) into the browser bundle. lib/principal-
// relationship.ts imports isMainMemberText from here so the browser and the
// server agree on what counts as a main member.

export interface RelationshipOption {
  text: string;
  value: string;
}

/**
 * Whether a relationship label means the principal themselves.
 *
 * Matched on normalised text because the live label carries a trailing tab
 * ("Main member\t"), so an equality check against 'Main member' silently lets it
 * through. Casing and spacing vary between endpoints too.
 */
export function isMainMemberText(text: string): boolean {
  const t = text.toLowerCase().replace(/[^a-z]/g, '');
  return t === 'mainmember' || t === 'principal' || t === 'mainmemberprincipal';
}

/**
 * The relationships a dependant may hold: everything except the principal's own.
 *
 * GetBeneficiaryRelationship lists "Main member" alongside Spouse, Son and the
 * rest. Offering it on a dependant form invited HR to file a child as the main
 * member of the family.
 */
export function dependantRelationships(options: RelationshipOption[]): RelationshipOption[] {
  return options.filter((r) => !isMainMemberText(r.text));
}

/**
 * Prognosis dates arrive ISO ("2021-03-02T15:59:00") or day-first
 * ("02/03/2021"); a date input's min attribute needs yyyy-mm-dd. Returns '' for
 * anything unreadable, so callers can treat "no floor" and "bad date" alike
 * rather than producing an input that rejects every value.
 */
export function toIsoDate(value: string | null | undefined): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * The earliest date a dependant's cover may start: the later of the policy
 * year's start and the principal's own start date, since cover cannot begin
 * before the person being joined. Either may be unknown, in which case the
 * other stands alone; with neither, there is no floor.
 *
 * ISO dates sort lexicographically, so the last of the sorted pair is the later.
 */
export function coverStartFloor(policyYearStart: string, principalStart: string): string {
  return [policyYearStart, principalStart].filter(Boolean).sort().pop() ?? '';
}
