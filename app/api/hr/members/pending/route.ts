// Lists member self-registrations submitted outside the Corporate Portal
// (typically the Leadway Health mobile app) awaiting HR review, grouped by
// family (principal + dependants share the principal's CIF as parentCif).
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/roles';
import { getServiceToken } from '@/lib/corporate-welcome';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

function toArr(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    for (const key of ['result', 'data', 'Data', 'Result', 'items', 'Items']) {
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
  );
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export interface PendingMemberRow {
  cifNumber: string;
  parentCif: string;
  isPrincipal: boolean;
  firstName: string;
  surname: string;
  fullName: string;
  relationship: string;
  dateOfBirth: string;
  sex: string;
  email: string;
  mobile: string;
  employeeCode: string;
  schemeName: string;
  status: string;
  registrationDate: string | null;
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
    const rows = toArr(raw);

    const normalized: (PendingMemberRow & { _date: Date | null })[] = rows.map((row) => {
      const cifNumber = str(row, 'Cif_Number', 'CIF_Number', 'CifNo', 'Cif', 'cifNumber');
      const parentCifRaw = str(row, 'Parent_Cif', 'ParentCif', 'parentCif', 'Parent_CIF');
      const parentCif = parentCifRaw && parentCifRaw !== '0' ? parentCifRaw : cifNumber;
      const firstName = str(row, 'FirstName', 'First_Name', 'firstname');
      const surname = str(row, 'Surname', 'surname', 'LastName');
      return {
        cifNumber,
        parentCif,
        isPrincipal: !parentCifRaw || parentCifRaw === '0' || parentCifRaw === cifNumber,
        firstName, surname,
        fullName: `${firstName} ${surname}`.trim() || str(row, 'Client_Name', 'ClientName', 'FullName', 'Name'),
        relationship: str(row, 'Relationship', 'Relationship_Desc', 'RelationshipDesc', 'Relationship_ID') || (parentCifRaw ? '' : 'Principal'),
        dateOfBirth: str(row, 'DateOfBirth', 'Date_Of_Birth', 'DOB'),
        sex: str(row, 'Sex', 'Gender', 'Sex_ID'),
        email: str(row, 'EmailAdress', 'Email', 'EmailAddress'),
        mobile: str(row, 'Mobile', 'Mobile1', 'Phone', 'MobileNumber'),
        employeeCode: str(row, 'EmployeeCode', 'Employee_Code', 'employeecode'),
        schemeName: str(row, 'Scheme', 'SchemeName', 'Scheme_Name'),
        status: str(row, 'Status', 'MemberStatus', 'ApprovalStatus', 'Approval_Status', 'EnrollmentStatus') || 'Pending',
        registrationDate: null,
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

    // Group by parentCif — a family's principal + dependants are reviewed as one unit
    const groups = new Map<string, PendingGroup>();
    for (const r of filtered) {
      if (!r.parentCif) continue;
      if (!groups.has(r.parentCif)) {
        groups.set(r.parentCif, {
          parentCif: r.parentCif, principalName: '', employeeCode: '', schemeName: '',
          email: '', mobile: '', registrationDate: null, memberCount: 0, members: [],
        });
      }
      const g = groups.get(r.parentCif)!;
      const { _date, ...member } = r;
      void _date;
      g.members.push(member);
      g.memberCount++;
      // Prefer the principal's own row for header details; fall back to the first member seen
      if (r.isPrincipal || !g.principalName) {
        g.principalName = r.fullName || g.principalName;
        g.employeeCode = r.employeeCode || g.employeeCode;
        g.schemeName = r.schemeName || g.schemeName;
        g.email = r.email || g.email;
        g.mobile = r.mobile || g.mobile;
      }
      if (!g.registrationDate || (r.registrationDate && r.registrationDate < g.registrationDate)) {
        g.registrationDate = r.registrationDate ?? g.registrationDate;
      }
    }

    const groupList = [...groups.values()].sort((a, b) => (b.registrationDate ?? '').localeCompare(a.registrationDate ?? ''));

    return NextResponse.json({ groups: groupList, totalRows: rows.length, totalGroups: groupList.length });
  } catch (err) {
    console.error('[hr/members/pending] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch pending enrolees' }, { status: 500 });
  }
}
