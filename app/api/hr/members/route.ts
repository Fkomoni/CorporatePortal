import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { Member } from '@/lib/types';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Username: process.env.PROGNOSIS_USERNAME, Password: process.env.PROGNOSIS_PASSWORD }),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Service login non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token from ApiUsers/Login');
  cachedToken = token;
  tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
  return token;
}

function toRows(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const inner = r.data ?? r.Data ?? r.result ?? r.Result ?? r.payload ?? r.Payload;
    if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    if (inner && typeof inner === 'object') return [inner as Record<string, unknown>];
    return [r];
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

function num(row: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
    if (!isNaN(n)) return n;
  }
  return 0;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function mapStatus(raw: string): 'Active' | 'Pending' | 'Terminated' {
  const s = raw.toLowerCase();
  if (s.includes('active') || s === '1' || s === 'true') return 'Active';
  if (s.includes('terminat') || s.includes('cancel') || s.includes('inactive') || s.includes('deleted')) return 'Terminated';
  return 'Pending';
}

function mapGender(raw: string): 'Male' | 'Female' {
  return raw.toLowerCase().startsWith('f') ? 'Female' : 'Male';
}

function mapPlan(raw: string): Member['plan'] {
  const s = raw.toLowerCase();
  if (s.includes('magnum')) return 'Magnum Plan';
  if (s.includes('promax') || s.includes('pro max')) return 'Promax Plan';
  if (s.includes('max')) return 'Max Plan';
  if (s.includes('pro')) return 'Pro Plan';
  return 'Plus Plan';
}

function mapType(raw: string): 'Principal' | 'Dependant' {
  const s = raw.toLowerCase();
  if (s.includes('principal') || s.includes('employee') || s.includes('staff') || s === 'p' || s === '0') return 'Principal';
  return 'Dependant';
}

function mapRow(row: Record<string, unknown>, index: number): Member {
  const fullName  = str(row, 'MemberName', 'FullName', 'Name', 'EnrolleeName', 'Enrollee_Name', 'PatientName');
  const firstName = str(row, 'FirstName', 'First_Name', 'GivenName') || splitName(fullName).firstName || 'Member';
  const rawLast   = str(row, 'LastName', 'Last_Name', 'Surname', 'FamilyName');
  const lastName  = rawLast || splitName(fullName).lastName || String(index + 1);

  const enrolleeId = str(row,
    'MemberShipNo', 'MembershipNo', 'EnrolleeID', 'Enrollee_ID', 'CifNo', 'CIF_No',
    'MemberID', 'Member_ID', 'MemberNo', 'Member_EnrolleeID', 'ID',
  );

  const status = mapStatus(str(row, 'MemberStatus_Desc', 'Status', 'MemberStatus', 'ActiveStatus', 'EnrolleeStatus'));
  const gender = mapGender(str(row, 'Gender', 'Sex', 'GenderDesc'));
  const type   = mapType(str(row, 'MemberType', 'EnrolleeType', 'Relationship', 'MemberRelationship', 'RelationshipType', 'Category'));

  const phone      = str(row, 'PhoneNumber', 'Phone', 'Mobile', 'GSMNo', 'MobileNo', 'ContactPhone', 'Telephone');
  const email      = str(row, 'EmailAddress', 'Email', 'email', 'ContactEmail', 'EmailAddr');
  const dob        = str(row, 'DateOfBirth', 'DOB', 'BirthDate', 'MemberDOB', 'Date_Of_Birth');
  const plan       = mapPlan(str(row, 'PlanName', 'Plan', 'BenefitPlan', 'ProductName', 'PackageName', 'SchemeName', 'PlanDesc'));
  const loc        = str(row, 'State', 'Location', 'Region', 'Branch', 'Address', 'City', 'StateOfResidence');
  const enrollDate = str(row, 'MemberOriginalStartdate', 'EnrollmentDate', 'DateEnrolled', 'StartDate', 'MemberStartDate', 'InceptionDate', 'JoinDate', 'RegistrationDate');

  const depRaw   = row['DependantCount'] ?? row['DependantNo'] ?? row['NoOfDependants'] ?? row['Dependants'] ?? null;
  const dependants = depRaw != null ? parseInt(String(depRaw), 10) || 0 : undefined;

  return {
    id: enrolleeId || String(index),
    employeeId: enrolleeId || `EMP${String(index + 1).padStart(4, '0')}`,
    firstName,
    lastName,
    email: email || '',
    phone: phone || '',
    gender,
    dateOfBirth: dob || '',
    plan,
    type,
    status,
    location: loc || '',
    enrollmentDate: enrollDate || '',
    dependants,
  };
}

export interface MemberClaimRecord {
  date: string;
  provider: string;
  category: string;
  amount: number;
  status: string;
  claimNumber: string;
}

export interface MemberStats {
  claimsYtd: number;
  totalSpendYtd: number;
  visitsYtd: number;
  recentClaims: MemberClaimRecord[];
}

const PAID_AMOUNT_KEYS = ['AmtPaid', 'PaidAmount', 'AmountPaid', 'Paid_Amount', 'paid_amount', 'ClaimPaidAmount', 'NetPaid'];
const STATUS_KEYS      = ['CLAIM_STATUS', 'ClaimStatus', 'Status', 'claim_status', 'PaymentStatus', 'Claim_Status'];

function inferCategory(row: Record<string, unknown>): string {
  const raw = str(row, 'ServiceType', 'ClaimType', 'Category', 'ServiceCategory', 'BenefitType', 'DiagnosisType', 'ClaimCategory').toLowerCase();
  if (raw.includes('inpat') || raw.includes('admit') || raw.includes('hospital')) return 'Inpatient';
  if (raw.includes('dental')) return 'Dental';
  if (raw.includes('optic') || raw.includes('eye') || raw.includes('vision')) return 'Optical';
  if (raw.includes('matern') || raw.includes('antenatal') || raw.includes('delivery')) return 'Maternity';
  return 'Outpatient';
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  try {
    const token = await getServiceToken();

    const [membersRes, premiumRes, claimsRes] = await Promise.all([
      fetch(`${BASE}/api/EnrolleeProfile/GetGroupMembers?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      fetch(`${BASE}/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      fetch(`${BASE}/api/CorporateProfile/GetGroupClaims?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
    ]);

    const [membersRaw, premiumRaw, claimsRaw] = await Promise.all([
      membersRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } }),
      premiumRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } }),
      claimsRes.text().then((t)  => { try { return JSON.parse(t);  } catch { return null;  } }),
    ]);

    const memberRows  = toRows(membersRaw);
    const premiumRows = toRows(premiumRaw);
    const claimRows   = toRows(claimsRaw);

    // Build premium lookup keyed by enrollee ID
    const premiumByEnrollee: Map<string, Record<string, unknown>> = new Map();
    for (const r of premiumRows) {
      const eid = str(r, 'MemberShipNo', 'MembershipNo', 'EnrolleeID', 'Member_EnrolleeID', 'CifNo', 'MemberID');
      if (eid && !premiumByEnrollee.has(eid)) premiumByEnrollee.set(eid, r);
    }

    // ── Build per-member claim stats ──────────────────────────────────────
    const thisYear = new Date().getFullYear();
    const memberStatsMap: Record<string, MemberStats> = {};

    for (const r of claimRows) {
      const memberId = str(r, 'MemberShipNo', 'MembershipNo', 'MemberNo', 'EnrolleeID', 'Member_ID', 'CifNo');
      if (!memberId) continue;

      const dateStr = str(r, 'TreatmentDate', 'DateOfService', 'ServiceDate', 'ClaimDate', 'Treatment_Date');
      const claimYear = dateStr
        ? (() => {
            const d = dateStr.trim().slice(0, 10);
            const y = d.match(/^(\d{4})/)?.[ 1] ?? d.match(/(\d{4})$/)?.[ 1];
            return y ? parseInt(y, 10) : null;
          })()
        : null;
      if (claimYear !== null && claimYear !== thisYear) continue;

      const amtPaid = num(r, ...PAID_AMOUNT_KEYS);
      const claimNo = str(r, 'ClaimNumber', 'Claim_Number', 'ClaimNo', 'ClaimRef');
      const provider = str(r, 'ProviderName', 'Provider', 'HospitalName', 'FacilityName', 'Provider_Name');
      const statusRaw = str(r, ...STATUS_KEYS);

      if (!memberStatsMap[memberId]) {
        memberStatsMap[memberId] = { claimsYtd: 0, totalSpendYtd: 0, visitsYtd: 0, recentClaims: [] };
      }

      const ms = memberStatsMap[memberId];
      ms.totalSpendYtd += amtPaid;

      // Count unique visits by ClaimNumber
      const visitKey = claimNo || `${memberId}|${dateStr}`;
      const alreadyCounted = ms.recentClaims.some((c) => c.claimNumber === visitKey);
      if (!alreadyCounted) {
        ms.visitsYtd++;
        ms.recentClaims.push({
          date: dateStr,
          provider,
          category: inferCategory(r),
          amount: amtPaid,
          status: statusRaw || 'Paid',
          claimNumber: visitKey,
        });
      } else {
        // Accumulate amount on existing visit
        const existing = ms.recentClaims.find((c) => c.claimNumber === visitKey);
        if (existing) existing.amount += amtPaid;
      }
    }

    // Sort recent claims descending by date, keep latest 10
    for (const ms of Object.values(memberStatsMap)) {
      ms.recentClaims.sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        return db.localeCompare(da);
      });
      ms.claimsYtd = ms.visitsYtd;
      ms.recentClaims = ms.recentClaims.slice(0, 10);
    }

    // ── Map member rows to Member objects ─────────────────────────────────
    let members: Member[];

    if (memberRows.length > 0) {
      members = memberRows.map((row, i) => {
        const base = mapRow(row, i);
        const pRow = premiumByEnrollee.get(base.employeeId);
        if (pRow) {
          if (!base.enrollmentDate)
            base.enrollmentDate = str(pRow, 'MemberOriginalStartdate', 'Fromdate', 'StartDate', 'InceptionDate');
          if (!base.status || base.status === 'Active') {
            const ps = str(pRow, 'MemberStatus_Desc', 'Status', 'MemberStatus');
            if (ps) base.status = mapStatus(ps);
          }
          if (base.plan === 'Plus Plan') {
            const pp = str(pRow, 'PlanName', 'Plan', 'BenefitPlan', 'ProductName', 'PackageName', 'SchemeName');
            if (pp) base.plan = mapPlan(pp);
          }
        }
        return base;
      });
    } else {
      // Fallback: derive members from GetGroupPremium rows
      members = premiumRows.map((row, i) => {
        const enrolleeId = str(row, 'MemberShipNo', 'MembershipNo', 'Member_EnrolleeID', 'EnrolleeID', 'CifNo', 'MemberID');
        const fullName   = str(row, 'MemberName', 'FullName', 'Name', 'EnrolleeName');
        const { firstName, lastName } = splitName(fullName);
        return {
          id: enrolleeId || String(i),
          employeeId: enrolleeId || `EMP${String(i + 1).padStart(4, '0')}`,
          firstName: firstName || 'Member',
          lastName: lastName || String(i + 1),
          email: '',
          phone: '',
          gender: mapGender(str(row, 'Gender', 'Sex')),
          dateOfBirth: str(row, 'DateOfBirth', 'DOB', 'BirthDate', 'MemberDOB'),
          plan: mapPlan(str(row, 'PlanName', 'Plan', 'BenefitPlan', 'ProductName', 'PackageName', 'SchemeName')),
          type: mapType(str(row, 'MemberType', 'EnrolleeType', 'Relationship', 'Category')),
          status: mapStatus(str(row, 'MemberStatus_Desc', 'Status', 'MemberStatus')),
          location: str(row, 'State', 'Location', 'Region', 'Branch'),
          enrollmentDate: str(row, 'MemberOriginalStartdate', 'Fromdate', 'StartDate', 'InceptionDate'),
          dependants: undefined,
        } satisfies Member;
      });
    }

    // Summary stats
    const now          = new Date();
    const activeCount  = members.filter((m) => m.status === 'Active').length;
    const newThisMonth = members.filter((m) => {
      if (!m.enrollmentDate) return false;
      const s = m.enrollmentDate.trim().slice(0, 10);
      const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) return false;
      const [y, mo] = s.match(/^(\d{4})/)
        ? [parseInt(s.slice(0, 4), 10), parseInt(s.slice(5, 7), 10) - 1]
        : [parseInt(match[3], 10), parseInt(match[2], 10) - 1];
      return y === now.getFullYear() && mo === now.getMonth();
    }).length;

    return NextResponse.json({
      members,
      memberStats: memberStatsMap,
      stats: {
        activeCount,
        totalCount: members.length,
        principalCount: members.filter((m) => m.type === 'Principal').length,
        dependantCount:  members.filter((m) => m.type === 'Dependant').length,
        newThisMonth,
        pendingCount: members.filter((m) => m.status === 'Pending').length,
      },
      source: memberRows.length > 0 ? 'GetGroupMembers' : 'GetGroupPremium',
    });
  } catch (err) {
    console.error('[hr/members] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch members' },
      { status: 500 }
    );
  }
}
