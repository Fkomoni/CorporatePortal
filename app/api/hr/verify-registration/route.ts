import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Username: process.env.PROGNOSIS_USERNAME,
      Password: process.env.PROGNOSIS_PASSWORD,
    }),
  });

  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch {
    throw new Error(`ApiUsers/Login returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token in ApiUsers/Login response');

  cachedToken = token;
  tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
  return token;
}

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

  try {
    let token = await getServiceToken();

    const callApi = async (t: string) =>
      fetch(`${BASE}/api/CorporateProfile/ClientAppVerifyRegistration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ verificationcode, password }),
      });

    let res = await callApi(token);

    // Refresh token once on 401/403
    if (res.status === 401 || res.status === 403) {
      console.log('[verify-registration] token rejected, refreshing...');
      cachedToken = null; tokenExpiry = 0;
      token = await getServiceToken();
      res = await callApi(token);
    }

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch {
      return NextResponse.json({ error: 'Prognosis returned non-JSON', raw: text.slice(0, 300) }, { status: 502 });
    }

    console.log(`[verify-registration] ClientAppVerifyRegistration → HTTP ${res.status}`, JSON.stringify(data).slice(0, 300));

    if (!res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return NextResponse.json(
        { error: d?.message ?? d?.Message ?? d?.ErrorMessage ?? `Prognosis error ${res.status}` },
        { status: res.status }
      );
    }

    // Prognosis registration confirmed — upsert HR user in our DB so they can log in.
    // If groupId/policyNumber weren't in the request (Prognosis invite links don't include them),
    // fall back to whatever was pre-registered by the admin when they sent the invite.
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      const resolvedGroupId      = groupId      ? String(groupId)      : existing?.companyId     ?? null;
      const resolvedPolicyNumber = policyNumber || existing?.policyNumber || null;
      const resolvedCompanyName  = companyName  || existing?.companyName  || null;
      const resolvedName         = name         || existing?.name         || email;

      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.upsert({
        where: { email },
        update: {
          password: passwordHash,
          name: resolvedName,
          companyId: resolvedGroupId,
          companyName: resolvedCompanyName,
          policyNumber: resolvedPolicyNumber,
          active: true,
        },
        create: {
          email,
          password: passwordHash,
          name: resolvedName,
          role: 'hr_admin',
          companyId: resolvedGroupId,
          companyName: resolvedCompanyName,
          policyNumber: resolvedPolicyNumber,
          active: true,
        },
      });
      console.log(`[verify-registration] Upserted HR user: ${email} (groupId: ${resolvedGroupId}, policyNumber: ${resolvedPolicyNumber}, company: ${resolvedCompanyName})`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[verify-registration] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
