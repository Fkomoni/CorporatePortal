// Prognosis's Sex_ID convention, in one place.
//
// Confirmed against Prognosis's own list — GET /api/ListValues/GetGender
// returns exactly {"Sex_id": 1, "Sex": "Male"} and {"Sex_id": 2, "Sex":
// "Female"} — and corroborated by production members: Favour Mbaekwe is
// sex_id 2 / Member_Gender "Female", Dante Mbaekwe is sex_id 1 / "Male".
// So 1 = Male, 2 = Female, matching what AddPrincipalOnly/AddFamily/
// AddDependentsOnly have always sent.
//
// (update-info's local sexIdFromBio previously mapped this the other way round,
// which would have written the opposite gender whenever HR edited a member whose
// gender field was being derived from their bio rather than picked in the form.)
//
// Note the gender dropdowns themselves are populated from GetGender (singular —
// the plural spelling 405s), so form-submitted values are already Prognosis's
// own IDs and need no mapping. These helpers are only for translating to/from
// the free-text gender that bio reads return.
//
// Do NOT use the `Gender` column on ClientPlanBeneficiariesNoPagitation: it is
// unreliable (padded junk such as "B" for some members, "M" for others).
// sex_id is the field to trust.
export const SEX_ID_MALE = '1';
export const SEX_ID_FEMALE = '2';

/** "Male"/"Female" (or an already-numeric id) → Prognosis Sex_ID. '' if unknown. */
export function sexIdFromText(value: unknown): string {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === SEX_ID_MALE || v === SEX_ID_FEMALE) return v;
  if (v.startsWith('m')) return SEX_ID_MALE;
  if (v.startsWith('f')) return SEX_ID_FEMALE;
  return '';
}

/** Prognosis Sex_ID → "Male"/"Female". '' if unknown. */
export function genderLabelFromSexId(value: unknown): string {
  const v = String(value ?? '').trim();
  if (v === SEX_ID_MALE) return 'Male';
  if (v === SEX_ID_FEMALE) return 'Female';
  return '';
}
