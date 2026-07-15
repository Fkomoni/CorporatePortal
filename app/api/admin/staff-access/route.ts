// Manages which client companies a Leadway staff email may act as HR for
// (StaffClientAccess) — Prognosis has no equivalent endpoint, so we own this
// mapping entirely. Staff-only (loginType 'staff' is no longer issued, but
// this predates that — gate on isInternalStaff being false, i.e. a real
// Leadway staff console session, not an internal-admin-as-HR session).
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function requireStaffSession() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (session.user.loginType !== 'staff') {
    return { error: NextResponse.json({ error: 'Forbidden: Leadway staff console only' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const { error } = await requireStaffSession();
  if (error) return error;

  const rows = await prisma.staffClientAccess.findMany({ orderBy: [{ staffEmail: 'asc' }, { companyName: 'asc' }] });
  return NextResponse.json({ access: rows });
}

export async function POST(req: Request) {
  const { error } = await requireStaffSession();
  if (error) return error;

  let body: { staffEmail?: string; companyId?: string; companyName?: string; policyNumber?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const staffEmail = (body.staffEmail ?? '').trim().toLowerCase();
  const companyId = (body.companyId ?? '').trim();
  if (!staffEmail || !companyId) {
    return NextResponse.json({ error: 'Staff email and company are required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@leadway\.com$/i.test(staffEmail)) {
    return NextResponse.json({ error: 'Only Leadway email addresses can be granted internal admin access.' }, { status: 400 });
  }

  try {
    // Upsert a placeholder StaffUser row so the FK is satisfied — real
    // name/role get filled in from Prognosis on their first login.
    await prisma.staffUser.upsert({
      where: { email: staffEmail },
      update: {},
      create: { email: staffEmail, name: staffEmail },
    });

    const access = await prisma.staffClientAccess.upsert({
      where: { staffEmail_companyId: { staffEmail, companyId } },
      update: { companyName: body.companyName || undefined, policyNumber: body.policyNumber || undefined },
      create: {
        staffEmail, companyId,
        companyName: body.companyName || null,
        policyNumber: body.policyNumber || null,
      },
    });

    return NextResponse.json({ success: true, access });
  } catch (err) {
    console.error('[admin/staff-access] Error:', err);
    return NextResponse.json({ error: 'Failed to grant access.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { error } = await requireStaffSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    await prisma.staffClientAccess.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/staff-access] Delete error:', err);
    return NextResponse.json({ error: 'Failed to remove access.' }, { status: 500 });
  }
}
