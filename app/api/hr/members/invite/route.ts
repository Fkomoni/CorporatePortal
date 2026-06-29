import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: {
    email: string;
    employeeCode: string;
    schemeId: string;
    schemeName: string;
    scope?: string;
    inviteType?: 'principal' | 'dependent';
    parentCif?: string;
    maxDependents?: number;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    email, employeeCode, schemeId, schemeName,
    scope = 'self',
    inviteType = 'principal',
    parentCif,
    maxDependents = 1,
  } = body;

  if (!email || !employeeCode || !schemeId) {
    return NextResponse.json({ error: 'email, employeeCode and schemeId are required' }, { status: 400 });
  }
  if (inviteType === 'dependent' && !parentCif) {
    return NextResponse.json({ error: 'parentCif is required for dependent invitations' }, { status: 400 });
  }

  const groupId = session.user.companyId ?? '';

  // For dependent invites, don't block on "already enrolled" — a principal can get multiple dep links
  if (inviteType === 'principal') {
    const existing = await prisma.memberInvitation.findFirst({
      where: { email, employeeCode, groupId, inviteType: 'principal', used: false, expiresAt: { gt: new Date() } },
    });
    if (existing) {
      const base = process.env.NEXTAUTH_URL ?? 'https://corporateportal.onrender.com';
      return NextResponse.json({ token: existing.token, url: `${base}/enroll/${existing.token}`, reused: true });
    }
    const usedInvite = await prisma.memberInvitation.findFirst({
      where: { email, employeeCode, groupId, inviteType: 'principal', used: true },
    });
    if (usedInvite) {
      return NextResponse.json({ error: 'This staff member has already enrolled via an invitation link.' }, { status: 409 });
    }
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await prisma.memberInvitation.create({
    data: {
      email,
      employeeCode,
      schemeId,
      schemeName,
      groupId,
      scope,
      inviteType,
      parentCif: parentCif ?? null,
      maxDependents,
      expiresAt,
      createdBy: session.user.email ?? '',
    },
  });

  const base = process.env.NEXTAUTH_URL ?? 'https://corporateportal.onrender.com';
  const url = `${base}/enroll/${invitation.token}`;

  return NextResponse.json({ token: invitation.token, url, reused: false });
}
