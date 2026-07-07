// Shared footer for all outbound portal emails.
// Uses the NHEA award banner image when public/email-award-banner.png exists;
// otherwise renders an email-safe styled text version of the same message.
import fs from 'fs';
import path from 'path';

const APP_BASE = (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://corporateportal.onrender.com').replace(/\/$/, '');

let bannerExists: boolean | null = null;
function hasBanner(): boolean {
  if (bannerExists === null) {
    try { bannerExists = fs.existsSync(path.join(process.cwd(), 'public', 'email-award-banner.png')); }
    catch { bannerExists = false; }
  }
  return bannerExists;
}

export function emailFooter(): string {
  const award = hasBanner()
    ? `<img src="${APP_BASE}/email-award-banner.png" alt="Winner of the 2023, 2024, 2025 &amp; 2026 NHEA HMO of the Year Award — Unwavering commitment to excellence" width="600" style="display:block;width:100%;height:auto;border:0;" />`
    : `<div style="background:#FFF9F3;padding:22px 32px;text-align:left;">
    <p style="font-size:17px;font-weight:900;color:#F56B22;margin:0;line-height:1.35;">Winner of the 2023, 2024, 2025 &amp; 2026<br/>NHEA HMO of the Year Award.</p>
    <p style="font-size:11px;font-weight:700;color:#F56B22;letter-spacing:0.06em;margin:8px 0 0;text-transform:uppercase;">Unwavering commitment to excellence.</p>
  </div>`;

  return `
  <div style="border:1px solid #E5E7F1;border-top:none;overflow:hidden;">${award}</div>
  <div style="background:#FAFBFC;padding:14px 32px;border:1px solid #E5E7F1;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
    <p style="font-size:11px;color:#B0B7C9;margin:0">© 2026 Leadway Health HMO. All rights reserved.</p>
  </div>`;
}
