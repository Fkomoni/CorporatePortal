import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { Member } from '@/lib/types';
import { logAudit } from '@/lib/audit';
import { cacheGet, cacheSet, cacheBust } from '@/lib/server-cache';

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

// Recursively finds the first array-of-objects in any response shape.
// Handles Prognosis patterns like: { results: { groupPremium: { result: [...] } } }
function toRows(raw: unknown, depth = 0): Record<string, unknown>[] {
  if (!raw || depth > 6) return [];
  if (Array.isArray(raw)) return raw.filter((v) => v && typeof v === 'object') as Record<string, unknown>[];
  if (typeof raw !== 'object') return [];
  const r = raw as Record<string, unknown>;
  // Pass 1: any value that is a non-empty array of objects → return it
  for (const v of Object.values(r)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
      return v as Record<string, unknown>[];
    }
  }
  // Pass 2: recurse into nested plain objects
  for (const v of Object.values(r)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = toRows(v, depth + 1);
      if (nested.length > 0) return nested;
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
  if (s.includes('magnum') || s.includes('blackcard') || s.includes('black card')) return 'Magnum Plan';
  if (s.includes('promax') || s.includes('pro max')) return 'Promax Plan';
  if (s.includes('max')) return 'Max Plan';
  if (s.includes('pro')) return 'Pro Plan';
  return 'Plus Plan';
}

function mapType(raw: string): 'Principal' | 'Dependant' {
  if (!raw) return 'Principal'; // unknown type → treat as principal (employee)
  const s = raw.toLowerCase();
  if (s.includes('dep') || s.includes('spouse') || s.includes('child') || s.includes('beneficiar') || s === 'd' || s === '1') return 'Dependant';
  return 'Principal'; // principal, employee, staff, or any unknown
}

// Classify a relationship text as Principal or Dependant using the fetched relationship list.
// principalTexts: lowercase texts from GetBeneficiaryRelationship that mean "main member"
// knownTexts: all lowercase texts returned by the API (so unknown → fallback)
function classifyByRelationship(
  raw: string,
  principalTexts: Set<string>,
  knownTexts: Set<string>,
): 'Principal' | 'Dependant' | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (principalTexts.has(s)) return 'Principal';
  if (knownTexts.has(s)) return 'Dependant'; // known but not principal → dependant
  return null; // not found in the list — fall back to other logic
}

function mapRow(
  row: Record<string, unknown>,
  index: number,
  principalTexts: Set<string>,
  knownRelTexts: Set<string>,
): Member {
  const fullName  = str(row, 'Member_CustomerName', 'MemberName', 'FullName', 'Full_Name', 'Name', 'EnrolleeName', 'Enrollee_Name', 'PatientName', 'SubscriberName');
  const firstName = str(row, 'FirstName', 'First_Name', 'GivenName') || splitName(fullName).firstName || 'Member';
  const rawLast   = str(row, 'LastName', 'Last_Name', 'Surname', 'FamilyName');
  const lastName  = rawLast || splitName(fullName).lastName || String(index + 1);

  const enrolleeId = str(row,
    'Member_EnrolleeID', 'MemberShipNo', 'MembershipNo', 'EnrolleeID', 'Enrollee_ID',
    'MemberCifNo', 'CifNo', 'CIF_No', 'MemberID', 'Member_ID', 'MemberNo', 'ID',
  );

  const status = mapStatus(str(row, 'MemberStatus_Desc', 'Status', 'MemberStatus', 'ActiveStatus', 'EnrolleeStatus', 'PolicyStatus'));
  const gender = mapGender(str(row, 'Member_Gender', 'Gender', 'Sex', 'GenderDesc'));

  // Type classification — layered approach:
  // 1. ID suffix (most reliable): /0 = Principal, /1+ = Dependant
  // 2. Relationship field matched against GetBeneficiaryRelationship list
  // 3. Heuristic mapType() fallback
  const idSuffix = enrolleeId.includes('/') ? enrolleeId.split('/').pop() : null;
  let type: 'Principal' | 'Dependant';
  if (idSuffix !== null) {
    type = idSuffix === '0' ? 'Principal' : 'Dependant';
  } else {
    const relRaw = str(row, 'Member_Relationship', 'MemberType', 'EnrolleeType', 'Relationship', 'MemberRelationship', 'RelationshipType', 'Category');
    const fromApi = classifyByRelationship(relRaw, principalTexts, knownRelTexts);
    type = fromApi ?? mapType(relRaw);
  }

  const phone      = str(row, 'MemberPhone', 'PhoneNumber', 'Phone', 'Mobile', 'GSMNo', 'MobileNo', 'ContactPhone', 'Telephone', 'GSM', 'Tel', 'TelNo', 'CellPhone', 'MobilePhone', 'HomePhone', 'WorkPhone');
  const email      = str(row, 'EmailAddress', 'Email', 'email', 'ContactEmail', 'EmailAddr');
  const staffId    = str(row, 'MemberStaffid', 'EmployeeCode', 'employeecode', 'EmpCode', 'Staff_ID', 'StaffID', 'EmployeeNo', 'EmpNo', 'StaffCode', 'HR_EmployeeID', 'HREmployeeID', 'Employee_Code', 'StaffNo');
  const dob        = str(row, 'Member_DateOfBirth', 'DateOfBirth', 'DOB', 'BirthDate', 'MemberDOB', 'Date_Of_Birth');
  const plan       = mapPlan(str(row, 'Member_Plan', 'Product_SchemeType', 'PlanName', 'Plan', 'BenefitPlan', 'ProductName', 'PackageName', 'SchemeName', 'PlanDesc'));
  const loc        = str(row, 'Member_CountryState', 'State', 'Location', 'Region', 'Branch', 'Address', 'City', 'StateOfResidence');
  const enrollDate = str(row, 'MemberOriginalStartdate', 'Member_Effectivedate', 'EnrollmentDate', 'DateEnrolled', 'Fromdate', 'StartDate', 'MemberStartDate', 'InceptionDate', 'JoinDate', 'RegistrationDate');

  const depRaw   = row['DependantCount'] ?? row['DependantNo'] ?? row['NoOfDependants'] ?? row['Dependants'] ?? null;
  const dependants = depRaw != null ? parseInt(String(depRaw), 10) || 0 : undefined;

  const premiumRaw = num(row,
    'IndividualPremiumFees', 'Member_Premium', 'ActualPremium', 'BasePremiumIndividual',
    'PremiumAmount', 'Premium', 'Production_Amount', 'ProductionAmount',
    'MemberPremium', 'MemberContribution', 'PolicyPremium',
  );
  const premium = premiumRaw > 0 ? premiumRaw : undefined;

  const cifNumber = str(row, 'Cif_Number', 'CIF_Number', 'CifNo', 'Cif', 'cifNumber', 'MemberCifNo', 'CIF_No');
  const schemeId  = str(row, 'SchemeId', 'Scheme_Id', 'SchemId', 'schemeid', 'SchemeID', 'Schemeid', 'ProductId', 'Product_Id', 'PlanId', 'Plan_Id');

  return {
    id: enrolleeId || String(index),
    employeeId: enrolleeId || `EMP${String(index + 1).padStart(4, '0')}`,
    staffId: staffId || undefined,
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
    premium,
    cifNumber: cifNumber || undefined,
    schemeId: schemeId || undefined,
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

// Fallback source when GetGroupMembers/GetGroupPremium return no rows for a
// group (confirmed to happen for some groups, e.g. group 2697) — this
// endpoint is confirmed working for those same groups via raw dumps.
// Confirmed real fields: cif_number, Enrolleeid, firstname, surname,
// Member_DateOfBirth, IsDependant, parentcif, EmailAdress, Phone, Gender,
// Scheme/SchemeName, MembershipNo/Suffix.
async function fetchBeneficiariesFallback(base: string, token: string, groupId: string): Promise<Record<string, unknown>[]> {
  const fetchStatus = async (memberstatus: string) => {
    const url = `${base}/api/CorporateProfile/ClientPlanBeneficiariesNoPagitation?group_id=${encodeURIComponent(groupId)}&memberstatus=${memberstatus}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const text = await res.text();
    console.log(`[hr/members/fallback] GET ${url} → HTTP ${res.status}: ${text.slice(0, 800)}`);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = null; }
    const rows = Array.isArray((raw as Record<string, unknown>)?.result)
      ? (raw as Record<string, unknown>).result as Record<string, unknown>[]
      : Array.isArray((raw as Record<string, unknown>)?.Result)
        ? (raw as Record<string, unknown>).Result as Record<string, unknown>[]
        : Array.isArray(raw) ? raw as Record<string, unknown>[] : [];
    return rows.map((r) => ({ ...r, _memberstatus: memberstatus }));
  };
  const [active, inactive] = await Promise.all([fetchStatus('active'), fetchStatus('inactive')]);
  return [...active, ...inactive];
}

function mapFallbackRow(row: Record<string, unknown>, index: number): Member {
  // Confirmed real fields via raw dump (group 2697): firstname, surname,
  // staffid, dateenrolled, Member_DateOfBirth, plantype, member_status_descr,
  // EmailAdress, Phone, cif_number, parentcif, Enrolleeid, IsDependant,
  // Gender (padded with trailing spaces), Schemeid, RelationshipToPrincipal.
  const cif = str(row, 'cif_number', 'Cif_Number', 'CifNumber');
  const enrolleeId = str(row, 'Enrolleeid', 'EnrolleeID', 'enrolleeid') || cif;
  const isDependant = String(row['IsDependant'] ?? '').toLowerCase() === 'yes';
  const email = str(row, 'EmailAdress', 'EmailAddress', 'Email');

  return {
    id: enrolleeId || String(index),
    employeeId: enrolleeId || `EMP${String(index + 1).padStart(4, '0')}`,
    staffId: str(row, 'staffid', 'Staffid', 'Employeecode', 'EmployeeCode') || undefined,
    firstName: str(row, 'firstname', 'Firstname', 'FirstName') || 'Member',
    lastName: str(row, 'surname', 'Surname') || String(index + 1),
    email: email && email.toLowerCase() !== 'noemail.com' ? email : '',
    phone: str(row, 'Phone', 'PhoneNumber', 'Mobile') || '',
    gender: mapGender(str(row, 'Gender', 'gender').trim()),
    dateOfBirth: str(row, 'Member_DateOfBirth', 'DateOfBirth', 'DOB'),
    plan: mapPlan(str(row, 'plantype', 'Scheme', 'SchemeName', 'Plan', 'PlanName')),
    type: isDependant ? 'Dependant' : 'Principal',
    status: mapStatus(str(row, 'member_status_descr', 'MemberStatus_Desc', 'Status')),
    location: str(row, 'State', 'Location') || '',
    enrollmentDate: str(row, 'dateenrolled', 'RegistrationDate', 'Fromdate', 'StartDate') || '',
    cifNumber: cif || undefined,
    schemeId: str(row, 'Schemeid', 'SchemeId', 'PlanId') || undefined,
  };
}

// Counts members genuinely awaiting HR activation — the "Pending Additions"
// tile previously derived this from the active/inactive member list, which
// can never contain a "Pending" row, so it always showed 0. This is the
// same endpoint the Pending Enrolees page uses.
async function fetchPendingCount(base: string, token: string, groupId: string): Promise<number> {
  try {
    const res = await fetch(`${base}/api/CorporatePortal/ViewPortalRegisteredMembersPerGroup_pendingActivation?groupId=${encodeURIComponent(groupId)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return 0;
    const raw = await res.json().catch(() => null);
    return toRows(raw).length;
  } catch {
    return 0;
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  const url = new URL(req.url);
  const fresh = url.searchParams.get('fresh') === '1';
  const skipClaims = url.searchParams.get('skipClaims') === '1';
  const cacheKey = `members-${groupId}`;

  // Cache only applies to the full response (with claims)
  if (!skipClaims) {
    if (fresh) cacheBust(cacheKey);
    else {
      const cached = cacheGet<object>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, cached: true });
    }
  }

  try {
    const token = await getServiceToken();

    // When skipClaims=1, skip GetGroupClaims (the heaviest call) for fast initial load
    const [membersRes, premiumRes, claimsRes, relRes] = await Promise.all([
      fetch(`${BASE}/api/EnrolleeProfile/GetGroupMembers?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      fetch(`${BASE}/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      skipClaims
        ? Promise.resolve(null)
        : fetch(`${BASE}/api/EnrolleeClaims/ClaimsHeaderEnquiry?groupid=${groupId}&fromdate=${new Date().getFullYear()}-01-01&todate=${new Date().getFullYear()}-12-31`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }),
      fetch(`${BASE}/api/ListValues/GetBeneficiaryRelationship`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
    ]);

    const [membersRaw, premiumRaw, claimsRaw, relRaw] = await Promise.all([
      membersRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } }),
      premiumRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } }),
      claimsRes ? claimsRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } }) : Promise.resolve(null),
      relRes.text().then((t)     => { try { return JSON.parse(t);  } catch { return null;  } }),
    ]);

    // Build relationship lookup sets from GetBeneficiaryRelationship
    // principalTexts: relationship texts that identify a "main member" (Principal)
    // knownRelTexts: all texts returned by the API
    const principalTexts = new Set<string>();
    const knownRelTexts  = new Set<string>();
    const relItems: unknown[] = Array.isArray(relRaw) ? relRaw : [];
    for (const item of relItems) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const text = String(rec.Text ?? rec.text ?? '').trim().toLowerCase();
      if (!text) continue;
      knownRelTexts.add(text);
      // Texts that represent the main/principal member
      if (
        text.includes('main') || text.includes('primary') || text.includes('principal') ||
        text.includes('staff') || text.includes('employee') || text.includes('subscriber') ||
        text.includes('self') || text.includes('insured')
      ) {
        principalTexts.add(text);
      }
    }

    const memberRows  = toRows(membersRaw);
    const premiumRows = toRows(premiumRaw);
    const claimRows   = skipClaims ? [] : toRows(claimsRaw);

    // GetGroupMembers/GetGroupPremium return zero rows for some groups even
    // though they have active members (confirmed for group 2697) — fall back
    // to the confirmed-working ClientPlanBeneficiariesNoPagitation endpoint.
    let fallbackRows: Record<string, unknown>[] = [];
    let usedFallback = false;
    if (memberRows.length === 0 && premiumRows.length === 0) {
      fallbackRows = await fetchBeneficiariesFallback(BASE, token, String(groupId));
      usedFallback = fallbackRows.length > 0;
      console.log(`[hr/members] groupId=${groupId} GetGroupMembers/GetGroupPremium empty, fallback rows=${fallbackRows.length}`);
    }

    // Build premium lookup keyed by enrollee ID
    const premiumByEnrollee: Map<string, Record<string, unknown>> = new Map();
    for (const r of premiumRows) {
      const eid = str(r, 'Member_EnrolleeID', 'MemberShipNo', 'MembershipNo', 'EnrolleeID', 'MemberCifNo', 'CifNo', 'MemberID');
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

    // Claims rows are keyed by bare MembershipNo/CifNo, but members are keyed by
    // employeeId in "MembershipNo/Suffix" form (e.g. "21000097/0") — without this,
    // the lookup in the UI always misses and Utilization/Claim History show empty
    // even when claims exist. Mirror both directions so either form resolves.
    for (const [key, ms] of Object.entries({ ...memberStatsMap })) {
      if (key.includes('/')) {
        const prefix = key.split('/')[0];
        if (prefix && !memberStatsMap[prefix]) memberStatsMap[prefix] = ms;
      } else {
        const withSuffix = `${key}/0`;
        if (!memberStatsMap[withSuffix]) memberStatsMap[withSuffix] = ms;
      }
    }

    // ── Map member rows to Member objects ─────────────────────────────────
    // GetGroupPremium is the primary source — it has the confirmed field names
    // (Member_EnrolleeID, Member_CustomerName, Member_Relationship, etc.)
    // GetGroupMembers is used only as enrichment for extra fields (phone, email)
    // when available and the enrollee IDs match.
    const primaryRows = premiumRows.length > 0 ? premiumRows : memberRows;
    const useFallbackMapping = usedFallback && primaryRows.length === 0;

    // Build a lookup from GetGroupMembers by enrollee ID for enrichment.
    // Store both the full ID and the prefix (before '/') to handle format mismatches.
    const memberByEnrollee: Map<string, Record<string, unknown>> = new Map();
    for (const r of memberRows) {
      const eid = str(r, 'Member_EnrolleeID', 'MemberShipNo', 'MembershipNo', 'EnrolleeID', 'CifNo', 'MemberID');
      if (!eid) continue;
      if (!memberByEnrollee.has(eid)) memberByEnrollee.set(eid, r);
      // Also index by prefix (strip '/suffix') to match premium rows that include the suffix
      const prefix = eid.includes('/') ? eid.split('/')[0] : null;
      if (prefix && !memberByEnrollee.has(prefix)) memberByEnrollee.set(prefix, r);
    }

    const members: Member[] = useFallbackMapping
      ? fallbackRows.map((row, i) => mapFallbackRow(row, i))
      : primaryRows.map((row, i) => {
        const base = mapRow(row, i, principalTexts, knownRelTexts);
        // Enrich with GetGroupMembers fields if available (phone, email, staffId, etc.)
        // Try exact ID match first, then prefix match (strip '/0' suffix)
        const basePrefix = base.employeeId.includes('/') ? base.employeeId.split('/')[0] : null;
        const mRow = memberByEnrollee.get(base.employeeId) ?? (basePrefix ? memberByEnrollee.get(basePrefix) : undefined);
        if (mRow) {
          if (!base.phone) base.phone = str(mRow, 'MemberPhone', 'PhoneNumber', 'Phone', 'Mobile', 'GSMNo', 'MobileNo', 'GSM', 'Tel', 'TelNo', 'CellPhone', 'MobilePhone');
          if (!base.email) base.email = str(mRow, 'EmailAddress', 'Email', 'email');
          if (!base.staffId) base.staffId = str(mRow, 'MemberStaffid', 'EmployeeCode', 'employeecode', 'EmpCode', 'Staff_ID', 'StaffID', 'EmployeeNo', 'StaffCode') || undefined;
        }
        return base;
      });

    // Dedupe by enrolleeId — GetGroupPremium can return multiple rows per member
    // (e.g. one per renewal/premium period), which otherwise renders as duplicate
    // rows sharing the same id/key and breaks client-side filtering/list rendering.
    // Keep the Active record when duplicates disagree on status, else the last one seen.
    const dedupedById = new Map<string, Member>();
    for (const m of members) {
      const existing = dedupedById.get(m.employeeId);
      if (!existing || existing.status !== 'Active' || m.status === 'Active') {
        dedupedById.set(m.employeeId, m);
      }
    }
    const dedupedMembers = [...dedupedById.values()];
    members.length = 0;
    members.push(...dedupedMembers);

    // Compute dependant counts by grouping on the ID prefix (everything before "/")
    // e.g. "25190120/0" → prefix "25190120"; dependants are those sharing the prefix but not "/0"
    const prefixCounts: Map<string, number> = new Map();
    for (const m of members) {
      const slash = m.employeeId.indexOf('/');
      const prefix = slash >= 0 ? m.employeeId.slice(0, slash) : m.employeeId;
      if (!prefix) continue;
      const suffix = slash >= 0 ? m.employeeId.slice(slash + 1) : '0';
      // Only count non-principal slots (suffix !== '0') as dependants
      if (suffix !== '0') {
        prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
      }
    }
    // Assign computed dependant count to each principal
    for (const m of members) {
      const slash = m.employeeId.indexOf('/');
      const prefix = slash >= 0 ? m.employeeId.slice(0, slash) : m.employeeId;
      const suffix = slash >= 0 ? m.employeeId.slice(slash + 1) : '0';
      if (suffix === '0' && prefix) {
        m.dependants = prefixCounts.get(prefix) ?? 0;
      }
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

    const pendingCount = await fetchPendingCount(BASE, token, String(groupId));

    void logAudit({ session, action: 'VIEW_MEMBERS', resource: 'members', request: req,
      details: { totalCount: members.length, groupId } });

    const responsePayload = {
      members,
      memberStats: memberStatsMap,
      stats: {
        activeCount,
        totalCount: members.length,
        principalCount: members.filter((m) => m.type === 'Principal' && m.status === 'Active').length,
        dependantCount:  members.filter((m) => m.type === 'Dependant'  && m.status === 'Active').length,
        newThisMonth,
        pendingCount,
      },
      source: useFallbackMapping ? 'ClientPlanBeneficiariesNoPagitation' : premiumRows.length > 0 ? 'GetGroupPremium' : 'GetGroupMembers',
      _debug: {
        memberRowCount: memberRows.length,
        premiumRowCount: premiumRows.length,
        fallbackRowCount: fallbackRows.length,
        usedFallback: useFallbackMapping,
        primaryRowCount: primaryRows.length,
        firstPremiumKeys: premiumRows[0] ? Object.keys(premiumRows[0]).slice(0, 15) : [],
        firstMemberKeys:  memberRows[0]  ? Object.keys(memberRows[0]).slice(0, 15)  : [],
        relationshipTexts: Array.from(knownRelTexts),
        principalTexts: Array.from(principalTexts),
      },
    };

    // Cache only the full response (with claims), not the fast skipClaims one
    if (!skipClaims) cacheSet(cacheKey, responsePayload);

    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error('[hr/members] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch members' },
      { status: 500 }
    );
  }
}
