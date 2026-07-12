// Shared HTML shell for all outbound portal emails, so every email HR/members
// receive looks like one consistent product instead of each route inventing
// its own header/body/footer design.
import { emailFooter } from '@/lib/email-footer';

const APP_BASE = (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://corporateportal.onrender.com').replace(/\/$/, '');

export interface EmailDetailRow {
  label: string;
  value: string;
}

export interface EmailTemplateOptions {
  /** Small uppercase label at top-right of the header, e.g. "MEMBER SERVICES" */
  category: string;
  /** Small bold uppercase eyebrow above the headline, e.g. "ROUTINE UPDATE" */
  eyebrow: string;
  /** Main bold headline */
  headline: string;
  /** Body paragraph(s), already-escaped HTML */
  body: string;
  /** Optional highlighted callout box (personalized message, warnings, etc.) */
  highlight?: string;
  /** Optional key/value detail rows, rendered as a simple table */
  details?: EmailDetailRow[];
  /** Optional muted footnote below the details */
  footnote?: string;
}

export function renderEmailTemplate(opts: EmailTemplateOptions): string {
  const detailRows = (opts.details ?? []).map((row) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid #F0F1F5;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#9CA3B8;width:180px;vertical-align:top;">${row.label}</td>
          <td style="padding:10px 0;border-top:1px solid #F0F1F5;font-size:14px;font-weight:700;color:#131C4E;vertical-align:top;">${row.value}</td>
        </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

    <div style="padding:24px 32px;border-bottom:3px solid #F56B22;display:flex;align-items:center;justify-content:space-between;">
      <img src="${APP_BASE}/leadway-logo.jpeg" alt="Leadway Health" height="28" style="height:28px;object-fit:contain;display:block;" />
      <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3B8;">${opts.category}</span>
    </div>

    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#F56B22;">${opts.eyebrow}</p>
      <p style="margin:0 0 14px;font-size:21px;font-weight:800;color:#131C4E;line-height:1.3;">${opts.headline}</p>
      <p style="margin:0 0 20px;font-size:14px;color:#6B7280;line-height:1.65;">${opts.body}</p>

      ${opts.highlight ? `
      <div style="background:#FFF3E8;border-left:3px solid #F56B22;border-radius:8px;padding:18px 20px;margin:0 0 24px;">
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.7;">${opts.highlight}</p>
      </div>` : ''}

      ${detailRows ? `
      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:${opts.footnote ? '20px' : '4px'};">
        ${detailRows}
      </table>` : ''}

      ${opts.footnote ? `<p style="margin:0;font-size:12px;color:#9CA3B8;line-height:1.6;">${opts.footnote}</p>` : ''}
    </div>

${emailFooter()}
  </div>
</body>
</html>`;
}
