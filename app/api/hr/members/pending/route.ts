// Lists member self-registrations submitted outside the Corporate Portal
// (typically the Leadway Health mobile app) awaiting HR review, grouped by
// family (principal + dependants share the principal's CIF as parentCif).
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPolicyYearStart } from '@/lib/policy-year';
import { isAdminRole } from '@/lib/roles';
import { getServiceToken } from '@/lib/corporate-welcome';
import { prisma } from '@/lib/prisma';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

function toArr(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    // Real shape: { status, data: { Group: {...}, Members: [...] } }
    const data = r['data'] ?? r['Data'];
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      for (const key of ['Members', 'members', 'Result', 'result', 'Items', 'items']) {
        if (Array.isArray(d[key])) return d[key] as Record<string, unknown>[];
      }
    }
    for (const key of ['result', 'data', 'Data', 'Result', 'items', 'Items', 'Members', 'members']) {
      if (Array.isArray(r[key])) return r[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

function extractDate(row: Record<string, unknown>): Date | null {
  const raw = str(row,
    'Registrationdate', 'RegistrationDate', 'Registration_Date', 'DateRegistered', 'Date_Registered',
    'CreatedDate', 'Created_Date', 'DateCreated', 'Date_Created',
    'EnrolmentDate', 'Enrolment_Date', 'EnrollmentDate', 'Enrollment_Date',
    'AppRegistrationDate', 'RegDate', 'Reg_Date', 'DateOfRegistration',
    'Dateregistered', 'Date_Registered_On', 'RegisteredDate',
  );
  if (!raw) return null;
  // Prognosis sends this as dd/mm/yyyy (e.g. "12/07/2026" = 12 July 2026).
  // new Date(raw) parses slash dates as US mm/dd/yyyy, silently flipping day
  // and month whenever the day is <=12 — check this shape before falling
  // back to the generic parser.
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]), month = Number(dmy[2]), year = Number(dmy[3]);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// Normalises Prognosis's free-text Memberstatus into one of our three states —
// mirrors mapStatus() in app/api/hr/members/route.ts. Only "Pending" members
// actually require HR approval; "Active" dependants already went through.
function classifyStatus(raw: string): 'Active' | 'Pending' | 'Terminated' {
  const s = raw.toLowerCase();
  // Termination keywords checked first — see mapStatus() in
  // app/api/hr/members/route.ts for why order matters here.
  if (s.includes('terminat') || s.includes('cancel') || s.includes('inactive') || s.includes('deleted')) return 'Terminated';
  if (s.includes('active') || s === '1' || s === 'true') return 'Active';
  return 'Pending';
}

// ViewMembersByStatus returns MembershipStartDate as "25-Jul-2026" — the cover
// start date the member was registered with. Normalise to yyyy-mm-dd without
// going through Date parsing, which is locale/format sensitive on this shape.
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};
function toIsoDateOnly(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const mm = MONTHS[m[2].toLowerCase()];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Prognosis DOB comes back as "14-Dec-1974" — parseable by Date, but guard
// against odd formats before computing age from it.
function computeAge(dobRaw: string): number | null {
  if (!dobRaw) return null;
  const d = new Date(dobRaw);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export interface PendingMemberRow {
  cifNumber: string;
  parentCif: string;
  membershipNo: string;
  suffix: string;
  isPrincipal: boolean;
  firstName: string;
  surname: string;
  otherName: string;
  fullName: string;
  relationship: string;
  dateOfBirth: string;
  age: number | null;
  sex: string;
  email: string;
  mobile: string;
  employeeCode: string;
  schemeName: string;
  status: string;
  terminationDate: string;
  registrationDate: string | null;
  registrationSource: 'Corporate Portal' | 'Enrolee App';
  // Cover start date the member was registered with (yyyy-mm-dd) — Prognosis's
  // own MembershipStartDate, so it's present however the member registered.
  // Falls back to the startDate we recorded on the HR invitation.
  coverStartDate?: string | null;
}

export interface PendingGroup {
  parentCif: string;
  principalName: string;
  employeeCode: string;
  schemeName: string;
  email: string;
  mobile: string;
  registrationDate: string | null;
  memberCount: number;
  members: PendingMemberRow[];
}

// Invitations HR has sent but the staff member/dependant hasn't used yet —
// they haven't registered with Prognosis at all, so they can't appear in
// ViewPortalRegisteredMembersPerGroup_pendingActivation. Surfaced separately
// so HR can see who still needs to act, and delete/resend the link.
export interface PendingInvitation {
  token: string;
  email: string;
  employeeCode: string;
  schemeName: string;
  inviteType: string;
  createdAt: string;
  expiresAt: string;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID in session' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from'); // yyyy-mm-dd
  const to = searchParams.get('to');

  try {
    const token = await getServiceToken();
    // ViewMembersByStatus with statusIds=2,8,11,12 — covers the same "pending"
    // buckets as the old ViewPortalRegisteredMembersPerGroup_pendingActivation
    // endpoint. Row shape is CONFIRMED from production and is leaner than the
    // legacy endpoint's: Cif_Number, Parent_Cif, MembershipNo, Suffix,
    // FirstName, Surname, Othername, DOB, Email, Mobile, NIN, StateId, State,
    // ZoneId, Zone, MemberStatusId, MemberStatus, StatusCode, StatusColorCode,
    // MembershipStartDate, Termdate.
    //
    // Notably ABSENT (the legacy endpoint supplied these, so the lookups below
    // fall through to blanks / suffix-derived values): Relationship, Sex/Gender,
    // EmployeeCode, Scheme, and any registration-date field. Registration date
    // is recovered from our own link_registrations rows where we have them.
    const res = await fetch(`${BASE}/api/CorporatePortal/ViewMembersByStatus?groupId=${encodeURIComponent(groupId)}&statusIds=2,8,11,12`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Prognosis error ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }
    const rawText = await res.text();
    console.log(`[hr/members/pending] ViewMembersByStatus groupId=${groupId} → HTTP ${res.status}: ${rawText.slice(0, 2000)}`);
    let raw: unknown;
    try { raw = JSON.parse(rawText); } catch { raw = null; }
    const allRows = toArr(raw);

    // Dedupe by Cif_Number — ViewMembersPerGroup can return the same member more
    // than once (e.g. one row per scheme/policy period), which otherwise renders
    // as duplicate rows in the same family group. Keep the Active record when
    // duplicates disagree on status.
    const dedupedByCif = new Map<string, Record<string, unknown>>();
    for (const row of allRows) {
      const cif = str(row, 'cif_number', 'Cif_Number', 'CIF_Number', 'CifNo', 'Cif', 'cifNumber');
      if (!cif) continue;
      const existing = dedupedByCif.get(cif);
      const status = str(row, 'Memberstatus', 'Status', 'MemberStatus');
      const existingStatus = existing ? str(existing, 'Memberstatus', 'Status', 'MemberStatus') : '';
      if (!existing || existingStatus !== 'Active' || status === 'Active') {
        dedupedByCif.set(cif, row);
      }
    }
    const rows = [...dedupedByCif.values()];

    const normalized: (PendingMemberRow & { _date: Date | null; _principalHint: string })[] = rows.map((row) => {
      // ViewPortalRegisteredMembersPerGroup_pendingActivation uses its own
      // (differently-cased) field names from ViewMembersPerGroup — e.g.
      // "cif_number", "Membershipno", "Registrationdate", lowercase "scheme",
      // and — confusingly — "member" for this member's own surname (NOT
      // "psurname"/"pfirstname", which describe the *principal*'s name).
      const cifNumber = str(row, 'cif_number', 'Cif_Number', 'CIF_Number', 'CifNo', 'Cif', 'cifNumber');
      const parentCifRaw = str(row, 'Parent_Cif', 'ParentCif', 'parentCif', 'Parent_CIF');
      const parentCif = parentCifRaw && parentCifRaw !== '0' ? parentCifRaw : cifNumber;
      const firstName = str(row, 'firstname', 'FirstName', 'First_Name');
      const surname = str(row, 'member', 'Surname', 'surname', 'LastName');
      const otherName = str(row, 'Othername', 'OtherName', 'Other_Name');
      const membershipNoBase = str(row, 'Membershipno', 'MembershipNo', 'Membership_No', 'MembershipNumber');
      const suffix = str(row, 'suffix', 'Suffix');
      // Prognosis's membership number is only unique per-family; the full
      // enrolee identifier is "<membershipNo>/<suffix>" (e.g. 25231697/0) —
      // without the suffix it looks truncated/incomplete on screen.
      const membershipNo = membershipNoBase
        ? (membershipNoBase.includes('/') ? membershipNoBase : `${membershipNoBase}/${suffix || '0'}`)
        : membershipNoBase;
      const isPrincipal = suffix === '0' || (!suffix && (!parentCifRaw || parentCifRaw === '0' || parentCifRaw === cifNumber));
      const dob = str(row, 'DOB', 'DateOfBirth', 'Date_Of_Birth');
      // Relationship is now returned directly by Prognosis (e.g. "Main member", "Spouse", "Child") —
      // trim stray whitespace/tabs and only fall back to Suffix-based inference if it's missing.
      const relationshipRaw = str(row, 'Relationship', 'Member_Relationship', 'RelationshipType').replace(/\s+/g, ' ').trim();
      const relationship = relationshipRaw
        ? (/main\s*member/i.test(relationshipRaw) ? 'Principal' : relationshipRaw)
        : (isPrincipal ? 'Principal' : (suffix ? `Dependant (${suffix})` : 'Dependant'));
      return {
        cifNumber,
        parentCif,
        membershipNo,
        suffix,
        isPrincipal,
        firstName, surname, otherName,
        fullName: str(row, 'DependantName')
          || `${surname} ${firstName} ${otherName}`.replace(/\s+/g, ' ').trim()
          || str(row, 'Client_Name', 'ClientName', 'FullName', 'Name'),
        relationship,
        dateOfBirth: dob,
        age: computeAge(dob),
        sex: str(row, 'Sex', 'Gender', 'Sex_ID'),
        email: str(row, 'EmailAdress', 'Email', 'EmailAddress'),
        mobile: str(row, 'Mobile', 'Mobile1', 'Phone', 'MobileNumber'),
        employeeCode: str(row, 'EmployeeCode', 'Employee_Code', 'employeecode'),
        schemeName: str(row, 'scheme', 'Scheme', 'SchemeName', 'Scheme_Name'),
        status: classifyStatus(str(row, 'Memberstatus', 'Status', 'MemberStatus', 'ApprovalStatus', 'Approval_Status', 'EnrollmentStatus')),
        terminationDate: str(row, 'Termdate', 'TermDate', 'Term_Date'),
        // Confirmed field on ViewMembersByStatus: the cover start date the
        // member was actually registered with ("25-Jul-2026"). Available for
        // every pending member regardless of how they registered, so it's the
        // primary source for the approval effective date.
        coverStartDate: toIsoDateOnly(str(row, 'MembershipStartDate', 'Membershipstartdate', 'StartDate')),
        registrationDate: null,
        registrationSource: 'Enrolee App' as const,
        _date: extractDate(row),
        // "PrincipalMember" gives the principal's first name even on a
        // dependant-only row — used purely as a header fallback below when
        // no actual principal row is present in this snapshot.
        _principalHint: str(row, 'PrincipalMember'),
      };
    }).map((r) => ({ ...r, registrationDate: r._date ? r._date.toISOString().slice(0, 10) : null }));

    // Date filter — only applied to rows where a date could be resolved,
    // so an unrecognised date field on Prognosis's side doesn't blank the list.
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const filtered = normalized.filter((r) => {
      if (!fromDate && !toDate) return true;
      if (!r._date) return false;
      if (fromDate && r._date < fromDate) return false;
      if (toDate) {
        const endOfDay = new Date(toDate); endOfDay.setHours(23, 59, 59, 999);
        if (r._date > endOfDay) return false;
      }
      return true;
    });

    // Header details (staff name, scheme, contact info) come from ANY row in the
    // family — the principal is usually Active by the time a dependant is added,
    // so we still need their name even though they won't appear in the approval list.
    const headerByParentCif = new Map<string, { principalName: string; employeeCode: string; schemeName: string; email: string; mobile: string }>();
    for (const r of filtered) {
      if (!r.parentCif) continue;
      const h = headerByParentCif.get(r.parentCif) ?? { principalName: '', employeeCode: '', schemeName: '', email: '', mobile: '' };
      if (r.isPrincipal || !h.principalName) {
        h.principalName = (r.isPrincipal ? r.fullName : '') || r._principalHint || r.fullName || h.principalName;
        h.employeeCode = r.employeeCode || h.employeeCode;
        h.schemeName = r.schemeName || h.schemeName;
        h.email = r.email || h.email;
        h.mobile = r.mobile || h.mobile;
      }
      headerByParentCif.set(r.parentCif, h);
    }

    // This endpoint (ViewPortalRegisteredMembersPerGroup_pendingActivation) only
    // ever returns members genuinely awaiting activation — including principals
    // who self-registered via their own link — so no extra status filtering here.
    const pendingBeneficiaries = filtered;

    // Registrations submitted through an HR-issued self-service link are
    // recorded in link_registrations at submission time; anything pending
    // that ISN'T in there came straight from the Enrolee mobile app.
    const linkCifSet = new Set<string>();
    const linkCifDates = new Map<string, string>();
    // Cover start date HR chose when issuing the invitation — approval should
    // honour this rather than defaulting to the day HR happens to approve.
    const linkCifStartDates = new Map<string, string>();
    if (pendingBeneficiaries.length > 0) {
      try {
        const linkRows = await prisma.linkRegistration.findMany({
          where: { cifNumber: { in: pendingBeneficiaries.map((r) => r.cifNumber) } },
          select: { cifNumber: true, createdAt: true, startDate: true },
        });
        for (const row of linkRows) {
          linkCifSet.add(row.cifNumber);
          linkCifDates.set(row.cifNumber, row.createdAt.toISOString().slice(0, 10));
          if (row.startDate) linkCifStartDates.set(row.cifNumber, row.startDate);
        }
      } catch (e) {
        console.warn('[hr/members/pending] Failed to look up link registration sources:', e);
      }
    }

    const groups = new Map<string, PendingGroup>();
    for (const r of pendingBeneficiaries) {
      if (!r.parentCif) continue;
      if (!groups.has(r.parentCif)) {
        const h = headerByParentCif.get(r.parentCif);
        groups.set(r.parentCif, {
          parentCif: r.parentCif, principalName: h?.principalName ?? '', employeeCode: h?.employeeCode ?? '', schemeName: h?.schemeName ?? '',
          email: h?.email ?? '', mobile: h?.mobile ?? '', registrationDate: null, memberCount: 0, members: [],
        });
      }
      const g = groups.get(r.parentCif)!;
      const { _date, _principalHint, ...member } = r;
      void _date; void _principalHint;
      // Prognosis's own date field on this endpoint reflects the plan's
      // effective/start date, not when the registration was actually
      // submitted — for anything that came through our portal (link or HR
      // direct), we recorded the real submission timestamp ourselves, so
      // prefer that over Prognosis's field.
      const trueDate = linkCifDates.get(r.cifNumber) ?? member.registrationDate;
      g.members.push({
        ...member,
        registrationDate: trueDate,
        registrationSource: linkCifSet.has(r.cifNumber) ? 'Corporate Portal' : 'Enrolee App',
        coverStartDate: member.coverStartDate ?? linkCifStartDates.get(r.cifNumber) ?? null,
      });
      g.memberCount++;
      if (!g.registrationDate || (trueDate && trueDate < g.registrationDate)) {
        g.registrationDate = trueDate ?? g.registrationDate;
      }
    }

    const groupList = [...groups.values()].sort((a, b) => (b.registrationDate ?? '').localeCompare(a.registrationDate ?? ''));

    // Invitations HR sent that haven't been used (or expired) yet — the
    // member/dependant hasn't registered at all, so they show as a distinct
    // "Awaiting Enrolment" row rather than mixed into the Prognosis-derived list.
    let invitations: PendingInvitation[] = [];
    try {
      const invRows = await prisma.memberInvitation.findMany({
        where: { groupId, used: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      invitations = invRows
        .filter((inv) => {
          if (!fromDate && !toDate) return true;
          if (fromDate && inv.createdAt < fromDate) return false;
          if (toDate) {
            const endOfDay = new Date(toDate); endOfDay.setHours(23, 59, 59, 999);
            if (inv.createdAt > endOfDay) return false;
          }
          return true;
        })
        .map((inv) => ({
          token: inv.token,
          email: inv.email,
          employeeCode: inv.employeeCode,
          schemeName: inv.schemeName,
          inviteType: inv.inviteType,
          createdAt: inv.createdAt.toISOString().slice(0, 10),
          expiresAt: inv.expiresAt.toISOString(),
        }));
    } catch (e) {
      console.warn('[hr/members/pending] Failed to fetch unused invitations:', e);
    }

    // Earliest effective date HR may approve with — the approve sheet uses it
    // as the date picker's floor.
    const policyYearStart = await getPolicyYearStart(groupId);

    return NextResponse.json({ groups: groupList, invitations, policyYearStart, totalRows: rows.length, totalGroups: groupList.length, totalBeneficiaries: pendingBeneficiaries.length });
  } catch (err) {
    console.error('[hr/members/pending] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch pending enrolees' }, { status: 500 });
  }
}
