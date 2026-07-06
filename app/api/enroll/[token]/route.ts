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
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: 'This enrolment link has expired. Please ask HR to send a new one.' }, { status: 410 });

  // Fetch list values in parallel
  try {
    const svcToken = await getServiceToken();
    const fetchJson = async (url: string) => {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${svcToken}`, Accept: 'application/json' } });
      try { return await r.json(); } catch { return null; }
    };
    const [genderRaw, maritalRaw, statesRaw] = await Promise.all([
      fetchJson(`${BASE}/api/ListValues/GetGender`),
      fetchJson(`${BASE}/api/ListValues/GetMaritalStatus`),
      fetchJson(`${BASE}/api/ListValues/GetStates`),
    ]);

    const genders = (genderRaw?.result ?? genderRaw ?? []).map((r: Record<string,unknown>) => ({ text: String(r.Sex ?? ''), value: String(r.Sex_id ?? '') })).filter((g: {text:string;value:string}) => g.text);
    const maritalStatuses = (maritalRaw?.result ?? maritalRaw ?? []).map((r: Record<string,unknown>) => ({ text: String(r.MaritalStatus ?? ''), value: String(r.Marital_statusid ?? '') })).filter((m: {text:string;value:string}) => m.text);
    const states = (Array.isArray(statesRaw) ? statesRaw : []).map((r: Record<string,unknown>) => ({ text: String(r.Text ?? ''), value: String(r.Value ?? '') })).filter((s: {text:string;value:string}) => s.text);

    return NextResponse.json({
      invitation: {
        email: invitation.email,
        employeeCode: invitation.employeeCode,
        schemeId: invitation.schemeId,
        schemeName: invitation.schemeName,
        scope: invitation.scope,
        expiresAt: invitation.expiresAt,
      },
      genders,
      maritalStatuses,
      states,
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
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: 'This enrolment link has expired.' }, { status: 410 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Validate email + employeeCode match the invitation (prevents link misuse)
  if (String(body.email ?? '').toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json({ error: 'The email address does not match this invitation.' }, { status: 403 });
  }
  if (String(body.employeeCode ?? '') !== invitation.employeeCode) {
    return NextResponse.json({ error: 'The employee code does not match this invitation.' }, { status: 403 });
  }

  try {
    const svcToken = await getServiceToken();

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
      BloodGroup: body.bloodGroup ?? '',
      genotype: body.genotype ?? '',
      employeecode: invitation.employeeCode,
      DeviceID: '',
      PreExistingCondition: body.preExistingCondition ?? 'None',
      cadre: body.cadre ?? '',
      EnrolleePicture: body.enrolleePicture ?? '',
      EnrolleePictureType: body.enrolleePictureType ?? '',
    };

    const res = await fetch(`${BASE}/api/CorporatePortal/AddPrincipalOnly`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${svcToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }

    if (!res.ok) {
      const msg = (raw as Record<string,unknown>)?.Message ?? (raw as Record<string,unknown>)?.message ?? text.slice(0, 200);
      return NextResponse.json({ error: String(msg) }, { status: res.status });
    }

    // Mark invitation as used
    await prisma.memberInvitation.update({
      where: { token },
      data: { used: true, usedAt: new Date() },
    });

    const r = raw as Record<string, unknown>;
    const membershipNo   = String(r?.membershipNo   ?? r?.MembershipNo   ?? '');
    const fullEnrolleeId = String(r?.fullEnrolleeId ?? r?.FullEnrolleeId ?? '');

    // Fire enrolment confirmation email to HR if they have the preference on
    void (async () => {
      try {
        const hrUser = await prisma.user.findUnique({ where: { id: invitation.createdBy } });
        if (!hrUser?.email) return;

        const notifPrefs = await prisma.notificationPreferences.findUnique({ where: { userId: invitation.createdBy } });
        // Default is true if no record exists yet
        const shouldNotify = notifPrefs ? notifPrefs.enrolmentConfirm : true;
        if (!shouldNotify) return;

        const memberName = [String(body.firstName ?? ''), String(body.surname ?? '')].filter(Boolean).join(' ');
        const emailBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#131C4E;padding:24px 32px;border-radius:12px 12px 0 0;">
    <p style="font-size:22px;font-weight:900;color:#fff;margin:0;letter-spacing:-0.02em">LEADWAY <span style="color:#F56B22;">HEALTH</span></p>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:2px 0 0;letter-spacing:0.1em">CORPORATE PORTAL</p>
  </div>
  <div style="background:#fff;padding:36px 32px;border:1px solid #E5E7F1;border-top:none;">
    <p style="font-size:20px;font-weight:700;color:#131C4E;margin:0 0 8px">New Member Enrolled</p>
    <p style="font-size:14px;color:#6B7280;line-height:1.6;margin:0 0 24px">
      A staff member has successfully completed self-enrolment on the Leadway Health HMO Corporate Portal.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
      <tr style="background:#F9FAFB;"><td style="padding:10px 14px;font-weight:600;width:40%">Name</td><td style="padding:10px 14px">${memberName}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600">Email</td><td style="padding:10px 14px">${invitation.email}</td></tr>
      <tr style="background:#F9FAFB;"><td style="padding:10px 14px;font-weight:600">Employee Code</td><td style="padding:10px 14px">${invitation.employeeCode}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600">Scheme</td><td style="padding:10px 14px">${invitation.schemeName}</td></tr>
      ${fullEnrolleeId ? `<tr style="background:#F9FAFB;"><td style="padding:10px 14px;font-weight:600">Member ID</td><td style="padding:10px 14px;font-weight:700;color:#131C4E">${fullEnrolleeId}</td></tr>` : ''}
      ${membershipNo ? `<tr><td style="padding:10px 14px;font-weight:600">Membership No.</td><td style="padding:10px 14px">${membershipNo}</td></tr>` : ''}
    </table>
    <hr style="border:none;border-top:1px solid #F0F1F5;margin:28px 0"/>
    <p style="font-size:11px;color:#B0B7C9;margin:0">To manage this member, log in to the Corporate Portal and go to the People section.</p>
  </div>
  <div style="background:#FAFBFC;padding:16px 32px;border:1px solid #E5E7F1;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
    <p style="font-size:11px;color:#B0B7C9;margin:0">© 2025 Leadway Health HMO. All rights reserved.</p>
  </div>
</div>`.trim();

        const svcToken = await getServiceToken();
        await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${svcToken}` },
          body: JSON.stringify({
            EmailAddress: hrUser.email,
            CC: '', BCC: '',
            Subject: `Enrolment Confirmed – ${memberName || invitation.email}`,
            MessageBody: emailBody,
            Attachments: null,
            Category: 'Enrollment Notification',
            UserId: 0, ProviderId: 0, ServiceId: 0,
            Reference: fullEnrolleeId,
            TransactionType: 'Enrollment',
          }),
        });
      } catch (e) {
        console.error('[enroll] HR notification email failed (non-fatal):', e instanceof Error ? e.message : e);
      }
    })();

    return NextResponse.json({
      success: true,
      cifNumber: r?.cifNumber ?? r?.CifNumber ?? null,
      membershipNo,
      suffix: String(r?.suffix ?? r?.Suffix ?? '0'),
      fullEnrolleeId,
    });
  } catch (err) {
    console.error('[enroll/token] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Enrolment failed' }, { status: 500 });
  }
}
