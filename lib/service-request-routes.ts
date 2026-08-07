// The five Service Desk queues HR can raise a request against.
//
// One table so the dropdown label, the API's validation, the ticket-table chip
// and the email subject tag can never drift apart. Deliberately free of
// imports and of the destination mailboxes: this module is imported by the
// Service Desk client page, so anything in here ships to the browser. Mailbox
// addresses and the email body live in lib/service-request-mail.ts, which is
// server-only.

export interface RequestRoute {
  /** Exact label shown in the dropdown and stored on the request. */
  category: string;
  /** Goes into the subject line after "Corporate Portal - ". */
  subjectTag: string;
  /** One-line hint under the dropdown so HR picks the right queue. */
  hint: string;
  /** Chip colours in the ticket table. */
  tint: string;
  text: string;
}

export const REQUEST_ROUTES: RequestRoute[] = [
  {
    category: 'General Enquiries',
    subjectTag: 'General Enquiries',
    hint: 'Cover confirmation, plan questions, hospital lists: anything the other four queues do not cover.',
    tint: '#F1F5F9', text: '#475569',
  },
  {
    category: 'Member Enrolment',
    subjectTag: 'Member Enrolment',
    hint: 'Adding, activating, correcting or removing a member or dependant.',
    tint: '#EFF6FF', text: '#2563EB',
  },
  {
    category: 'Member Refund',
    subjectTag: 'Member Refund',
    hint: 'Reimbursing a member for treatment or medication they paid for themselves.',
    tint: '#FFF7ED', text: '#C2410C',
  },
  {
    category: 'Medical Case Review',
    subjectTag: 'Case Review',
    hint: 'Clinical review of a case, pre-authorisation, a declined treatment or a second opinion.',
    tint: '#F5F3FF', text: '#7C3AED',
  },
  {
    category: 'Billing & Premium',
    subjectTag: 'Billing & Premium',
    hint: 'Invoices, debit notes, premium computation, payment allocation and receipts.',
    tint: '#FFFBEB', text: '#D97706',
  },
];

export const REQUEST_CATEGORIES = REQUEST_ROUTES.map((r) => r.category);

/** Used when a stored category predates this table, or HR submits nothing. */
export const FALLBACK_CATEGORY = 'General Enquiries';

export function routeFor(category: string): RequestRoute | undefined {
  return REQUEST_ROUTES.find((r) => r.category === category);
}

/**
 * "Corporate Portal - Member Refund - AFRICA TERMINALS LTD (REQ-0007)"
 *
 * Fixed prefix and queue tag first, so a receiving mailbox can build a filter
 * rule on it. Then the company, so an agent knows who is asking without
 * opening the mail. Then the reference, so replies stay threaded to a request
 * HR can look up in the portal. Same shape as the
 * "PAYMENT RECORDED - <ref> - <company>" alerts finance already receives.
 */
export function buildSubject(opts: { subjectTag: string; companyName: string; reference: string }): string {
  const company = opts.companyName.trim() || 'Corporate client';
  return `Corporate Portal - ${opts.subjectTag} - ${company} (${opts.reference})`;
}

/*  Attachments
   The limits live here so the form, the API and the error messages HR reads
   cannot drift apart: a client that allows what the server rejects produces a
   saved request with no email and no explanation.

   Caps are deliberately conservative. Every file is base64-encoded into the
   SendEmailAlert payload, which inflates it by a third, and neither Prognosis
   nor the mailboxes downstream publish a size limit. Refusing a 40MB scan up
   front is better than a request that saves and silently never arrives. */

export const MAX_ATTACHMENTS = 4;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_TOTAL_BYTES = 10 * 1024 * 1024;

/** Extension → MIME type sent to Prognosis. Also the allowlist. */
export const ATTACHMENT_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
  csv:  'text/csv',
  pdf:  'application/pdf',
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/msword',
};

export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES).map((e) => `.${e}`).join(',');

export function attachmentExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** MIME type for a filename, or '' when the extension is not allowed. */
export function attachmentContentType(fileName: string): string {
  return ATTACHMENT_TYPES[attachmentExtension(fileName)] ?? '';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/**
 * Why this file cannot be attached, or null when it can. Used by the form
 * before upload and by the API on the way through, so the two agree.
 */
export function attachmentError(file: { name: string; size: number }): string | null {
  if (!attachmentContentType(file.name)) {
    return `${file.name}: only ${Object.keys(ATTACHMENT_TYPES).join(', ')} files can be attached.`;
  }
  if (file.size <= 0) return `${file.name} is empty.`;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}: the limit is ${formatBytes(MAX_ATTACHMENT_BYTES)} per file.`;
  }
  return null;
}
