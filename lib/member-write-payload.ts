// The write shape for EnrolleeProfile/UpdateBiodata (principal) and
// UpdateBeneficiary (dependant).
//
// Both are a full-record replace, not a patch, so every field has to be sent:
// the member's current bio is read, mapped onto this shape unchanged, and only
// the edited fields overlaid. Extracted from the update-info route so the
// relationship repair writes byte-identical records rather than a second copy
// of fifty field mappings that can drift.
import { normalizeNigerianMobile } from '@/lib/phone';
import { normalizeEmail } from '@/lib/email';
import { sexIdFromText } from '@/lib/gender';
export function s(v: unknown): string {
  return v == null || String(v).trim().toLowerCase() === 'null' ? '' : String(v).trim();
}

export function n(v: unknown): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

// UpdateBiodata/UpdateBeneficiary reject any DateOfBirth/startdate/Effectivedate
// with a time component: bio reads return full ISO timestamps.
export function dateOnly(v: unknown): string {
  const str = s(v);
  const match = str.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

// Bio may return a label or numeric ID; write endpoint wants "1"-"4" as a string.
export function maritalStatusId(row: Record<string, unknown>): string {
  const raw = s(row['Member_MaritalStatusID']) || s(row['Member_maritalstatusDescr']);
  if (/^[1-4]$/.test(raw)) return raw;
  const label = raw.toLowerCase();
  if (label.startsWith('single')) return '1';
  if (label.startsWith('married')) return '2';
  if (label.startsWith('divorced')) return '3';
  if (label.startsWith('widow')) return '4';
  return '';
}

// LGAID is 0 when unset, but sending the string "0" makes Prognosis look up a
// nonexistent LGA and throw a server-side FK exception.
export function postalTownId(row: Record<string, unknown>): string {
  const v = s(row['LGAID']);
  return v === '0' ? '' : v;
}

// Empty string trips an internal type-conversion exception on these two:
// must be null, not "", when unset.
export function nullableStr(v: unknown): string | null {
  const str = s(v);
  return str ? str : null;
}

/**
 * The Relationship_ID to write back.
 *
 * Dependant FK mapping confirmed from Prognosis: Spouse=23, Son=8, Daughter=7,
 * everything else (Father/Mother/Brother/Sister/Other)=41.
 *
 * The principal is the part that was wrong. This used to take only the row, so
 * a main member whose numeric ID was missing fell through to the label branch,
 * where "Main member" starts with none of spouse/son/daughter and landed on
 * `if (label) return '41'`: editing a healthy principal's phone number rewrote
 * their relationship as Other. With no label either, it returned '' and rewrote
 * the blank, so a principal registered with the bad "1" could never recover by
 * being edited. A principal is now always written as the main member, and the
 * dependant branch can never return that ID by accident.
 */
export function relationshipIdFor(
  row: Record<string, unknown>,
  opts: { isPrincipal: boolean; mainMemberId: string },
): string {
  if (opts.isPrincipal) return opts.mainMemberId;
  const existing = s(row['Member_RelationshipID']);
  if (/^\d+$/.test(existing) && existing !== opts.mainMemberId) return existing;
  const label = s(row['Member_RelationshipToPrincipal']).toLowerCase();
  if (label.startsWith('spouse')) return '23';
  if (label.startsWith('son')) return '8';
  if (label.startsWith('daughter')) return '7';
  if (label && !label.startsWith('main')) return '41';
  return '';
}

export interface MemberWriteOverrides {
  dateOfBirth?: string;
  sexId?: string;
  email?: string;
  mobile?: string;
  address?: string;
  nin?: string;
  /** Raw base64, no data: prefix. Echoing the stored photo back trips a ~900KB limit. */
  photo?: string;
  photoType?: string;
  reason?: string;
}

/**
 * Maps a member's current bio row onto the write shape, overlaying only what
 * the caller is actually changing. Everything else is passed through so nothing
 * Prognosis already holds gets blanked.
 */
export function buildMemberWritePayload(args: {
  row: Record<string, unknown>;
  enrolleeId: string;
  groupId: string | number;
  cifNumber: unknown;
  isPrincipal: boolean;
  mainMemberId: string;
  overrides?: MemberWriteOverrides;
}): Record<string, unknown> {
  const { row, enrolleeId, groupId, cifNumber, isPrincipal, mainMemberId } = args;
  const o = args.overrides ?? {};

  return {
    groupid: n(groupId) || n(row['Client_GroupID']) || 0,
    MemberShipNo: s(row['Member_EnrolleeID']) || enrolleeId,
    Parent_Cif: n(row['Member_ParentMemberUniqueID']),
    Cif_number: n(cifNumber),
    FirstName: s(row['Member_FirstName']),
    Surname: s(row['Member_Surname']),
    othernames: s(row['Member_othernames']),
    DateOfBirth: o.dateOfBirth ? dateOnly(o.dateOfBirth) : dateOnly(row['Member_DateOfBirth']),
    startdate: dateOnly(row['Member_Entry_date']),
    employmentdate: dateOnly(row['Member_Entry_date']),
    Sex_ID: o.sexId || sexIdFromText(row['Member_Gender']),
    MaritalStatus: maritalStatusId(row),
    EmailAdress: o.email ? normalizeEmail(o.email) : s(row['Member_EmailAddress_One']),
    Home_Phone: s(row['Member_Phone_Three']),
    Work_Phone: s(row['Member_Phone_Four']),
    Mobile: o.mobile ? normalizeNigerianMobile(o.mobile) : normalizeNigerianMobile(row['Member_Phone_One']),
    Mobile2: normalizeNigerianMobile(row['Member_Phone_Two']),
    Postal_Phone: normalizeNigerianMobile(row['Member_Phone_Five']),
    Hospital: s(row['Member_PCP']),
    Scheme: s(row['Member_Plan']),
    schemeid: n(row['Member_PlanID']),
    MemberType: s(row['Member_Membertype']) || s(row['Member_MemberTypeID']),
    BaseAmount: Math.round(n(row['Member_IndividualPremium'])),
    // regionid=0 gets rejected outright ("Invalid state of origin"/"Invalid
    // country"): some dependant bio records have no StateID on file at all, so
    // fall back to a valid default rather than sending 0.
    regionid: n(row['StateID']) || 1,
    titleid: n(row['Member_TitleID']),
    Physical_Add1: (isPrincipal && o.address) || s(row['Member_Address']),
    Postal_Town_ID: postalTownId(row),
    Relationship_ID: relationshipIdFor(row, { isPrincipal, mainMemberId }),
    BloodGroup: s(row['Member_BloodGroup']),
    genotype: s(row['Member_Genotype']),
    PreExistingCondition: nullableStr(row['PreExistingCondition']),
    OfflineID: nullableStr(row['OfflineID']),
    DeviceID: nullableStr(row['MobileAppDeviceID']),
    employeecode: s(row['Member_staffid']),
    EnrolleePicture: isPrincipal && o.photo ? o.photo : '',
    EnrolleePictureType: isPrincipal && o.photo ? (o.photoType || 'jpeg') : '',
    surburb_id: n(row['surburb_id']),
    idTypeID: s(row['idTypeID']),
    cadre: s(row['Member_cadre']),
    registrationsource: 'CorporatePortal',
    UserCaptured: enrolleeId,
    Effectivedate: dateOnly(row['Member_Entry_date']),
    Reason: o.reason ?? 'Profile self-service update',
    memberNin: o.nin || s(row['NIN']),
    Dependents: n(row['Member_FamilyNo']),
  };
}
