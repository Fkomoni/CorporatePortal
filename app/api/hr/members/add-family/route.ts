// Adds a principal AND their dependants in a single atomic call, using
// Prognosis's AddFamily endpoint: confirmed shape: one AddBeneficiary array
// where every entry (principal included) sends Parent_Cif: 0 and is
// differentiated purely by Relationship_ID ("1" = principal). Prognosis
// groups them into one family itself; we don't resolve/pass a parent CIF.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPolicyYearStart, formatPolicyYearStart } from '@/lib/policy-year';
import { validateMobile, normalizeNigerianMobile } from '@/lib/phone';
import { validateEmail, normalizeEmail } from '@/lib/email';
import { approveEnrollee } from '@/lib/approve-enrollee';
import { findDuplicateContact, duplicateClashMessage } from '@/lib/duplicate-contact-check';
import { sendBackdateAlert } from '@/lib/backdate-alert';
import { prisma } from '@/lib/prisma';

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

function toDdMmYyyy(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export interface FamilyMember {
  firstName: string;
  surname: string;
  otherNames?: string;
  dateOfBirth: string;
  sexId: string;
  maritalStatus?: string;
  email?: string;
  mobile?: string;
  mobile2?: string;
  regionId?: string;
  postalTownId?: string;
  address?: string;
  bloodGroup?: string;
  genotype?: string;
  preExistingCondition?: string;
  enrolleePicture?: string;
  enrolleePictureType?: string;
  nin?: string;
  // Only meaningful for dependants: the principal is always forced to "1".
  relationshipId?: string;
}

export interface AddFamilyPayload {
  schemeId: string;
  schemeName: string;
  employeeCode: string;
  principal: FamilyMember;
  dependents: FamilyMember[];
  startDate?: string;
  backdateAcknowledged?: boolean;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: AddFamilyPayload;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { schemeId, schemeName, employeeCode, principal, dependents } = body;
  if (!schemeId || !employeeCode || !principal) {
    return NextResponse.json({ error: 'schemeId, employeeCode and principal are required' }, { status: 400 });
  }
  if (!principal.firstName || !principal.surname || !principal.dateOfBirth || !principal.sexId || !principal.email || !principal.mobile) {
    return NextResponse.json({ error: 'Principal: first name, surname, date of birth, gender, email and mobile are required' }, { status: 400 });
  }
  for (const dep of dependents ?? []) {
    if (!dep.firstName || !dep.surname || !dep.dateOfBirth || !dep.sexId || !dep.relationshipId) {
      return NextResponse.json({ error: 'Each dependant needs first name, surname, date of birth, gender and relationship' }, { status: 400 });
    }
  }
  const allMembers = [principal, ...(dependents ?? [])];
  for (const m of allMembers) {
    if (m.nin && !/^\d{11}$/.test(m.nin)) {
      return NextResponse.json({ error: `NIN for ${m.firstName} ${m.surname} must be exactly 11 digits.` }, { status: 400 });
    }
    // The principal must have a usable email and mobile; dependants' are optional.
    const who = `${m.firstName} ${m.surname}`.trim();
    const contactErr = validateEmail(m.email, { required: m === principal, label: `Email for ${who}` })
      ?? validateMobile(m.mobile, { required: m === principal, label: `Mobile number for ${who}` })
      ?? validateMobile(m.mobile2, { label: `Alternative mobile for ${who}` });
    if (contactErr) return NextResponse.json({ error: contactErr }, { status: 400 });
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isBackdated = !!body.startDate && new Date(body.startDate) < today;
  // Backdating is allowed as far back as the start of the group's current policy
  // year, subject to HR acknowledging the backdate warning (no claims settled
  // before the valid enrolment date).
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

    // Flag emails/mobiles already registered to another member in this group -
    // AddFamily accepts duplicates silently, so check every member first.
    try {
      for (const m of allMembers) {
        if (!m.email && !m.mobile) continue;
        const clash = await findDuplicateContact(BASE, token, groupId, m.email ?? '', m.mobile ?? '');
        if (clash) {
          return NextResponse.json({ error: `${duplicateClashMessage(clash)} (checked while adding ${m.firstName} ${m.surname})` }, { status: 409 });
        }
      }
    } catch (e) {
      console.warn('[hr/members/add-family] Duplicate check failed, proceeding without it:', e);
    }

    const toBeneficiary = (m: FamilyMember, isPrincipal: boolean) => ({
      groupid: Number(groupId) || groupId,
      schemeid: Number(schemeId) || schemeId,
      Parent_Cif: 0,
      MemberShipNo: '',
      FirstName: m.firstName,
      Surname: m.surname,
      othernames: m.otherNames ?? '',
      DateOfBirth: m.dateOfBirth,
      Sex_ID: m.sexId,
      MaritalStatus: m.maritalStatus ?? '',
      titleid: 0,
      Relationship_ID: isPrincipal ? '1' : String(m.relationshipId),
      EmailAdress: normalizeEmail(m.email),
      Home_Phone: '',
      Work_Phone: '',
      Mobile: normalizeNigerianMobile(m.mobile),
      Mobile2: normalizeNigerianMobile(m.mobile2),
      Hospital: '0',
      Postal_Phone: '',
      Postal_Town_ID: m.postalTownId ?? '0',
      Physical_Add1: m.address ?? '',
      surburb_id: 0,
      BloodGroup: m.bloodGroup ?? '',
      genotype: m.genotype ?? '',
      employeecode: employeeCode,
      cadre: '',
      DeviceID: '',
      OfflineID: '',
      idTypeID: '0',
      PreExistingCondition: m.preExistingCondition ?? 'None',
      registrationsource: 'Web Portal',
      startdate: body.startDate ?? '',
      // HR is registering this family directly (not via a self-enrolment
      // link): active immediately, not queued pending.
      Activated: true,
      EnrolleePicture: m.enrolleePicture ?? '',
      EnrolleePictureType: m.enrolleePictureType ?? '',
      NIN: m.nin ?? '',
      regionid: m.regionId ? (Number(m.regionId) || m.regionId) : 1,
    });

    const requestBody = {
      AddBeneficiary: [
        toBeneficiary(principal, true),
        ...(dependents ?? []).map((d) => toBeneficiary(d, false)),
      ],
    };
    console.log('[hr/members/add-family] REQUEST payload:', JSON.stringify(requestBody, null, 2));

    const res = await fetch(`${BASE}/api/CorporatePortal/AddFamily`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const text = await res.text();
    console.log(`[hr/members/add-family] RESPONSE HTTP ${res.status}: ${text.slice(0, 2000)}`);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }

    const r = raw as Record<string, unknown>;

    if (!res.ok) {
      const msg = r?.Message ?? r?.message ?? r?.error ?? r?.Error ?? text.slice(0, 300);
      return NextResponse.json({ error: String(msg) }, { status: res.status });
    }

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');
    if (apiStatus && apiStatus !== 'success' && apiStatus !== '200') {
      console.error('[hr/members/add-family] Prognosis error body:', text.slice(0, 500));
      return NextResponse.json({ error: apiMessage || `Enrolment failed (${apiStatus})` }, { status: 422 });
    }

    const dataArr = Array.isArray(r?.data) ? (r.data as Record<string, unknown>[]) : [];
    const enrolled = dataArr.map((d, i) => {
      const membershipNo = String(d?.MembershipNo ?? d?.membershipNo ?? '');
      const suffix = String(d?.Suffix ?? d?.suffix ?? '0');
      const cifRaw = d?.Cif_Number ?? d?.cifNumber ?? null;
      return {
        name: i === 0 ? `${principal.firstName} ${principal.surname}` : `${dependents[i - 1].firstName} ${dependents[i - 1].surname}`,
        isPrincipal: i === 0,
        cifNumber: (cifRaw != null ? String(cifRaw) : null) as string | null,
        membershipNo,
        suffix,
        enrolleeId: membershipNo ? `${membershipNo}/${suffix}` : '',
      };
    });

    if (enrolled.length === 0) {
      console.error('[hr/members/add-family] No members returned in response:', text.slice(0, 500));
      return NextResponse.json({ error: apiMessage || 'Enrolment may have failed: no members returned. Please check with Leadway Health.' }, { status: 422 });
    }

    // Record every CIF as portal-sourced (true submission timestamp) so, if
    // auto-approve below fails for any of them, Pending Enrolees shows the
    // correct source and date instead of "Enrolee App" / the wrong date.
    for (const m of enrolled) {
      if (!m.cifNumber) continue;
      try {
        await prisma.linkRegistration.upsert({
          where: { cifNumber: m.cifNumber },
          create: { cifNumber: m.cifNumber, groupId: String(groupId) || null },
          update: {},
        });
      } catch (e) {
        console.warn('[hr/members/add-family] Failed to record registration source:', e);
      }
    }

    // HR-initiated registrations should not sit in Prognosis's pending queue -
    // auto-approve every member (principal + each dependant) individually,
    // same as add/route.ts and add-dependents/route.ts.
    const userEmail = session.user.email ?? '';
    let autoApproved = true;
    let approveError: string | null = null;
    for (const m of enrolled) {
      if (!m.cifNumber) { autoApproved = false; continue; }
      const approveResult = await approveEnrollee({
        cifNumber: m.cifNumber,
        reason: 'Active',
        userEmail,
        effectiveDate: body.startDate ? toDdMmYyyy(body.startDate) : undefined,
      });
      if (!approveResult.success) {
        autoApproved = false;
        approveError = approveResult.error ?? 'Unknown error';
        console.error(`[hr/members/add-family] Auto-approve FAILED for CIF ${m.cifNumber}: ${approveError}`);
      }
    }

    if (isBackdated) {
      for (const m of enrolled) {
        void sendBackdateAlert({
          memberName: m.name,
          membershipNo: m.enrolleeId,
          cifNumber: m.cifNumber,
          relationship: m.isPrincipal ? 'Principal' : 'Dependant',
          companyName: session.user.companyName ?? undefined,
          employeeCode,
          schemeName,
          registeredBy: userEmail,
          registrationDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          backdatedTo: new Date(body.startDate!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        });
      }
    }

    return NextResponse.json({ success: true, enrolled, autoApproved, approveError });
  } catch (err) {
    console.error('[hr/members/add-family] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to add family' }, { status: 500 });
  }
}
