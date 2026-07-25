// Shared enrolment-invite email — used both when HR first generates a
// self-enrolment link and when they resend an existing one from Pending
// Enrolees.
import { renderEmailTemplate } from '@/lib/email-template';
import { getServiceToken } from '@/lib/corporate-welcome';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export interface InviteEmailOptions {
  email: string;
  schemeName: string;
  employeeCode: string;
  isDependent: boolean;
  url: string;
}

export function renderInviteEmail(opts: InviteEmailOptions): { subject: string; html: string } {
  const subject = opts.isDependent
    ? 'Leadway Health — Add Your Dependants'
    : 'Leadway Health — Complete Your Health Insurance Enrolment';

  const html = renderEmailTemplate({
    category: 'Enrolment',
    eyebrow: opts.isDependent ? 'Add Dependants' : 'Complete Enrolment',
    headline: opts.isDependent ? 'Add Your Dependants' : 'Complete Your Enrolment',
    body: opts.isDependent
      ? `Your HR team has sent you a link to add your dependants (spouse, children, etc.) to your <strong style="color:#131C4E;">${opts.schemeName}</strong> health insurance plan.`
      : `Your HR team has invited you to enrol on the <strong style="color:#131C4E;">${opts.schemeName}</strong> health insurance plan. Click the button below to complete your enrolment — it only takes a few minutes.`,
    highlight: `
      <div style="text-align:center;margin-bottom:16px;">
        <a href="${opts.url}" style="display:inline-block;background:linear-gradient(135deg,#F56B22,#FF8C4B);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
          ${opts.isDependent ? 'Add Dependants Now' : 'Start Enrolment'}
        </a>
      </div>
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3B8;">Or copy this link</p>
      <p style="margin:0;font-size:12px;color:#131C4E;font-family:'Courier New',monospace;word-break:break-all;">${opts.url}</p>`,
    footnote: `&#x23F0; This link expires in <strong>7 days</strong>. If it expires, please contact your HR team for a new one.${!opts.isDependent ? `<br/>&#x1F512; You will need your <strong>email address</strong> and <strong>employee code (${opts.employeeCode})</strong> to verify your identity.` : ''}`,
  });

  return { subject, html };
}

export async function sendInviteEmail(opts: InviteEmailOptions): Promise<{ emailSent: boolean; emailError: string | null }> {
  const { subject, html } = renderInviteEmail(opts);
  try {
    const token = await getServiceToken();
    const res = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        EmailAddress: opts.email,
        CC: '', BCC: '',
        Subject: subject,
        MessageBody: html,
        Attachments: null, Category: '', UserId: 0, ProviderId: 0, ServiceId: 0, Reference: '', TransactionType: '',
      }),
    });
    const text = await res.text();
    console.log(`[invite-email] SendEmailAlert → HTTP ${res.status}: ${text.slice(0, 500)}`);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;
    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    const apiMessage = String(r?.message ?? r?.Message ?? '');
    if (!res.ok || (apiStatus && !['success', '200', 'ok', 'true'].includes(apiStatus))) {
      return { emailSent: false, emailError: apiMessage || `SendEmailAlert HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { emailSent: true, emailError: null };
  } catch (err) {
    return { emailSent: false, emailError: err instanceof Error ? err.message : 'Email send failed' };
  }
}
