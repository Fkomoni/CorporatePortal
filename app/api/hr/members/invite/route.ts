import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderEmailTemplate } from '@/lib/email-template';

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

async function sendPrognosisEmail(token: string, to: string, subject: string, html: string): Promise<void> {
  const res = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      EmailAddress: to,
      CC: '',
      BCC: '',
      Subject: subject,
      MessageBody: html,
      Attachments: null,
      Category: '',
      UserId: 0,
      ProviderId: 0,
      ServiceId: 0,
      Reference: '',
      TransactionType: '',
    }),
  });
  const text = await res.text();
  console.log(`[invite] SendEmailAlert → HTTP ${res.status}: ${text.slice(0, 500)}`);
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { raw = text; }
  const r = raw as Record<string, unknown>;
  // Prognosis can return HTTP 200 with a logical failure embedded in the
  // body — never trust res.ok alone.
  const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
  const apiMessage = String(r?.message ?? r?.Message ?? '');
  if (!res.ok || (apiStatus && !['success', '200', 'ok', 'true'].includes(apiStatus))) {
    throw new Error(apiMessage || `SendEmailAlert HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: {
    email: string;
    employeeCode: string;
    schemeId: string;
    schemeName: string;
    scope?: string;
    inviteType?: 'principal' | 'dependent';
    parentCif?: string;
    maxDependents?: number;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    email, employeeCode, schemeId, schemeName,
    scope = 'self',
    inviteType = 'principal',
    parentCif,
    maxDependents = 1,
  } = body;

  if (!email || !employeeCode || !schemeId) {
    return NextResponse.json({ error: 'email, employeeCode and schemeId are required' }, { status: 400 });
  }
  if (inviteType === 'dependent' && !parentCif) {
    return NextResponse.json({ error: 'parentCif is required for dependent invitations' }, { status: 400 });
  }

  const groupId = session.user.companyId ?? '';

  if (inviteType === 'principal') {
    const existing = await prisma.memberInvitation.findFirst({
      where: { email, employeeCode, groupId, inviteType: 'principal', used: false, expiresAt: { gt: new Date() } },
    });
    if (existing) {
      const base = process.env.NEXTAUTH_URL ?? 'https://corporateportal.onrender.com';
      return NextResponse.json({ token: existing.token, url: `${base}/enroll/${existing.token}`, reused: true });
    }
    const usedInvite = await prisma.memberInvitation.findFirst({
      where: { email, employeeCode, groupId, inviteType: 'principal', used: true },
    });
    if (usedInvite) {
      return NextResponse.json({ error: 'This staff member has already enrolled via an invitation link.' }, { status: 409 });
    }
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await prisma.memberInvitation.create({
    data: {
      email,
      employeeCode,
      schemeId,
      schemeName,
      groupId,
      scope,
      inviteType,
      parentCif: parentCif ?? null,
      maxDependents,
      expiresAt,
      createdBy: session.user.email ?? '',
    },
  });

  const base = process.env.NEXTAUTH_URL ?? 'https://corporateportal.onrender.com';
  const url = `${base}/enroll/${invitation.token}`;

  let emailSent = false;
  let emailError: string | null = null;

  const isDependent = inviteType === 'dependent';
  const subject = isDependent
    ? 'Leadway Health — Add Your Dependants'
    : 'Leadway Health — Complete Your Health Insurance Enrolment';

  const html = renderEmailTemplate({
    category: 'Enrolment',
    eyebrow: isDependent ? 'Add Dependants' : 'Complete Enrolment',
    headline: isDependent ? 'Add Your Dependants' : 'Complete Your Enrolment',
    body: isDependent
      ? `Your HR team has sent you a link to add your dependants (spouse, children, etc.) to your <strong style="color:#131C4E;">${schemeName}</strong> health insurance plan.`
      : `Your HR team has invited you to enrol on the <strong style="color:#131C4E;">${schemeName}</strong> health insurance plan. Click the button below to complete your enrolment — it only takes a few minutes.`,
    highlight: `
      <div style="text-align:center;margin-bottom:16px;">
        <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#F56B22,#FF8C4B);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
          ${isDependent ? 'Add Dependants Now' : 'Start Enrolment'}
        </a>
      </div>
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3B8;">Or copy this link</p>
      <p style="margin:0;font-size:12px;color:#131C4E;font-family:'Courier New',monospace;word-break:break-all;">${url}</p>`,
    footnote: `&#x23F0; This link expires in <strong>7 days</strong>. If it expires, please contact your HR team for a new one.${!isDependent ? `<br/>&#x1F512; You will need your <strong>email address</strong> and <strong>employee code (${employeeCode})</strong> to verify your identity.` : ''}`,
  });

  try {
    const token = await getServiceToken();
    await sendPrognosisEmail(token, email, subject, html);
    emailSent = true;
    console.log(`[invite] Email sent via Prognosis to ${email}`);
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'Email send failed';
    console.error('[invite] Email error:', err);
  }

  return NextResponse.json({ token: invitation.token, url, reused: false, emailSent, emailError });
}
