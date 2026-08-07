// Shared footer for all outbound portal emails: the NHEA award banner, edge to
// edge, then a thin strip of legal/contact text.
//
// The banner already carries the Leadway Health logo, so the footer does not
// repeat it. Explicit width/height attributes are set because Outlook sizes
// from attributes rather than CSS, and because a client that blocks images by
// default then reserves the right space instead of collapsing the footer to a
// sliver. The copyright and address stay live text below the image, so nothing
// anyone needs depends on the image having loaded.
//
// Node-only module: imported exclusively from API routes and email senders
// (never from middleware/auth — OTP verification lives in login-otp-verify.ts
// precisely to keep this out of the Edge bundle).
const APP_BASE = (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://corporateportal.onrender.com').replace(/\/$/, '');

// public/email-award-banner.png is 757x252 (3.004:1). At the 600px card width
// that is 200px tall.
const BANNER_W = 600;
const BANNER_H = 200;

export function emailFooter(): string {
  return `
  <img src="${APP_BASE}/email-award-banner.png"
       alt="Leadway Health — Winner of the 2023, 2024, 2025 &amp; 2026 NHEA HMO of the Year Award"
       width="${BANNER_W}" height="${BANNER_H}"
       style="width:100%;max-width:${BANNER_W}px;height:auto;display:block;border:0;margin:0;" />
  <div style="background:#FAFBFC;padding:16px 32px;border-top:1px solid #E5E7F1;">
    <p style="font-size:11px;color:#B0B7C9;margin:0 0 4px;">© 2026 Leadway Health Limited &middot; <a href="mailto:healthcare@leadwayhealth.com" style="color:#9CA3B8;">healthcare@leadwayhealth.com</a></p>
    <p style="font-size:11px;color:#C4C9D9;margin:0;">121/123 Funsho Williams Avenue, Iponri, Surulere, Lagos</p>
  </div>`;
}
