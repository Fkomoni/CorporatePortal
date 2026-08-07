// Server-only half of Service Desk routing: which mailbox owns each queue,
// what the email looks like, and sending it through Prognosis.
//
// Kept apart from lib/service-request-routes.ts because that module is
// imported by the Service Desk client page — internal mailbox addresses have
// no business in a browser bundle.
import { getServiceToken } from '@/lib/corporate-welcome';
import { renderEmailTemplate } from '@/lib/email-template';
import { RequestRoute, buildSubject, formatBytes } from '@/lib/service-request-routes';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

// A queue moving to a different team is an ops change, not a code change, so
// each address can be corrected from Render's environment without a deploy.
// Unset — the normal case — keeps the address below.
const env = (name: string, fallback: string) => (process.env[name] || '').trim() || fallback;

interface Mailbox {
  /** Queue that owns the request. Must be exactly one address. */
  to: string;
  /** Leadway addresses copied in addition to the HR raiser. */
  cc: string[];
}

const MAILBOXES: Record<string, Mailbox> = {
  'General Enquiries': {
    to: env('SERVICE_DESK_TO_GENERAL', 'healthcare@leadway.com'),
    cc: [],
  },
  'Member Enrolment': {
    to: env('SERVICE_DESK_TO_ENROLMENT', 'healthenrol@leadway.com'),
    cc: [],
  },
  'Member Refund': {
    to: env('SERVICE_DESK_TO_REFUND', 'healthclaims@leadway.com'),
    cc: [],
  },
  'Medical Case Review': {
    to: env('SERVICE_DESK_TO_CASE_REVIEW', 'CaseManagement@leadway.com'),
    cc: [env('SERVICE_DESK_CC_CASE_REVIEW', 'healthcare@leadway.com')],
  },
  'Billing & Premium': {
    // Finance owns billing; the corporate relationship mailbox is copied
    // because it is already CC'd on every invoice reminder and payment
    // confirmation this client receives.
    to: env('SERVICE_DESK_TO_BILLING', 'healthfinance@leadway.com'),
    cc: [env('SERVICE_DESK_CC_BILLING', 'healthpartnerships@leadway.com')],
  },
};

/**
 * Recipients for one request. The HR raiser is always copied: SendEmailAlert
 * sends as the Prognosis service account and the payload has no Reply-To
 * field, so an agent pressing Reply answers the queue itself. CC is the only
 * thing that puts HR into the thread. Only the raiser is copied, never the
 * whole HR team — a case review can carry a named member's clinical detail.
 */
export function recipientsFor(category: string, hrEmail: string): { to: string; cc: string } {
  const box = MAILBOXES[category] ?? MAILBOXES['General Enquiries'];
  const cc = [...box.cc, hrEmail]
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a && a !== box.to.toLowerCase());
  // Comma-separated — the format Prognosis already accepts for CC on the
  // onboarding and invoice-reminder mails. EmailAddress must stay a single
  // address: a list there returns HTTP 200 with "fail: Invalid email address
  // format" in the body, which is how the backdate alerts were silently lost.
  return { to: box.to, cc: [...new Set(cc)].join(', ') };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Newlines to <br> after escaping, so HR's paragraphs survive. */
const escMultiline = (s: string) => esc(s).replace(/\r?\n/g, '<br />');

/** One file on its way to the queue, already validated by the caller. */
export interface RequestAttachment {
  fileName: string;
  contentType: string;
  base64Data: string;
  /** Original byte length, for the "2.1 MB" in the email body. */
  size: number;
}

export interface RequestEmailInput {
  route: RequestRoute;
  reference: string;
  companyName: string;
  groupId: string;
  hrName: string;
  hrEmail: string;
  requestSubject: string;
  details: string;
  submittedAt: Date;
  attachments?: RequestAttachment[];
}

export function renderRequestEmail(input: RequestEmailInput): string {
  const submitted = input.submittedAt.toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const who = input.hrName.trim() || input.hrEmail;

  return renderEmailTemplate({
    category: 'Service Desk',
    eyebrow: input.route.category,
    headline: esc(input.requestSubject),
    body:
      `<strong style="color:#131C4E;">${esc(input.companyName || 'A corporate client')}</strong> has raised a ` +
      `${esc(input.route.category.toLowerCase())} request through the Leadway Health Corporate Portal. ` +
      `The request is reproduced in full below.`,
    // The request text itself, called out so an agent reads it before the
    // reference table.
    highlight: input.details.trim()
      ? escMultiline(input.details.trim())
      : '<em style="color:#9CA3B8;">HR did not add any detail beyond the subject line above.</em>',
    details: [
      { label: 'Reference', value: `<span style="font-family:monospace;">${esc(input.reference)}</span>` },
      { label: 'Company', value: esc(input.companyName || '—') },
      { label: 'Group ID', value: esc(input.groupId || '—') },
      { label: 'Request type', value: esc(input.route.category) },
      { label: 'Raised by', value: esc(who) },
      // The address to answer on. SendEmailAlert has no Reply-To field, so
      // this row and the CC are what make a reply reach the right person.
      {
        label: 'Reply to',
        value: `<a href="mailto:${esc(input.hrEmail)}" style="color:#F56B22;text-decoration:none;">${esc(input.hrEmail)}</a>`,
      },
      { label: 'Submitted', value: esc(submitted) },
      // Listed in the body as well as being attached: a mail client that strips
      // or quarantines attachments otherwise leaves no trace that HR sent any,
      // and the agent has no way to know to ask for them.
      ...(input.attachments?.length
        ? [{
            label: input.attachments.length === 1 ? 'Attachment' : 'Attachments',
            value: input.attachments
              .map((a) => `${esc(a.fileName)} <span style="color:#9CA3B8;">(${esc(formatBytes(a.size))})</span>`)
              .join('<br />'),
          }]
        : []),
    ],
    footnote:
      `${esc(who)} is copied on this email — Reply All reaches them directly. ` +
      `Reference ${esc(input.reference)} is visible to them in the Corporate Portal, so quoting it keeps both sides on the same request.`,
  });
}

/**
 * Routes one request to its queue. Never throws: the request is already saved
 * in Postgres and visible to HR by the time this runs, so a mail failure must
 * not turn a successful submission into an error. Returns what happened so the
 * caller can log it and tell HR whether the team has been notified.
 */
export async function sendServiceRequestEmail(
  input: RequestEmailInput,
): Promise<{ sent: boolean; to: string; cc: string; error?: string }> {
  const { to, cc } = recipientsFor(input.route.category, input.hrEmail);
  const subject = buildSubject({
    subjectTag: input.route.subjectTag,
    companyName: input.companyName,
    reference: input.reference,
  });

  try {
    const token = await getServiceToken();
    const res = await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        EmailAddress: to,
        CC: cc,
        BCC: '',
        Subject: subject,
        MessageBody: renderRequestEmail(input),
        // Prognosis expects FileName / ContentType / Base64Data, and null
        // rather than [] when there is nothing to attach — that is the shape
        // every other working sender in this codebase uses.
        Attachments: input.attachments?.length
          ? input.attachments.map((a) => ({
              FileName: a.fileName,
              ContentType: a.contentType,
              Base64Data: a.base64Data,
            }))
          : null,
        Category: '',
        UserId: 0,
        ProviderId: 0,
        ServiceId: 0,
        Reference: input.reference,
        TransactionType: '',
      }),
    });
    const text = await res.text();
    // Prognosis reports a rejected address with HTTP 200 and "fail: ..." in
    // the body, so the status code alone is not enough to call this a success.
    if (!res.ok || /fail/i.test(text)) {
      const error = `HTTP ${res.status}: ${text.slice(0, 200)}`;
      console.error(`[service-request] Email FAILED → ${to} (cc: ${cc || 'none'}) — ${error}`);
      return { sent: false, to, cc, error };
    }
    const files = input.attachments?.length
      ? `, ${input.attachments.length} attachment(s): ${input.attachments.map((a) => a.fileName).join(', ')}`
      : '';
    console.log(`[service-request] ${input.reference} → ${to} (cc: ${cc || 'none'})${files}`);
    return { sent: true, to, cc };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[service-request] Email FAILED → ${to} (cc: ${cc || 'none'}) — ${error}`);
    return { sent: false, to, cc, error };
  }
}
