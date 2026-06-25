import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prognosisToken = (session.user as { prognosisToken?: string })?.prognosisToken;
  if (!prognosisToken) {
    return NextResponse.json({ error: 'No Prognosis session token found' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { groupid, CurrentPassword, NewPassword, ConfirmPassword } = body;

  if (!CurrentPassword || !NewPassword || !ConfirmPassword) {
    return NextResponse.json({ error: 'All password fields are required' }, { status: 400 });
  }

  if (NewPassword !== ConfirmPassword) {
    return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/api/CorporateProfile/ClientApp_ChangePassword`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${prognosisToken}`,
      },
      body: JSON.stringify({ groupid: groupid ?? 0, CurrentPassword, NewPassword, ConfirmPassword }),
    });

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch {
      return NextResponse.json({ error: 'Prognosis returned non-JSON' }, { status: 502 });
    }

    console.log(`[change-password] ClientApp_ChangePassword → HTTP ${res.status}`, JSON.stringify(data).slice(0, 300));

    if (!res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return NextResponse.json(
        { error: d?.message ?? d?.Message ?? d?.ErrorMessage ?? `Prognosis error ${res.status}` },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[change-password] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Password change failed' },
      { status: 500 }
    );
  }
}
