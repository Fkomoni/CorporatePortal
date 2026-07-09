import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/roles';
import { rejectEnrollee } from '@/lib/approve-enrollee';
import { getServiceToken } from '@/lib/corporate-welcome';
import { emailFooter } from '@/lib/email-footer';
import { logAudit } from '@/lib/audit';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  let body: { parentCif?: string | number; principalName?: string; reason?: string; email?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parentCif = String(body.parentCif ?? '').trim();
  const reason = (body.reason ?? '').trim();
  if (!parentCif) return NextResponse.json({ error: 'parentCif is required' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: 'A reason for declining is required.' }, { status: 400 });

  const result = await rejectEnrollee(parentCif);

  void logAudit({
    session, request: req, resource: 'members',
    action: result.success ? 'REJECT_PENDING_ENROLEE' : 'REJECT_PENDING_ENROLEE_FAILED',
    details: { parentCif, principalName: body.principalName, reason, recordsUpdated: result.recordsUpdated, error: result.error },
  });

  if (!result.success) return NextResponse.json({ error: result.error ?? 'Rejection failed' }, { status: 422 });

  // Best-effort notification to the applicant — never blocks the rejection itself
  if (body.email) {
    try {
      const svcToken = await getServiceToken();
      const emailBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#131C4E;padding:24px 32px;border-radius:12px 12px 0 0;">
    <p style="font-size:22px;font-weight:900;color:#fff;margin:0;letter-spacing:-0.02em">LEADWAY <span style="color:#F56B22;">HEALTH</span></p>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:2px 0 0;letter-spacing:0.1em">CORPORATE PORTAL</p>
  </div>
  <div style="background:#fff;padding:36px 32px;border:1px solid #E5E7F1;border-top:none;">
    <p style="font-size:20px;font-weight:700;color:#131C4E;margin:0 0 8px">Registration Not Approved</p>
    <p style="font-size:14px;color:#6B7280;line-height:1.6;margin:0 0 20px">
      Your recent registration${body.principalName ? ` for ${body.principalName}` : ''} could not be approved by your HR department.
    </p>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:16px 18px;margin:0 0 24px">
      <p style="font-size:11px;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 6px">Reason</p>
      <p style="font-size:13px;color:#7F1D1D;margin:0;line-height:1.6">${reason}</p>
    </div>
    <p style="font-size:12px;color:#9CA3B8;margin:0;line-height:1.7">
      If you believe this was in error, please contact your HR department directly.
    </p>
  </div>
${emailFooter()}
</div>`.trim();

      await fetch(`${BASE}/api/EnrolleeProfile/SendEmailAlert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${svcToken}` },
        body: JSON.stringify({
          EmailAddress: body.email, CC: '', BCC: '',
          Subject: 'Update on Your Corporate Portal Registration',
          MessageBody: emailBody, Attachments: null, Category: '',
          UserId: 0, ProviderId: 0, ServiceId: 0, Reference: '', TransactionType: '',
        }),
      });
    } catch (e) {
      console.warn('[pending/reject] Applicant notification email failed:', e);
    }
  }

  return NextResponse.json({ success: true, message: result.message, recordsUpdated: result.recordsUpdated });
}
