import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPolicyYearStart, formatPolicyYearStart } from '@/lib/policy-year';
import { approveEnrollee } from '@/lib/approve-enrollee';
import { findDuplicateContact, duplicateClashMessage } from '@/lib/duplicate-contact-check';
import { sendBackdateAlert } from '@/lib/backdate-alert';
import { prisma } from '@/lib/prisma';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

// approveEnrollee expects dd/mm/yyyy; startDate arrives as an ISO date (yyyy-mm-dd).
function toDdMmYyyy(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

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
  backdateAcknowledged?: boolean;
  nin?: string;
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
  if (body.nin && !/^\d{11}$/.test(body.nin)) {
    return NextResponse.json({ error: 'NIN must be exactly 11 digits.' }, { status: 400 });
  }

  // Cover may be backdated, but never earlier than the start of the group's
  // current policy year, and HR must acknowledge the backdate warning first —
  // Leadway settles no claims incurred before the valid enrolment date.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isBackdated = !!body.startDate && new Date(body.startDate) < today;
  if (body.startDate) {
    const chosenStart = new Date(body.startDate); chosenStart.setHours(0, 0, 0, 0);
    if (isNaN(chosenStart.getTime())) {
      return NextResponse.json({ error: 'Invalid cover start date.' }, { status: 400 });
    }
    const policyYearStart = await getPolicyYearStart(session.user.companyId ?? '');
    if (body.startDate < policyYearStart) {
      return NextResponse.json({ error: `Cover start date cannot be earlier than the start of the current policy year (${formatPolicyYearStart(policyYearStart)}).` }, { status: 400 });
    }
    if (isBackdated && !body.backdateAcknowledged) {
      return NextResponse.json({ error: 'You must acknowledge the backdated enrolment warning before proceeding.' }, { status: 400 });
    }
  }

  const groupId = session.user.companyId ?? '';

  try {
    const token = await getServiceToken();

    // Flag emails/mobiles already registered to another member in this group —
    // Prognosis's AddPrincipalOnly accepts duplicates silently, so check first.
    try {
      const clash = await findDuplicateContact(BASE, token, groupId, email, mobile);
      if (clash) {
        return NextResponse.json({ error: duplicateClashMessage(clash) }, { status: 409 });
      }
    } catch (e) {
      console.warn('[hr/members/add] Duplicate check failed, proceeding without it:', e);
    }

    // regionid is Prognosis's real field for state (GetStates returns
    // {RegionID, RegionName} — "region" is Prognosis's word for state).
    // body.stateId is what the State dropdown actually sets; body.regionId
    // is only a fallback in case a caller already resolved it that way.
    const resolvedRegionId = body.regionId
      ? (Number(body.regionId) || body.regionId)
      : body.stateId ? (Number(body.stateId) || body.stateId) : 1;

    const payload = {
      groupid: Number(groupId) || groupId,
      schemeid: Number(schemeId) || schemeId,
      Scheme: schemeName,
      regionid: resolvedRegionId,
      Parent_Cif: 0,
      MemberShipNo: '',
      FirstName: firstName,
      Surname: surname,
      othernames: body.otherNames ?? '',
      DateOfBirth: dateOfBirth,
      Sex_ID: sexId,
      MaritalStatus: body.maritalStatus ?? '',
      titleid: 0,
      // Prognosis's confirmed AddPrincipalOnly/AddFamily shape uses "1" for
      // the principal's own Relationship_ID (previously sent as "30", which
      // is a dependent-type relationship — corrected per their updated docs).
      Relationship_ID: '1',
      EmailAdress: email,
      Home_Phone: '',
      Work_Phone: '',
      Mobile: mobile,
      Mobile2: body.mobile2 ?? '',
      Hospital: '0',
      Postal_Phone: '',
      Postal_Town_ID: postalTownId,
      Physical_Add1: body.address ?? '',
      surburb_id: 0,
      BloodGroup: body.bloodGroup ?? '',
      genotype: body.genotype ?? '',
      employeecode: employeeCode,
      cadre: body.cadre ?? '',
      DeviceID: '',
      OfflineID: '',
      idTypeID: '0',
      PreExistingCondition: body.preExistingCondition ?? 'None',
      EnrolleePicture: body.enrolleePicture ?? '',
      EnrolleePictureType: body.enrolleePictureType ?? '',
      registrationsource: 'Web Portal',
      NIN: body.nin ?? '',
      // HR is registering this member directly (not via a self-enrolment
      // link) — the plan should be active immediately, not queued pending.
      Activated: true,
      startdate: body.startDate ?? '',
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

    // Record this CIF as portal-sourced (with the true submission timestamp)
    // regardless of whether auto-approve below succeeds — if it ever ends up
    // stuck in Pending Enrolees (e.g. auto-approve failed), this is what lets
    // that list show "Corporate Portal" instead of "Enrolee App" and the
    // actual registration date instead of Prognosis's plan-start-date field.
    if (cifNumber) {
      try {
        await prisma.linkRegistration.upsert({
          where: { cifNumber: String(cifNumber) },
          create: { cifNumber: String(cifNumber), groupId: String(groupId) || null },
          update: {},
        });
      } catch (e) {
        console.warn('[hr/members/add] Failed to record registration source:', e);
      }
    }

    // HR-initiated registrations should not sit in Prognosis's pending queue —
    // auto-approve immediately rather than waiting on manual insurer action.
    let autoApproved = false;
    let approveError: string | null = null;
    if (cifNumber) {
      const approveResult = await approveEnrollee({
        cifNumber: cifNumber as string | number,
        reason: 'Active',
        userEmail: session.user.email ?? '',
        // Activate on the cover start date HR chose, not today, so a
        // future-dated start doesn't go live early.
        effectiveDate: body.startDate ? toDdMmYyyy(body.startDate) : undefined,
      });
      autoApproved = approveResult.success;
      if (!approveResult.success) {
        approveError = approveResult.error ?? 'Unknown error';
        // Loud: the member exists but is NOT approved, and HR must be told —
        // this failing quietly is what previously hid a broken approval path.
        console.error(`[hr/members/add] Auto-approve FAILED for CIF ${cifNumber}: ${approveError}`);
      }
    }

    if (isBackdated) {
      void sendBackdateAlert({
        memberName: `${firstName} ${surname}`.trim(),
        membershipNo: enrolleeId,
        cifNumber: cifNumber as string | number | null,
        relationship: 'Principal',
        companyName: session.user.companyName ?? undefined,
        employeeCode,
        schemeName,
        registeredBy: session.user.email ?? '',
        registrationDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        backdatedTo: new Date(body.startDate!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        email, mobile, dateOfBirth, gender: sexId === '2' ? 'Female' : 'Male',
      });
    }

    return NextResponse.json({
      success: true,
      cifNumber,
      enrolleeId,  // MembershipNo/Suffix e.g. "26307209/0"
      autoApproved,
      approveError,
    });
  } catch (err) {
    console.error('[hr/members/add] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to add member' }, { status: 500 });
  }
}
