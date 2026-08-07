// Parsing and validation for the bulk enrolment spreadsheet.
//
// Pure functions, deliberately outside the People page: the family-resolution
// rules are the part of this feature most likely to be wrong in a way nobody
// notices until a spouse is enrolled against the wrong employee, so they are
// kept where they can be tested directly rather than only through a file
// upload in a browser.
import type { Member } from '@/lib/types';
// Same source lib/list-values-client.ts uses: type-only, so nothing from the
// route module ends up in the bundle.
import type { RelationshipOption } from '@/app/api/hr/list-values/route';

// Excel stores a typed date as a serial number (days from 1899-12-30), and
// xlsx hands it back as a Date when cellDates is on. HR also pastes plain
// text. All three shapes have to resolve to YYYY-MM-DD, or fail loudly -
// silently rejecting a date that looks right on screen is the worst outcome.
export function normaliseDob(value: unknown): string | null {
  const iso = (y: number, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    // Rejects impossible dates that would otherwise roll over (e.g. 31 Feb).
    if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    if (y < 1900 || dt.getTime() > Date.now()) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  if (value instanceof Date && !isNaN(value.getTime())) {
    return iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  // Bare Excel serial, for files read without cellDates.
  if (typeof value === 'number' && value > 0 && value < 80000) {
    const dt = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return iso(+isoMatch[1], +isoMatch[2], +isoMatch[3]);

  // Day-first: the format the template asks for and Nigerian convention.
  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) return iso(+dmy[3], +dmy[2], +dmy[1]);

  // "1 Jan 1990" / "01 January 1990"
  const named = text.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,})[\s-]+(\d{4})$/);
  if (named) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const m = months.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
    if (m > 0) return iso(+named[3], m, +named[1]);
  }

  // Numeric serial that arrived as text.
  if (/^\d+(\.\d+)?$/.test(text)) return normaliseDob(Number(text));

  return null;
}

// Returns Prognosis's sexId ('1' male, '2' female), or '' when the value is
// not recognisably either: the caller turns that into a row error.
export function parseGender(value: string): string {
  const v = value.trim().toLowerCase();
  if (['m', 'male', 'man', 'mr'].includes(v)) return '1';
  if (['f', 'female', 'woman', 'mrs', 'ms', 'miss'].includes(v)) return '2';
  return '';
}

// Words that mean "this row is the employee, not a dependant". A blank
// Relationship column means the same thing, so census files written before the
// column existed still parse as all-principals.
const PRINCIPAL_WORDS = ['principal', 'principal member', 'employee', 'staff', 'self', 'main', 'primary', 'p'];

export function isPrincipalWord(value: string): boolean {
  return PRINCIPAL_WORDS.includes(value.trim().toLowerCase());
}

// What HR types, versus what Prognosis calls it. Only consulted when the
// relationship list has no exact match, so a scheme that genuinely offers
// "Son" and "Daughter" keeps them rather than being folded into "Child".
const RELATIONSHIP_SYNONYMS: Record<string, string[]> = {
  spouse: ['husband', 'wife', 'partner', 'married to'],
  child:  ['son', 'daughter', 'kid', 'dependant child', 'dependent child'],
};

/**
 * Resolves a typed relationship to a Prognosis relationshipId, or '' when it
 * cannot be matched, which the caller turns into a row error rather than a
 * guess. The IDs are per-environment, so they are always looked up in the list
 * the API returned and never hardcoded.
 */
export function parseRelationship(value: string, options: RelationshipOption[]): string {
  const v = value.trim().toLowerCase();
  if (!v) return '';
  const norm = (s: string) => s.trim().toLowerCase();

  const exact = options.find((o) => norm(o.text) === v);
  if (exact) return exact.value;

  for (const [canonical, words] of Object.entries(RELATIONSHIP_SYNONYMS)) {
    if (!words.includes(v)) continue;
    const hit = options.find((o) => norm(o.text) === canonical);
    if (hit) return hit.value;
  }

  // "Child" typed against a list entry of "Child (under 18)".
  return options.find((o) => norm(o.text).startsWith(v))?.value ?? '';
}

/** Employee codes are matched case- and space-insensitively. */
export function codeKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

/** Spreadsheet row number for a zero-based data index: header is row 1. */
export function sheetRow(idx: number): number {
  return idx + 2;
}

// dob is YYYY-MM-DD once parsed; sexId and relationshipId are resolved at parse
// time so the review table shows exactly what will be submitted.
export interface BulkRow {
  idx: number;
  kind: 'principal' | 'dependant';
  /** As typed (or the matched option's label), for the review table. */
  relationshipLabel: string;
  /** Prognosis relationshipId. Empty for principals. */
  relationshipId: string;
  employeeCode: string;
  /** Employee Code this row belongs to: its own for a principal, the
   *  Principal Employee Code for a dependant. */
  familyKey: string;
  firstName: string; surname: string; otherNames: string;
  dob: string; gender: string; sexId: string;
  email: string; mobile: string;
  errors: string[];
}

// A principal plus the dependants pointing at it. Enrolment happens per family,
// not per row: a dependant cannot exist before its principal, and AddFamily
// creates both in one call, so there is no window where a spouse is orphaned
// because the principal failed halfway through.
export interface BulkFamily {
  key: string;
  /** Employee Code as typed, for display. */
  code: string;
  /** The principal's row, when it is in this file. */
  principal: BulkRow | null;
  /** Set when the principal is already enrolled rather than in the file. */
  existingPrincipal: Member | null;
  dependants: BulkRow[];
  /** Principal first, then dependants in file order. */
  rows: BulkRow[];
  /** Non-empty blocks the whole family: a bad principal row takes its
   *  dependants with it, because they cannot be enrolled without it. */
  blocked: string;
}

/** Header aliases, so a census file does not have to match the template exactly. */
const COLUMNS = {
  firstName:     ['First Name','FirstName','first_name','firstname'],
  surname:       ['Last Name','LastName','Surname','surname','last_name'],
  otherNames:    ['Other Names','OtherNames','other_names'],
  email:         ['Email','email','Email Address'],
  mobile:        ['Mobile','Phone','mobile','phone','Mobile Number'],
  employeeCode:  ['Employee Code','Staff ID','EmployeeCode','employee_code','staff_id','StaffID'],
  relationship:  ['Relationship','relationship','Relation','Member Type','MemberType','Dependant Type','Dependent Type'],
  principalCode: ['Principal Employee Code','PrincipalEmployeeCode','Principal Staff ID','Principal Code','principal_employee_code','Principal Employee code'],
  dob:           ['Date of Birth','DOB','DateOfBirth','date_of_birth','dob'],
  gender:        ['Gender','Sex','gender','sex'],
};

/**
 * One spreadsheet row to a validated BulkRow. `isValidEmail` is injected so
 * this module does not have to reach into the email helper, keeping it pure.
 */
export function parseBulkRow(
  record: Record<string, unknown>,
  idx: number,
  relOpts: RelationshipOption[],
  isValidEmail: (value: string) => boolean,
): BulkRow {
  const get = (keys: string[]) => {
    for (const k of keys) { const v = record[k]; if (v != null && String(v).trim()) return String(v).trim(); }
    return '';
  };
  const rawOf = (keys: string[]): unknown => {
    for (const k of keys) { const v = record[k]; if (v != null && String(v).trim()) return v; }
    return '';
  };

  const firstName    = get(COLUMNS.firstName);
  const surname      = get(COLUMNS.surname);
  const otherNames   = get(COLUMNS.otherNames);
  const email        = get(COLUMNS.email);
  const mobile       = get(COLUMNS.mobile);
  const employeeCode = get(COLUMNS.employeeCode);

  // Blank Relationship means principal, so files written before this column
  // existed keep parsing as all-employees.
  const relRaw = get(COLUMNS.relationship);
  const isDep  = !!relRaw && !isPrincipalWord(relRaw);
  const relationshipId = isDep ? parseRelationship(relRaw, relOpts) : '';
  const principalCode  = get(COLUMNS.principalCode);

  // DOB is read raw: typing a date into Excel turns the cell into a real date,
  // which used to stringify to a serial number and fail validation even though
  // it looked correct on screen.
  const dobRaw = rawOf(COLUMNS.dob);
  const dob = normaliseDob(dobRaw);

  // Gender is matched explicitly. It previously fell through to
  // `/^f/i.test(x) ? female : male`, so any unrecognised value, a typo, a
  // stray character, silently enrolled the person as male.
  const genderRaw = get(COLUMNS.gender);
  const sexId = parseGender(genderRaw);

  const errors: string[] = [];
  if (!firstName)  errors.push('First Name required');
  if (!surname)    errors.push('Last Name required');
  if (!genderRaw)  errors.push('Gender required');
  else if (!sexId) errors.push('Gender must be Male or Female');
  if (!String(dobRaw).trim()) errors.push('Date of Birth required');
  else if (!dob)   errors.push('Date of Birth not recognised. Use DD/MM/YYYY');
  if (email && !isValidEmail(email)) errors.push('Invalid email');

  if (isDep) {
    // Email and mobile are genuinely optional for a dependant, a child has
    // neither, and AddFamily only requires them on the principal.
    if (!relationshipId) {
      errors.push(relOpts.length
        ? `Relationship "${relRaw}" not recognised. Use ${relOpts.map(o => o.text).slice(0, 4).join(', ')}`
        : 'Relationship options could not be loaded. Please retry');
    }
    if (!principalCode && !employeeCode) errors.push('Principal Employee Code required for a dependant');
  } else {
    if (!email)        errors.push('Email required');
    if (!mobile)       errors.push('Mobile required');
    if (!employeeCode) errors.push('Employee Code required');
  }

  return {
    idx,
    kind: isDep ? 'dependant' : 'principal',
    relationshipLabel: isDep
      ? (relOpts.find(o => o.value === relationshipId)?.text ?? relRaw)
      : 'Principal',
    relationshipId,
    employeeCode,
    // A dependant may repeat the principal's code in Employee Code instead of
    // filling Principal Employee Code; accept either.
    familyKey: isDep ? (principalCode || employeeCode) : employeeCode,
    firstName, surname, otherNames,
    // Held as YYYY-MM-DD once parsed, so the review table and the submit agree
    // on one representation.
    dob: dob ?? String(dobRaw).trim(),
    gender: sexId === '2' ? 'Female' : sexId === '1' ? 'Male' : genderRaw,
    sexId,
    email, mobile, errors,
  };
}

/**
 * Second pass over the parsed rows: attaches every dependant to its principal
 * and works out whether that principal is in this file, already enrolled, or
 * nowhere.
 *
 * A dependant is never submitted before its principal exists. When both are in
 * the file they go up together in one AddFamily call, so "the dependant waits
 * for the principal" is guaranteed by the request rather than by ordering luck.
 * When the principal is already an enrolled member, the dependants attach to
 * that member instead. When neither holds, the row is refused with the reason
 * rather than being silently dropped.
 *
 * Row order does not matter: every principal in the file is indexed before any
 * dependant is resolved, so a dependant listed above its employee still finds
 * it.
 *
 * Mutates rows[].errors: the review table reads errors off the row they belong
 * to, so cross-row problems have to land there.
 */
export function buildBulkFamilies(rows: BulkRow[], enrolledPrincipals: Member[]): BulkFamily[] {
  // Already-enrolled principals, by employee code.
  const enrolled = new Map<string, Member>();
  for (const p of enrolledPrincipals) {
    if (p.staffId) enrolled.set(codeKey(p.staffId), p);
  }

  const principalRowByKey = new Map<string, BulkRow>();
  for (const r of rows) {
    if (r.kind !== 'principal' || !r.employeeCode) continue;
    const k = codeKey(r.employeeCode);
    const seen = principalRowByKey.get(k);
    if (seen) {
      // Two employees on the same code would otherwise silently merge into one
      // family, and the second one's dependants would attach to the first.
      r.errors.push(`Employee Code ${r.employeeCode} is already used on row ${sheetRow(seen.idx)}`);
    } else {
      principalRowByKey.set(k, r);
    }
  }

  const order: string[] = [];
  const byKey = new Map<string, BulkFamily>();
  const famFor = (key: string, code: string): BulkFamily => {
    let fam = byKey.get(key);
    if (!fam) {
      fam = { key, code, principal: null, existingPrincipal: null, dependants: [], rows: [], blocked: '' };
      byKey.set(key, fam);
      order.push(key);
    }
    return fam;
  };

  for (const r of rows) {
    if (r.kind === 'principal') {
      // A principal whose code is missing or duplicated (both flagged above)
      // gets a family of its own keyed by row, so it stays visible for review
      // instead of merging into the family that legitimately owns that code.
      const k = codeKey(r.employeeCode);
      const key = principalRowByKey.get(k) === r ? k : `row-${r.idx}`;
      famFor(key, r.employeeCode).principal = r;
      continue;
    }

    if (!r.familyKey) { famFor(`row-${r.idx}`, '').dependants.push(r); continue; }

    const key = codeKey(r.familyKey);
    const fam = famFor(key, r.familyKey);
    fam.dependants.push(r);

    if (!principalRowByKey.has(key)) {
      const existing = enrolled.get(key);
      if (existing) {
        fam.existingPrincipal = existing;
      } else {
        r.errors.push(
          `No employee with Employee Code ${r.familyKey} in this file, and none enrolled. Add the employee row too`,
        );
      }
    }
  }

  return order.map((key) => {
    const fam = byKey.get(key)!;
    fam.rows = [...(fam.principal ? [fam.principal] : []), ...fam.dependants];

    if (fam.principal?.errors.length) {
      fam.blocked = fam.dependants.length
        ? 'Fix the employee row: their dependants cannot be enrolled without them'
        : 'Fix the errors on this row';
    } else if (!fam.principal && !fam.existingPrincipal) {
      fam.blocked = 'No employee to attach these dependants to';
    } else if (!fam.principal && fam.dependants.every((d) => d.errors.length)) {
      fam.blocked = 'Every dependant here has an error';
    }
    return fam;
  });
}
