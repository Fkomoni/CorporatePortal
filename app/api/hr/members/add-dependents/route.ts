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

export interface Dependent {
  firstName: string;
  surname: string;
  otherNames?: string;
  dateOfBirth: string;
  sexId: string;
  maritalStatus?: string;
  email?: string;
  mobile?: string;
  postalTownId: string;
  relationshipId: string;
  preExistingCondition?: string;
  enrolleePicture?: string;
  enrolleePictureType?: string;
}

export interface AddDependentsPayload {
  parentCif: number;           // Principal's CIF number
  schemeId: string;
  schemeName: string;
  employeeCode: string;
  dependents: Dependent[];
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: AddDependentsPayload;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { parentCif, schemeId, schemeName, employeeCode, dependents } = body;
  if (!parentCif || !schemeId || !employeeCode || !dependents?.length) {
    return NextResponse.json({ error: 'parentCif, schemeId, employeeCode and at least one dependent are required' }, { status: 400 });
  }

  const groupId = session.user.companyId ?? '';

  try {
    const token = await getServiceToken();

    const addBeneficiary = dependents.map((dep) => ({
      groupid: Number(groupId) || groupId,
      schemeid: Number(schemeId) || schemeId,
      Scheme: schemeName,
      regionid: 1,
      Parent_Cif: parentCif,
      FirstName: dep.firstName,
      Surname: dep.surname,
      othernames: dep.otherNames ?? '',
      DateOfBirth: dep.dateOfBirth,
      Sex_ID: dep.sexId,
      MaritalStatus: dep.maritalStatus ?? '',
      EmailAdress: dep.email ?? '',
      Home_Phone: '',
      Work_Phone: '',
      Mobile: dep.mobile ?? '',
      Mobile2: '',
      Hospital: '',
      Postal_Phone: '',
      Postal_Town_ID: dep.postalTownId,
      Physical_Add1: '',
      Relationship_ID: dep.relationshipId,
      BloodGroup: '',
      genotype: '',
      employeecode: employeeCode,
      DeviceID: '',
      PreExistingCondition: dep.preExistingCondition ?? 'None',
      cadre: '',
      EnrolleePicture: dep.enrolleePicture ?? '',
      EnrolleePictureType: dep.enrolleePictureType ?? '',
    }));

    const res = await fetch(`${BASE}/api/CorporatePortal/AddDependentsOnly`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ AddBeneficiary: addBeneficiary }),
    });

    const text = await res.text();
    console.log(`[hr/members/add-dependents] Prognosis HTTP ${res.status}: ${text.slice(0, 500)}`);
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
      return NextResponse.json({ error: apiMessage || `Failed (${apiStatus})` }, { status: 422 });
    }

    // Normalise response — Prognosis returns array under data[]
    const dataArr = Array.isArray(r?.data) ? (r.data as Record<string, unknown>[]) : [];
    const enrolled = dataArr.map((d) => {
      const membershipNo = String(d?.MembershipNo ?? d?.membershipNo ?? '');
      const suffix = String(d?.Suffix ?? d?.suffix ?? '0');
      return {
        name: String(d?.Name ?? d?.name ?? ''),
        cifNumber: d?.Cif_Number ?? d?.cifNumber ?? null,
        membershipNo,
        suffix,
        enrolleeId: membershipNo ? `${membershipNo}/${suffix}` : '',
      };
    });

    return NextResponse.json({ success: true, enrolled });
  } catch (err) {
    console.error('[hr/members/add-dependents] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to add dependents' }, { status: 500 });
  }
}
