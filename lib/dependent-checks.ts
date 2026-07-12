// Guards against double-enrolling the same dependant under a principal, and
// against exceeding a scheme's max family size — enforced both when HR adds
// a dependant directly and when approving a pending self-registration (the
// Enrolee App self-registration path bypasses add-dependents entirely, so
// approval is the only checkpoint for those).
export interface FamilyMember {
  cifNumber: string;
  firstName: string;
  surname: string;
  dateOfBirth: string; // normalized YYYY-MM-DD, '' if unknown
  isPrincipal: boolean;
}

function normDob(v: unknown): string {
  const s = String(v ?? '').trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO, e.g. GetGroupBeneficiaries
  if (match) return match[0];
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/); // dd/mm/yyyy or dd-mm-yyyy
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

async function fetchFamilyByStatus(base: string, token: string, groupId: string, parentCif: string, memberstatus: string): Promise<FamilyMember[]> {
  const res = await fetch(
    `${base}/api/CorporateProfile/ClientPlanBeneficiariesNoPagitation?group_id=${encodeURIComponent(groupId)}&memberstatus=${memberstatus}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  const raw = await res.json().catch(() => null);
  const rows: Record<string, unknown>[] = Array.isArray((raw as Record<string, unknown>)?.result)
    ? (raw as Record<string, unknown>).result as Record<string, unknown>[]
    : Array.isArray((raw as Record<string, unknown>)?.Result)
      ? (raw as Record<string, unknown>).Result as Record<string, unknown>[]
      : Array.isArray(raw) ? raw as Record<string, unknown>[] : [];

  return rows
    .filter((r) => String(r['parentcif'] ?? '') === String(parentCif))
    .map((r) => ({
      cifNumber: String(r['cif_number'] ?? ''),
      firstName: String(r['firstname'] ?? ''),
      surname: String(r['surname'] ?? ''),
      dateOfBirth: normDob(r['Member_DateOfBirth']),
      isPrincipal: String(r['IsDependant'] ?? '').toLowerCase() !== 'yes',
    }));
}

/** All family members (active + inactive) under a principal's CIF. */
export async function getPrincipalFamily(base: string, token: string, groupId: string, parentCif: string): Promise<FamilyMember[]> {
  const [active, inactive] = await Promise.all([
    fetchFamilyByStatus(base, token, groupId, parentCif, 'active'),
    fetchFamilyByStatus(base, token, groupId, parentCif, 'inactive'),
  ]);
  return [...active, ...inactive];
}

export interface DuplicateDependent {
  name: string;
  cifNumber: string;
}

/** Matches by date of birth against everyone already in the family — the
 * simplest reliable dedup signal for a dependant who may have been entered
 * with slightly different name spelling/casing across two registrations. */
export function findDuplicateDependent(family: FamilyMember[], dateOfBirth: string, excludeCif?: string): DuplicateDependent | null {
  const wantedDob = normDob(dateOfBirth);
  if (!wantedDob) return null;
  const match = family.find((m) => m.dateOfBirth && m.dateOfBirth === wantedDob && String(m.cifNumber) !== String(excludeCif ?? ''));
  if (!match) return null;
  return { name: `${match.firstName} ${match.surname}`.trim() || 'an existing dependant', cifNumber: match.cifNumber };
}

/** Fetches the scheme's MaximumFamilySize (principal + dependants combined),
 * or null if it couldn't be resolved — callers should skip the limit check
 * rather than block on an unresolved limit. */
export async function getSchemeMaxFamilySize(base: string, token: string, groupId: string, schemeId: string): Promise<number | null> {
  if (!schemeId) return null;
  try {
    const res = await fetch(`${base}/api/CorporatePortal/GetPolicySchemes?groupId=${encodeURIComponent(groupId)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const raw = await res.json().catch(() => null);
    const arr: Record<string, unknown>[] = Array.isArray(raw) ? raw
      : Array.isArray((raw as Record<string, unknown>)?.data) ? (raw as Record<string, unknown>).data as Record<string, unknown>[]
      : Array.isArray((raw as Record<string, unknown>)?.Data) ? (raw as Record<string, unknown>).Data as Record<string, unknown>[]
      : Array.isArray((raw as Record<string, unknown>)?.result) ? (raw as Record<string, unknown>).result as Record<string, unknown>[]
      : [];
    const match = arr.find((r) => String(r['PlanID'] ?? r['PlanId'] ?? '') === String(schemeId));
    const maxFam = match?.['MaximumFamilySize'];
    const n = maxFam != null ? Number(maxFam) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
