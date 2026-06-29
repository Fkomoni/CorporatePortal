import { NextResponse } from 'next/server';
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

// GET — validate token and return invitation metadata + list values
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invitation = await prisma.memberInvitation.findUnique({ where: { token } });
  if (!invitation) return NextResponse.json({ error: 'Invalid or expired enrolment link.' }, { status: 404 });
  if (invitation.used) return NextResponse.json({ error: 'This enrolment link has already been used.' }, { status: 410 });
  if (invitation.inviteType === 'dependent' && invitation.usedCount >= invitation.maxDependents) {
    return NextResponse.json({ error: 'This dependent link has reached its maximum number of enrolments.' }, { status: 410 });
  }
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: 'This enrolment link has expired. Please ask HR to send a new one.' }, { status: 410 });

  const remainingSlots = invitation.inviteType === 'dependent'
    ? invitation.maxDependents - invitation.usedCount
    : 1;

  // Fetch list values in parallel
  try {
    const svcToken = await getServiceToken();
    const fetchJson = async (url: string) => {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${svcToken}`, Accept: 'application/json' } });
      try { return await r.json(); } catch { return null; }
    };
    const [genderRaw, maritalRaw, statesRaw, relRaw] = await Promise.all([
      fetchJson(`${BASE}/api/ListValues/GetGender`),
      fetchJson(`${BASE}/api/ListValues/GetMaritalStatus`),
      fetchJson(`${BASE}/api/ListValues/GetStates`),
      fetchJson(`${BASE}/api/ListValues/GetRelationship`),
    ]);

    // Safely extract an array from any API response shape
    const toArr = (v: unknown): Record<string, unknown>[] => {
      if (Array.isArray(v)) return v as Record<string, unknown>[];
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        for (const key of ['result', 'data', 'Data', 'Result', 'items', 'Items']) {
          if (Array.isArray(o[key])) return o[key] as Record<string, unknown>[];
        }
      }
      return [];
    };

    const genders = toArr(genderRaw).map((r) => ({ text: String(r.Sex ?? r.GenderName ?? r.gender ?? ''), value: String(r.Sex_id ?? r.GenderId ?? r.gender_id ?? '') })).filter((g) => g.text);
    const maritalStatuses = toArr(maritalRaw).map((r) => ({ text: String(r.MaritalStatus ?? r.maritalStatus ?? r.Name ?? ''), value: String(r.Marital_statusid ?? r.maritalStatusId ?? r.Id ?? '') })).filter((m) => m.text);
    const states = toArr(statesRaw).map((r) => ({ text: String(r.Text ?? r.StateName ?? r.state ?? r.Name ?? ''), value: String(r.Value ?? r.StateId ?? r.state_id ?? r.Id ?? '') })).filter((s) => s.text);
    const relationships = toArr(relRaw).map((r) => ({ text: String(r.Relationship ?? r.relationship ?? r.Name ?? ''), value: String(r.Relationship_ID ?? r.relationship_id ?? r.RelationshipID ?? r.Id ?? '') })).filter((r) => r.text && r.value);

    return NextResponse.json({
      invitation: {
        email: invitation.email,
        employeeCode: invitation.employeeCode,
        schemeId: invitation.schemeId,
        schemeName: invitation.schemeName,
        scope: invitation.scope,
        inviteType: invitation.inviteType,
        parentCif: invitation.parentCif,
        maxDependents: invitation.maxDependents,
        usedCount: invitation.usedCount,
        remainingSlots,
        expiresAt: invitation.expiresAt,
      },
      genders,
      maritalStatuses,
      states,
      relationships,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load form data' }, { status: 500 });
  }
}

// POST — submit self-enrollment
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invitation = await prisma.memberInvitation.findUnique({ where: { token } });
  if (!invitation) return NextResponse.json({ error: 'Invalid or expired enrolment link.' }, { status: 404 });
  if (invitation.used) return NextResponse.json({ error: 'This enrolment link has already been used.' }, { status: 410 });
  if (invitation.inviteType === 'dependent' && invitation.usedCount >= invitation.maxDependents) {
    return NextResponse.json({ error: 'This dependent link has reached its maximum number of enrolments.' }, { status: 410 });
  }
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: 'This enrolment link has expired.' }, { status: 410 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const isDependent = invitation.inviteType === 'dependent';

  // For principal invites: validate email + employeeCode match
  if (!isDependent) {
    if (String(body.email ?? '').toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json({ error: 'The email address does not match this invitation.' }, { status: 403 });
    }
    if (String(body.employeeCode ?? '') !== invitation.employeeCode) {
      return NextResponse.json({ error: 'The employee code does not match this invitation.' }, { status: 403 });
    }
  }

  try {
    const svcToken = await getServiceToken();

    let apiUrl: string;
    let apiBody: unknown;

    if (isDependent) {
      if (!invitation.parentCif) {
        return NextResponse.json({ error: 'This dependent link is missing the principal reference. Please contact HR.' }, { status: 422 });
      }
      const depPayload = {
        groupid: Number(invitation.groupId) || invitation.groupId,
        schemeid: Number(invitation.schemeId) || invitation.schemeId,
        Scheme: invitation.schemeName,
        regionid: 1,
        Parent_Cif: Number(invitation.parentCif),
        FirstName: body.firstName,
        Surname: body.surname,
        othernames: body.otherNames ?? '',
        DateOfBirth: body.dateOfBirth,
        Sex_ID: body.sexId,
        MaritalStatus: body.maritalStatus ?? '',
        EmailAdress: body.email ?? invitation.email,
        Home_Phone: '',
        Work_Phone: '',
        Mobile: body.mobile ?? '',
        Mobile2: '',
        Hospital: '',
        Postal_Phone: '',
        Postal_Town_ID: body.postalTownId,
        Physical_Add1: body.address ?? '',
        Relationship_ID: body.relationshipId,
        BloodGroup: '',
        genotype: '',
        employeecode: invitation.employeeCode,
        DeviceID: '',
        PreExistingCondition: body.preExistingCondition ?? 'None',
        cadre: '',
        EnrolleePicture: body.enrolleePicture ?? '',
        EnrolleePictureType: body.enrolleePictureType ?? '',
      };
      apiUrl = `${BASE}/api/CorporatePortal/AddDependentsOnly`;
      apiBody = { AddBeneficiary: [depPayload] };
    } else {
      const payload = {
        groupid: Number(invitation.groupId) || invitation.groupId,
        schemeid: Number(invitation.schemeId) || invitation.schemeId,
        Scheme: invitation.schemeName,
        regionid: 1,
        Parent_Cif: 0,
        FirstName: body.firstName,
        Surname: body.surname,
        othernames: body.otherNames ?? '',
        DateOfBirth: body.dateOfBirth,
        Sex_ID: body.sexId,
        MaritalStatus: body.maritalStatus ?? '',
        EmailAdress: invitation.email,
        Home_Phone: body.homePhone ?? '',
        Work_Phone: body.workPhone ?? '',
        Mobile: body.mobile,
        Mobile2: body.mobile2 ?? '',
        Hospital: body.hospital ?? '',
        Postal_Phone: '',
        Postal_Town_ID: body.postalTownId,
        Physical_Add1: body.address ?? '',
        Relationship_ID: '30',
        BloodGroup: '',
        genotype: '',
        employeecode: invitation.employeeCode,
        DeviceID: '',
        PreExistingCondition: body.preExistingCondition ?? 'None',
        cadre: body.cadre ?? '',
        EnrolleePicture: body.enrolleePicture ?? '',
        EnrolleePictureType: body.enrolleePictureType ?? '',
      };
      apiUrl = `${BASE}/api/CorporatePortal/AddPrincipalOnly`;
      apiBody = payload;
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${svcToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(apiBody),
    });
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }

    if (!res.ok) {
      const msg = (raw as Record<string,unknown>)?.Message ?? (raw as Record<string,unknown>)?.message ?? text.slice(0, 200);
      return NextResponse.json({ error: String(msg) }, { status: res.status });
    }

    // For dependent links: increment usedCount; only mark fully used when limit reached
    const newUsedCount = (invitation.usedCount ?? 0) + 1;
    const fullyUsed = invitation.inviteType !== 'dependent' || newUsedCount >= invitation.maxDependents;
    await prisma.memberInvitation.update({
      where: { token },
      data: {
        usedCount: newUsedCount,
        used: fullyUsed,
        usedAt: fullyUsed ? new Date() : undefined,
      },
    });

    const r = raw as Record<string, unknown>;
    // For dependent enrolment, result may be wrapped in data[]
    const dataItem = Array.isArray(r?.data) ? (r.data as Record<string,unknown>[])[0] : r;
    const membershipNo = String(dataItem?.MembershipNo ?? dataItem?.membershipNo ?? r?.MembershipNo ?? r?.membershipNo ?? '');
    const suffix       = String(dataItem?.Suffix ?? dataItem?.suffix ?? r?.Suffix ?? r?.suffix ?? '0');
    const enrolleeId   = membershipNo ? `${membershipNo}/${suffix}` : '';
    return NextResponse.json({
      success: true,
      cifNumber: dataItem?.Cif_Number ?? dataItem?.cifNumber ?? r?.Cif_Number ?? r?.cifNumber ?? null,
      membershipNo,
      suffix,
      enrolleeId,
    });
  } catch (err) {
    console.error('[enroll/token] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Enrolment failed' }, { status: 500 });
  }
}
