// Shared footer for all outbound portal emails.
// Uses the NHEA award banner image when public/email-award-banner.png exists;
// otherwise renders an email-safe styled text version of the same message.
//
// Node-only module: imported exclusively from API routes and email senders
// (never from middleware/auth — OTP verification lives in login-otp-verify.ts
// precisely to keep this out of the Edge bundle).
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
    : '';

  return `
  ${award ? `<div style="border:1px solid #E5E7F1;border-top:none;overflow:hidden;">${award}</div>` : ''}
  <div style="background:#FAFBFC;padding:20px 32px;border:1px solid #E5E7F1;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
    <img src="${APP_BASE}/leadway-logo.jpeg" alt="Leadway Health" height="20" style="height:20px;object-fit:contain;display:inline-block;margin-bottom:10px;" />
    <p style="font-size:11px;color:#B0B7C9;margin:0 0 4px;">© 2026 Leadway Health Limited &middot; <a href="mailto:healthcare@leadwayhealth.com" style="color:#9CA3B8;">healthcare@leadwayhealth.com</a></p>
    <p style="font-size:11px;color:#C4C9D9;margin:0;">121/123 Funsho Williams Avenue, Iponri, Surulere, Lagos</p>
  </div>`;
}
