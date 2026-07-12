import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { approveEnrollee } from '@/lib/approve-enrollee';

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

export interface AddMemberPayload {
  schemeId: string;
  schemeName: string;
  firstName: string;
  surname: string;
  otherNames?: string;
  dateOfBirth: string;
  sexId: string;               // "1" Male, "2" Female
  maritalStatus?: string;
  email: string;
  mobile: string;
  mobile2?: string;
  postalTownId: string;
  regionId?: string;
  stateId?: string;
  address?: string;
  bloodGroup?: string;
  genotype?: string;
  employeeCode: string;
  cadre?: string;
  preExistingCondition?: string;
  enrolleePicture?: string;
  enrolleePictureType?: string;
  startDate?: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: AddMemberPayload;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { schemeId, schemeName, firstName, surname, dateOfBirth, sexId, email, mobile, postalTownId, employeeCode } = body;
  if (!schemeId || !firstName || !surname || !dateOfBirth || !sexId || !email || !mobile || !postalTownId || !employeeCode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Cover can only be backdated to the 1st of the current month at the
  // earliest — HR must not be able to back-register cover further than that.
  if (body.startDate) {
    const firstOfMonth = new Date(); firstOfMonth.setDate(1); firstOfMonth.setHours(0, 0, 0, 0);
    const chosenStart = new Date(body.startDate); chosenStart.setHours(0, 0, 0, 0);
    if (isNaN(chosenStart.getTime()) || chosenStart < firstOfMonth) {
      return NextResponse.json({ error: 'Cover start date cannot be earlier than the 1st of this month.' }, { status: 400 });
    }
  }

  const groupId = session.user.companyId ?? '';

  try {
    const token = await getServiceToken();

    // Flag emails/mobiles already registered to another member in this group —
    // Prognosis's AddPrincipalOnly accepts duplicates silently, so check first.
    try {
      const dupRes = await fetch(`${BASE}/api/CorporatePortal/ViewMembersPerGroup?groupId=${encodeURIComponent(groupId)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const dupRaw = await dupRes.json().catch(() => null);
      const dupRows: Record<string, unknown>[] = Array.isArray(dupRaw) ? dupRaw
        : Array.isArray((dupRaw as Record<string, unknown>)?.data) ? (dupRaw as Record<string, unknown>).data as Record<string, unknown>[]
        : Array.isArray((dupRaw as Record<string, unknown>)?.Data) ? (dupRaw as Record<string, unknown>).Data as Record<string, unknown>[]
        : [];
      const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
      const wantedEmail = norm(email);
      const wantedMobile = norm(mobile);
      const clash = dupRows.find((row) => {
        const rowEmail = norm(row['EmailAdress'] ?? row['Email'] ?? row['EmailAddress']);
        const rowMobile = norm(row['Mobile'] ?? row['Mobile1'] ?? row['Phone'] ?? row['MobileNumber']);
        return (wantedEmail && rowEmail === wantedEmail) || (wantedMobile && rowMobile === wantedMobile);
      });
      if (clash) {
        const clashName = `${clash['FirstName'] ?? ''} ${clash['Surname'] ?? ''}`.trim() || 'another member';
        const field = norm(clash['EmailAdress'] ?? clash['Email'] ?? clash['EmailAddress']) === wantedEmail ? 'email address' : 'mobile number';
        return NextResponse.json({ error: `This ${field} is already registered to ${clashName} in this group. Please verify and use a unique ${field}.` }, { status: 409 });
      }
    } catch (e) {
      console.warn('[hr/members/add] Duplicate check failed, proceeding without it:', e);
    }

    const payload = {
      groupid: Number(groupId) || groupId,
      schemeid: Number(schemeId) || schemeId,
      Scheme: schemeName,
      // regionid is Prognosis's real field for state (GetStates returns
      // {RegionID, RegionName} — "region" is Prognosis's word for state).
      // body.stateId is what the State dropdown actually sets; body.regionId
      // is only a fallback in case a caller already resolved it that way.
      regionid: body.regionId
        ? (Number(body.regionId) || body.regionId)
        : body.stateId ? (Number(body.stateId) || body.stateId) : 1,
      Parent_Cif: 0,
      FirstName: firstName,
      Surname: surname,
      othernames: body.otherNames ?? '',
      DateOfBirth: dateOfBirth,
      Sex_ID: sexId,
      MaritalStatus: body.maritalStatus ?? '',
      EmailAdress: email,
      Mobile: mobile,
      Mobile2: body.mobile2 ?? '',
      Postal_Town_ID: postalTownId,
      Physical_Add1: body.address ?? '',
      Relationship_ID: '30',
      BloodGroup: body.bloodGroup ?? '',
      genotype: body.genotype ?? '',
      employeecode: employeeCode,
      cadre: body.cadre ?? '',
      PreExistingCondition: body.preExistingCondition ?? 'None',
      EnrolleePicture: body.enrolleePicture ?? '',
      EnrolleePictureType: body.enrolleePictureType ?? '',
      registrationsource: 'Web Portal',
      ...(body.startDate ? { Fromdate: body.startDate, StartDate: body.startDate } : {}),
    };

    const res = await fetch(`${BASE}/api/CorporatePortal/AddPrincipalOnly`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`[hr/members/add] Prognosis HTTP ${res.status}: ${text.slice(0, 500)}`);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }

    const r = raw as Record<string, unknown>;

    if (!res.ok) {
      const msg = r?.Message ?? r?.message ?? r?.error ?? r?.Error ?? text.slice(0, 300);
      return NextResponse.json({ error: String(msg) }, { status: res.status });
    }

    // Prognosis sometimes returns HTTP 200 with status:"error" in the body
    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');
    if (apiStatus && apiStatus !== 'success' && apiStatus !== '200') {
      console.error('[hr/members/add] Prognosis error body:', text.slice(0, 500));
      return NextResponse.json({ error: apiMessage || `Enrolment failed (${apiStatus})` }, { status: 422 });
    }

    let cifNumber: unknown = r?.Cif_Number ?? r?.cifNumber ?? r?.CifNumber ?? r?.CifNo ?? r?.cifno ?? r?.cif_no ?? null;
    const membershipNo = String(r?.MembershipNo ?? r?.membershipNo ?? '');
    const suffix       = String(r?.Suffix ?? r?.suffix ?? '0');

    // Full Enrolee ID = MembershipNo/Suffix  e.g. "26307209/0"
    const enrolleeId = membershipNo ? `${membershipNo}/${suffix}` : '';

    // Success requires at least an enrolleeId or Cif_Number
    if (!enrolleeId && !cifNumber) {
      console.error('[hr/members/add] No member ID in response:', text.slice(0, 500));
      return NextResponse.json({ error: apiMessage || 'Enrolment may have failed — no member ID returned. Please check with Leadway Health.' }, { status: 422 });
    }

    // If CIF wasn't in the AddPrincipalOnly response, look it up via enrollee profile
    if (!cifNumber && enrolleeId) {
      try {
        const profileRes = await fetch(
          `${BASE}/api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID?enrolleeid=${encodeURIComponent(enrolleeId)}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
        );
        const profileText = await profileRes.text();
        const profileRaw = JSON.parse(profileText) as Record<string, unknown>;
        const row = (profileRaw?.result ?? profileRaw?.Result ?? profileRaw?.data ?? profileRaw?.Data ?? profileRaw) as Record<string, unknown>;
        cifNumber = row?.Cif_Number ?? row?.CIF_Number ?? row?.CifNo ?? row?.Cif ?? row?.cifNumber ?? row?.MemberCifNo ?? row?.CIF_No ?? null;
        console.log(`[hr/members/add] CIF lookup for ${enrolleeId}: ${cifNumber}`);
      } catch (e) {
        console.warn('[hr/members/add] CIF lookup failed:', e);
      }
    }

    // HR-initiated registrations should not sit in Prognosis's pending queue —
    // auto-approve immediately rather than waiting on manual insurer action.
    let autoApproved = false;
    if (cifNumber) {
      const approveResult = await approveEnrollee({
        cifNumber: cifNumber as string | number,
        reason: 'Active',
        userEmail: session.user.email ?? '',
      });
      autoApproved = approveResult.success;
      if (!approveResult.success) console.warn(`[hr/members/add] Auto-approve failed for CIF ${cifNumber}:`, approveResult.error);
    }

    return NextResponse.json({
      success: true,
      cifNumber,
      enrolleeId,  // MembershipNo/Suffix e.g. "26307209/0"
      autoApproved,
    });
  } catch (err) {
    console.error('[hr/members/add] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to add member' }, { status: 500 });
  }
}
