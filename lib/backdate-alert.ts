// Fires an internal alert whenever HR enrols a member/dependant with a cover
// start date earlier than today ("backdated"). Sent to compliance contacts —
// never to the member or HR — so Leadway can flag that claims incurred
// before the real enrolment date are not covered by the backdate.
import { getServiceToken } from '@/lib/corporate-welcome';
import { renderEmailTemplate, EmailDetailRow } from '@/lib/email-template';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

const ALERT_RECIPIENTS = ['G-anumba@leadway.com', 'F-komoni-mbaekwe@leadway.com'];

export interface BackdateAlertDetails {
  memberName: string;
  membershipNo?: string;
  cifNumber?: string | number | null;
  relationship: string; // "Principal" | "Spouse" | "Child" | etc.
  companyName?: string;
  employeeCode: string;
  schemeName: string;
  registeredBy: string; // HR user email
  registrationDate: string; // today, human-readable
  backdatedTo: string; // the chosen start date, human-readable
  email?: string;
  mobile?: string;
  dateOfBirth?: string;
  gender?: string;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export async function sendBackdateAlert(details: BackdateAlertDetails): Promise<void> {
  const rows: EmailDetailRow[] = [
    { label: 'Member Name', value: details.memberName },
    { label: 'Relationship', value: details.relationship },
    { label: 'Membership No.', value: details.membershipNo || '—' },
    { label: 'CIF Number', value: details.cifNumber != null ? String(details.cifNumber) : '—' },
    { label: 'Company', value: details.companyName || '—' },
    { label: 'Employee Code', value: details.employeeCode },
    { label: 'Plan / Scheme', value: details.schemeName },
    { label: 'Gender', value: details.gender || '—' },
    { label: 'Date of Birth', value: details.dateOfBirth || '—' },
    { label: 'Email', value: details.email || '—' },
    { label: 'Mobile', value: details.mobile || '—' },
    { label: 'Registered By (HR)', value: details.registeredBy },
    { label: 'Registration Date', value: details.registrationDate },
    { label: 'Backdated Cover Start Date', value: details.backdatedTo },
  ];

  const html = renderEmailTemplate({
    category: 'Compliance Alert',
    eyebrow: 'Backdated Enrolment',
    headline: 'A member was enrolled with a backdated cover start date',
    body: `HR acknowledged and accepted the backdating warning before proceeding. Full details of the enrolment are below.`,
    highlight: `<strong style="color:#DC2626;">⚠ Backdating does not make expenses incurred before the actual enrolment date eligible for reimbursement or approval.</strong> Leadway HMO will not refund or settle any claims, treatments, admissions, or medications obtained prior to the member's valid enrolment date.`,
    details: rows,
    footnote: 'This is an automated compliance notification triggered by the Corporate Portal.',
  });

  try {
    const token = await getServiceToken();
    // SendEmailAlert takes ONE address in EmailAddress. Passing a
    // semicolon-separated list returned HTTP 200 with the body
    // "fail: Invalid email address format", so every alert was silently
    // dropped — Prognosis reports this failure in the body, not the status
    // code. Send one request per recipient instead.
    for (const recipient of ALERT_RECIPIENTS) {
      const res = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          EmailAddress: recipient,
          CC: '', BCC: '',
          Subject: `⚠ Backdated Enrolment — ${details.memberName} (${details.companyName || details.employeeCode})`,
          MessageBody: html,
          Attachments: null, Category: '', UserId: 0, ProviderId: 0, ServiceId: 0, Reference: '', TransactionType: '',
        }),
      });
      const text = await res.text();
      const ok = res.ok && !/fail/i.test(text);
      if (ok) {
        console.log(`[backdate-alert] Sent to ${recipient}`);
      } else {
        console.error(`[backdate-alert] FAILED for ${recipient} → HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
    }
  } catch (e) {
    console.error('[backdate-alert] Failed to send alert email:', e);
  }
}

export { fmtDate as formatAlertTimestamp };
