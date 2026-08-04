// Prognosis's Sex_ID convention, in one place.
//
// Confirmed from production data: Favour Mbaekwe reads Member_Gender "Female"
// on GetEnrolleeBioDataByEnrolleeID and sex_id 2 on
// ClientPlanBeneficiariesNoPagitation — so 1 = Male, 2 = Female. This also
// matches what AddPrincipalOnly/AddFamily/AddDependentsOnly have always sent.
//
// (update-info's local sexIdFromBio previously mapped this the other way round,
// which would have written the opposite gender whenever HR edited a member whose
// gender field was being derived from their bio rather than picked in the form.)
//
// Note the gender dropdowns themselves are populated from Prognosis's GetGenders
// list (Sex_id / Sex), so form-submitted values are always Prognosis's own IDs
// and need no mapping — these helpers are only for translating to/from the
// free-text gender that bio reads return.
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
