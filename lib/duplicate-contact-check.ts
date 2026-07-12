// Flags emails/mobiles already registered to another member in the same
// group before calling AddPrincipalOnly/AddDependentsOnly — Prognosis
// accepts duplicate contact info silently, so this is our only guard.
//
// Confirmed via a raw dump of CorporateProfile/ClientPlanBeneficiariesNoPagitation
// (?group_id=&memberstatus=active): each row has real EmailAdress/Phone fields
// (unlike ViewMembersPerGroup, which doesn't return contact info at all), plus
// firstname/surname/cif_number/Enrolleeid. "noemail.com" appears as Prognosis's
// placeholder for "no email on file" and must never be treated as a real value.
const NO_EMAIL_PLACEHOLDER = 'noemail.com';

function normEmail(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase();
  return s === NO_EMAIL_PLACEHOLDER ? '' : s;
}

// Phone numbers in this data show up in wildly different formats for the same
// number (e.g. "07047704146", "+2347031779870", "704 770 4346", " 09169972771")
// — normalize to bare digits with the leading 0/234 stripped so they compare
// equal regardless of how each was originally entered.
function normPhone(v: unknown): string {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('234')) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export interface DuplicateClash {
  name: string;
  field: 'email address' | 'mobile number';
}

async function fetchBeneficiaries(base: string, token: string, groupId: string, memberstatus: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${base}/api/CorporateProfile/ClientPlanBeneficiariesNoPagitation?group_id=${encodeURIComponent(groupId)}&memberstatus=${memberstatus}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  const raw = await res.json().catch(() => null);
  return Array.isArray((raw as Record<string, unknown>)?.result)
    ? (raw as Record<string, unknown>).result as Record<string, unknown>[]
    : Array.isArray((raw as Record<string, unknown>)?.Result)
      ? (raw as Record<string, unknown>).Result as Record<string, unknown>[]
      : Array.isArray(raw) ? raw as Record<string, unknown>[] : [];
}

// A contact already used by ANY member — active or inactive — must be
// treated as taken: an inactive/terminated principal's record still exists
// in Prognosis and re-enrolling their old email/phone under a new person
// would collide with (or resurrect confusion around) that old record.
export async function findDuplicateContact(
  base: string, token: string, groupId: string, email: string, mobile: string,
): Promise<DuplicateClash | null> {
  const wantedEmail = normEmail(email);
  const wantedMobile = normPhone(mobile);
  if (!wantedEmail && !wantedMobile) return null;

  const [activeRows, inactiveRows] = await Promise.all([
    fetchBeneficiaries(base, token, groupId, 'active'),
    fetchBeneficiaries(base, token, groupId, 'inactive'),
  ]);
  const rows = [...activeRows, ...inactiveRows];

  console.log(`[duplicate-contact-check] groupId=${groupId} activeRows=${activeRows.length} inactiveRows=${inactiveRows.length}`);

  for (const row of rows) {
    const rowEmail = normEmail(row['EmailAdress']);
    const rowMobile = normPhone(row['Phone']);
    const emailClash = wantedEmail && rowEmail === wantedEmail;
    const mobileClash = wantedMobile && rowMobile === wantedMobile;
    if (emailClash || mobileClash) {
      const name = `${row['firstname'] ?? ''} ${row['surname'] ?? ''}`.trim() || 'another member';
      return { name, field: emailClash ? 'email address' : 'mobile number' };
    }
  }
  return null;
}
