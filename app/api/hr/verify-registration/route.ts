// Confirms the registration OTP (issued by /api/hr/request-registration-otp,
// generated and verified entirely by us) and sets the local password hash.
// Prognosis is not called here at all — email authorisation already happened
// when the OTP was requested (Company_Email1 check), and Prognosis's own
// ClientAppVerifyRegistration turned out to be an unreliable gate for this
// (fails with "Insured Client is not valid" for contacts it doesn't
// separately recognise, even when Company_Email1 is correct).
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { verifyLoginOtp } from '@/lib/login-otp';

export async function POST(req: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // groupId = Prognosis GROUP_ID (numeric); policyNumber = PolicyNumber / GROUP_CODE
  const { verificationcode, password, email, groupId, companyName, name, policyNumber } = body;

  if (!verificationcode || !password) {
    return NextResponse.json({ error: 'Verification code and password are required' }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Leadway password complexity policy
  if (password.length < 8)              return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
  if (!/[A-Z]/.test(password))          return NextResponse.json({ error: 'Password must include at least one uppercase letter (A–Z).' }, { status: 400 });
  if (!/[a-z]/.test(password))          return NextResponse.json({ error: 'Password must include at least one lowercase letter (a–z).' }, { status: 400 });
  if (!/[0-9]/.test(password))          return NextResponse.json({ error: 'Password must include at least one number (0–9).' }, { status: 400 });
  if (!/[^A-Za-z0-9]/.test(password))  return NextResponse.json({ error: 'Password must include at least one special character.' }, { status: 400 });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) return NextResponse.json({ error: 'No pending registration found for this email. Please request a new registration link.' }, { status: 404 });

    const check = await verifyLoginOtp(existing.id, String(verificationcode).trim());
    if (check === 'locked')  return NextResponse.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 });
    if (check === 'expired') return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 });
    if (check !== 'ok')      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });

    const resolvedGroupId      = groupId      ? String(groupId)      : existing.companyId     ?? null;
    const resolvedPolicyNumber = policyNumber || existing.policyNumber || null;
    const resolvedCompanyName  = companyName  || existing.companyName  || null;
    const resolvedName         = name         || existing.name         || email;

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: {
        password: passwordHash,
        name: resolvedName,
        companyId: resolvedGroupId,
        companyName: resolvedCompanyName,
        policyNumber: resolvedPolicyNumber,
        active: true,
      },
    });
    console.log(`[verify-registration] Activated HR user: ${email} (groupId: ${resolvedGroupId}, policyNumber: ${resolvedPolicyNumber}, company: ${resolvedCompanyName})`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[verify-registration] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
