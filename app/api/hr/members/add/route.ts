import { auth } from '@/auth';
import { NextResponse } from 'next/server';

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
  dateOfBirth: string;         // ISO date string
  sexId: string;               // "1" Male, "2" Female
  maritalStatus?: string;
  email: string;
  mobile: string;
  mobile2?: string;
  homePhone?: string;
  workPhone?: string;
  postalTownId: string;        // state ID
  address?: string;
  bloodGroup?: string;
  genotype?: string;
  employeeCode: string;
  preExistingCondition?: string;
  cadre?: string;
  hospital?: string;
  enrolleePicture?: string;    // base64
  enrolleePictureType?: string;
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

  const groupId = session.user.companyId ?? '';

  try {
    const token = await getServiceToken();

    const payload = {
      groupid: Number(groupId) || groupId,
      schemeid: Number(schemeId) || schemeId,
      Scheme: schemeName,
      regionid: 1,
      Parent_Cif: 0,
      FirstName: firstName,
      Surname: surname,
      othernames: body.otherNames ?? '',
      DateOfBirth: dateOfBirth,
      Sex_ID: sexId,
      MaritalStatus: body.maritalStatus ?? '',
      EmailAdress: email,
      Home_Phone: body.homePhone ?? '',
      Work_Phone: body.workPhone ?? '',
      Mobile: mobile,
      Mobile2: body.mobile2 ?? '',
      Hospital: body.hospital ?? '',
      Postal_Phone: '',
      Postal_Town_ID: postalTownId,
      Physical_Add1: body.address ?? '',
      Relationship_ID: '30',  // principal
      BloodGroup: body.bloodGroup ?? '',
      genotype: body.genotype ?? '',
      employeecode: employeeCode,
      DeviceID: '',
      PreExistingCondition: body.preExistingCondition ?? 'None',
      cadre: body.cadre ?? '',
      EnrolleePicture: body.enrolleePicture ?? '',
      EnrolleePictureType: body.enrolleePictureType ?? '',
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

    const fullEnrolleeId = String(r?.fullEnrolleeId ?? r?.FullEnrolleeId ?? '');
    const membershipNo   = String(r?.membershipNo   ?? r?.MembershipNo   ?? '');

    // If no member ID came back, treat it as a failure so the error surfaces
    if (!fullEnrolleeId && !membershipNo) {
      console.error('[hr/members/add] No member ID in response:', text.slice(0, 500));
      return NextResponse.json({ error: apiMessage || 'Enrolment may have failed — no member ID was returned. Please check with Leadway Health.' }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      cifNumber: r?.cifNumber ?? r?.CifNumber ?? null,
      membershipNo,
      suffix: String(r?.suffix ?? r?.Suffix ?? '0'),
      fullEnrolleeId,
    });
  } catch (err) {
    console.error('[hr/members/add] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to add member' }, { status: 500 });
  }
}
