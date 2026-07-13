// Shared footer for all outbound portal emails — styled as a compact email
// signature block (small logo + a couple of text lines) rather than a
// full-width banner image, which many email clients block by default and
// which then renders as an oversized broken-image placeholder with alt text
// spilling across the message.
//
// Node-only module: imported exclusively from API routes and email senders
// (never from middleware/auth — OTP verification lives in login-otp-verify.ts
// precisely to keep this out of the Edge bundle).
const APP_BASE = (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://corporateportal.onrender.com').replace(/\/$/, '');

export function emailFooter(): string {
  return `
  <div style="background:#FAFBFC;padding:20px 32px;border:1px solid #E5E7F1;border-top:none;border-radius:0 0 12px 12px;">
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="vertical-align:middle;width:40px;padding-right:12px;">
          <img src="${APP_BASE}/leadway-logo.jpeg" alt="Leadway Health" width="32" height="32" style="width:32px;height:32px;object-fit:contain;display:block;border-radius:6px;" />
        </td>
        <td style="vertical-align:middle;">
          <p style="font-size:12px;font-weight:700;color:#131C4E;margin:0 0 2px;">Leadway Health</p>
          <p style="font-size:11px;color:#9CA3B8;margin:0;">Winner &middot; 2023–2026 NHEA HMO of the Year</p>
        </td>
      </tr>
    </table>
    <div style="height:1px;background:#E5E7F1;margin:14px 0;"></div>
    <p style="font-size:11px;color:#B0B7C9;margin:0 0 4px;">© 2026 Leadway Health Limited &middot; <a href="mailto:healthcare@leadwayhealth.com" style="color:#9CA3B8;">healthcare@leadwayhealth.com</a></p>
    <p style="font-size:11px;color:#C4C9D9;margin:0;">121/123 Funsho Williams Avenue, Iponri, Surulere, Lagos</p>
  </div>`;
}
