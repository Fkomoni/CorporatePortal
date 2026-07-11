// Lists member self-registrations submitted outside the Corporate Portal
// (typically the Leadway Health mobile app) awaiting HR review, grouped by
// family (principal + dependants share the principal's CIF as parentCif).
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
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
    'RegistrationDate', 'Registration_Date', 'DateRegistered', 'Date_Registered',
    'CreatedDate', 'Created_Date', 'DateCreated', 'Date_Created',
    'EnrolmentDate', 'Enrolment_Date', 'EnrollmentDate', 'Enrollment_Date',
    'AppRegistrationDate', 'RegDate', 'Reg_Date', 'DateOfRegistration',
    'Dateregistered', 'Date_Registered_On', 'RegisteredDate',
  );
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// Normalises Prognosis's free-text Memberstatus into one of our three states —
// mirrors mapStatus() in app/api/hr/members/route.ts. Only "Pending" members
// actually require HR approval; "Active" dependants already went through.
function classifyStatus(raw: string): 'Active' | 'Pending' | 'Terminated' {
  const s = raw.toLowerCase();
  if (s.includes('active') || s === '1' || s === 'true') return 'Active';
  if (s.includes('terminat') || s.includes('cancel') || s.includes('inactive') || s.includes('deleted')) return 'Terminated';
  return 'Pending';
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
    const res = await fetch(`${BASE}/api/CorporatePortal/ViewMembersPerGroup?groupId=${encodeURIComponent(groupId)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Prognosis error ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }
    const raw = await res.json().catch(() => null);
    const allRows = toArr(raw);

    // Dedupe by Cif_Number — ViewMembersPerGroup can return the same member more
    // than once (e.g. one row per scheme/policy period), which otherwise renders
    // as duplicate rows in the same family group. Keep the Active record when
    // duplicates disagree on status.
    const dedupedByCif = new Map<string, Record<string, unknown>>();
    for (const row of allRows) {
      const cif = str(row, 'Cif_Number', 'CIF_Number', 'CifNo', 'Cif', 'cifNumber');
      if (!cif) continue;
      const existing = dedupedByCif.get(cif);
      const status = str(row, 'Memberstatus', 'Status', 'MemberStatus');
      const existingStatus = existing ? str(existing, 'Memberstatus', 'Status', 'MemberStatus') : '';
      if (!existing || existingStatus !== 'Active' || status === 'Active') {
        dedupedByCif.set(cif, row);
      }
    }
    const rows = [...dedupedByCif.values()];

    const normalized: (PendingMemberRow & { _date: Date | null })[] = rows.map((row) => {
      const cifNumber = str(row, 'Cif_Number', 'CIF_Number', 'CifNo', 'Cif', 'cifNumber');
      const parentCifRaw = str(row, 'Parent_Cif', 'ParentCif', 'parentCif', 'Parent_CIF');
      const parentCif = parentCifRaw && parentCifRaw !== '0' ? parentCifRaw : cifNumber;
      const firstName = str(row, 'FirstName', 'First_Name', 'firstname');
      const surname = str(row, 'Surname', 'surname', 'LastName');
      const otherName = str(row, 'Othername', 'OtherName', 'Other_Name');
      const membershipNo = str(row, 'MembershipNo', 'Membership_No', 'MembershipNumber');
      const suffix = str(row, 'Suffix');
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
        fullName: `${firstName} ${surname} ${otherName}`.replace(/\s+/g, ' ').trim() || str(row, 'Client_Name', 'ClientName', 'FullName', 'Name'),
        relationship,
        dateOfBirth: dob,
        age: computeAge(dob),
        sex: str(row, 'Sex', 'Gender', 'Sex_ID'),
        email: str(row, 'EmailAdress', 'Email', 'EmailAddress'),
        mobile: str(row, 'Mobile', 'Mobile1', 'Phone', 'MobileNumber'),
        employeeCode: str(row, 'EmployeeCode', 'Employee_Code', 'employeecode'),
        schemeName: str(row, 'Scheme', 'SchemeName', 'Scheme_Name'),
        status: classifyStatus(str(row, 'Memberstatus', 'Status', 'MemberStatus', 'ApprovalStatus', 'Approval_Status', 'EnrollmentStatus')),
        terminationDate: str(row, 'Termdate', 'TermDate', 'Term_Date'),
        registrationDate: null,
        registrationSource: 'Enrolee App' as const,
        _date: extractDate(row),
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
        h.principalName = r.fullName || h.principalName;
        h.employeeCode = r.employeeCode || h.employeeCode;
        h.schemeName = r.schemeName || h.schemeName;
        h.email = r.email || h.email;
        h.mobile = r.mobile || h.mobile;
      }
      headerByParentCif.set(r.parentCif, h);
    }

    // Only dependants genuinely awaiting approval (status = Pending) belong in
    // the review list/count — principals and already-Active dependants don't.
    const pendingBeneficiaries = filtered.filter((r) => !r.isPrincipal && r.status === 'Pending');

    // Registrations submitted through an HR-issued self-service link are
    // recorded in link_registrations at submission time; anything pending
    // that ISN'T in there came straight from the Enrolee mobile app.
    const linkCifSet = new Set<string>();
    if (pendingBeneficiaries.length > 0) {
      try {
        const linkRows = await prisma.linkRegistration.findMany({
          where: { cifNumber: { in: pendingBeneficiaries.map((r) => r.cifNumber) } },
          select: { cifNumber: true },
        });
        for (const row of linkRows) linkCifSet.add(row.cifNumber);
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
      const { _date, ...member } = r;
      void _date;
      g.members.push({ ...member, registrationSource: linkCifSet.has(r.cifNumber) ? 'Corporate Portal' : 'Enrolee App' });
      g.memberCount++;
      if (!g.registrationDate || (r.registrationDate && r.registrationDate < g.registrationDate)) {
        g.registrationDate = r.registrationDate ?? g.registrationDate;
      }
    }

    const groupList = [...groups.values()].sort((a, b) => (b.registrationDate ?? '').localeCompare(a.registrationDate ?? ''));

    return NextResponse.json({ groups: groupList, totalRows: rows.length, totalGroups: groupList.length, totalBeneficiaries: pendingBeneficiaries.length });
  } catch (err) {
    console.error('[hr/members/pending] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch pending enrolees' }, { status: 500 });
  }
}
