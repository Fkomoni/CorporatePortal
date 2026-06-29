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

  const phone      = str(row, 'PhoneNumber', 'Phone', 'Mobile', 'GSMNo', 'MobileNo', 'ContactPhone', 'Telephone');
  const email      = str(row, 'EmailAddress', 'Email', 'email', 'ContactEmail', 'EmailAddr');
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
    premium,
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

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  const fresh = new URL(req.url).searchParams.get('fresh') === '1';
  const cacheKey = `members-${groupId}`;
  if (fresh) cacheBust(cacheKey);

  const cached = cacheGet<object>(cacheKey);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  try {
    const token = await getServiceToken();

    const [membersRes, premiumRes, claimsRes, relRes] = await Promise.all([
      fetch(`${BASE}/api/EnrolleeProfile/GetGroupMembers?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      fetch(`${BASE}/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      fetch(`${BASE}/api/CorporateProfile/GetGroupClaims?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      fetch(`${BASE}/api/ListValues/GetBeneficiaryRelationship`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
    ]);

    const [membersRaw, premiumRaw, claimsRaw, relRaw] = await Promise.all([
      membersRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } }),
      premiumRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } }),
      claimsRes.text().then((t)  => { try { return JSON.parse(t);  } catch { return null;  } }),
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
    const claimRows   = toRows(claimsRaw);

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

    // ── Map member rows to Member objects ─────────────────────────────────
    // GetGroupPremium is the primary source — it has the confirmed field names
    // (Member_EnrolleeID, Member_CustomerName, Member_Relationship, etc.)
    // GetGroupMembers is used only as enrichment for extra fields (phone, email)
    // when available and the enrollee IDs match.
    const primaryRows = premiumRows.length > 0 ? premiumRows : memberRows;

    // Build a lookup from GetGroupMembers by enrollee ID for enrichment
    const memberByEnrollee: Map<string, Record<string, unknown>> = new Map();
    for (const r of memberRows) {
      const eid = str(r, 'Member_EnrolleeID', 'MemberShipNo', 'MembershipNo', 'EnrolleeID', 'CifNo', 'MemberID');
      if (eid && !memberByEnrollee.has(eid)) memberByEnrollee.set(eid, r);
    }

    const members: Member[] = primaryRows.map((row, i) => {
      const base = mapRow(row, i, principalTexts, knownRelTexts);
      // Enrich with GetGroupMembers fields if available (phone, email, etc.)
      const mRow = memberByEnrollee.get(base.employeeId);
      if (mRow) {
        if (!base.phone) base.phone = str(mRow, 'PhoneNumber', 'Phone', 'Mobile', 'GSMNo', 'MobileNo');
        if (!base.email) base.email = str(mRow, 'EmailAddress', 'Email', 'email');
      }
      return base;
    });

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

    void logAudit({ session, action: 'VIEW_MEMBERS', resource: 'members', request: req,
      details: { totalCount: members.length, groupId } });

    const body = {
      members,
      memberStats: memberStatsMap,
      stats: {
        activeCount,
        totalCount: members.length,
        principalCount: members.filter((m) => m.type === 'Principal' && m.status === 'Active').length,
        dependantCount:  members.filter((m) => m.type === 'Dependant'  && m.status === 'Active').length,
        newThisMonth,
        pendingCount: members.filter((m) => m.status === 'Pending').length,
      },
      source: premiumRows.length > 0 ? 'GetGroupPremium' : 'GetGroupMembers',
      _debug: {
        memberRowCount: memberRows.length,
        premiumRowCount: premiumRows.length,
        primaryRowCount: primaryRows.length,
        firstPremiumKeys: premiumRows[0] ? Object.keys(premiumRows[0]).slice(0, 15) : [],
        firstMemberKeys:  memberRows[0]  ? Object.keys(memberRows[0]).slice(0, 15)  : [],
        relationshipTexts: Array.from(knownRelTexts),
        principalTexts: Array.from(principalTexts),
      },
    };
    cacheSet(cacheKey, body);
    return NextResponse.json(body);
  } catch (err) {
    console.error('[hr/members] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch members' },
      { status: 500 }
    );
  }
}
