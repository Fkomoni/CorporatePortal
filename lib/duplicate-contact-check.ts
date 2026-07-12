// Flags emails/mobiles already registered to another member in the same
// group before calling AddPrincipalOnly/AddDependentsOnly — Prognosis
// accepts duplicate contact info silently, so this is our only guard.
//
// ViewMembersPerGroup's exact field names/casing aren't documented and have
// repeatedly turned out to differ from what we guessed for other endpoints,
// so this does a case-insensitive lookup across every alias we've seen
// anywhere in this codebase, rather than a fixed set of exact-case keys —
// a mismatch here means the check silently never fires and duplicates get
// through undetected.
const EMAIL_KEYS = [
  'EmailAdress', 'Email', 'EmailAddress', 'Member_EmailAddress_One', 'Member_EmailAddress_Two', 'EmailAddr',
];
const MOBILE_KEYS = [
  'Mobile', 'Mobile1', 'Mobile2', 'Phone', 'MobileNumber', 'MemberPhone', 'PhoneNumber', 'GSMNo', 'MobileNo', 'GSM',
  'Member_Phone_One', 'Member_Phone_Two', 'Member_Phone_Three', 'Member_Phone_Four', 'Member_Phone_Five',
];

function lookup(row: Record<string, unknown>, keys: string[]): string {
  const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const key of keys) {
    const actualKey = lowerMap.get(key.toLowerCase());
    if (!actualKey) continue;
    const v = row[actualKey];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

export interface DuplicateClash {
  name: string;
  field: 'email address' | 'mobile number';
}

export async function findDuplicateContact(
  base: string, token: string, groupId: string, email: string, mobile: string,
): Promise<DuplicateClash | null> {
  const res = await fetch(`${base}/api/CorporatePortal/ViewMembersPerGroup?groupId=${encodeURIComponent(groupId)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const raw = await res.json().catch(() => null);
  const rows: Record<string, unknown>[] = Array.isArray(raw) ? raw
    : Array.isArray((raw as Record<string, unknown>)?.data) ? (raw as Record<string, unknown>).data as Record<string, unknown>[]
    : Array.isArray((raw as Record<string, unknown>)?.Data) ? (raw as Record<string, unknown>).Data as Record<string, unknown>[]
    : Array.isArray((raw as Record<string, unknown>)?.result) ? (raw as Record<string, unknown>).result as Record<string, unknown>[]
    : Array.isArray((raw as Record<string, unknown>)?.Result) ? (raw as Record<string, unknown>).Result as Record<string, unknown>[]
    : [];

  const norm = (v: string) => v.trim().toLowerCase();
  const wantedEmail = norm(email ?? '');
  const wantedMobile = norm(mobile ?? '');
  if (!wantedEmail && !wantedMobile) return null;

  console.log(`[duplicate-contact-check] groupId=${groupId} rows=${rows.length} sampleKeys=${rows[0] ? Object.keys(rows[0]).join(',') : 'none'}`);

  for (const row of rows) {
    const rowEmail = norm(lookup(row, EMAIL_KEYS));
    const rowMobile = norm(lookup(row, MOBILE_KEYS));
    const emailClash = wantedEmail && rowEmail === wantedEmail;
    const mobileClash = wantedMobile && rowMobile === wantedMobile;
    if (emailClash || mobileClash) {
      const name = lookup(row, ['FirstName', 'Member_FirstName']) || lookup(row, ['Surname', 'Member_Surname'])
        ? `${lookup(row, ['FirstName', 'Member_FirstName'])} ${lookup(row, ['Surname', 'Member_Surname'])}`.trim()
        : 'another member';
      return { name, field: emailClash ? 'email address' : 'mobile number' };
    }
  }
  return null;
}
