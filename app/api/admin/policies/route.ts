import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePolicy(p: Record<string, any>) {
  const name = String(p.GroupName ?? p.CompanyName ?? p.Name ?? p.name ?? 'Unknown');
  const groupId = String(p.GroupID ?? p.PolicyID ?? p.Id ?? p.id ?? '');

  const rawDate = p.CommencementDate ?? p.StartDate ?? p.DateCreated ?? p.CreatedDate ?? p.InceptionDate ?? '';
  const dateProvisioned = rawDate ? String(rawDate).split('T')[0] : '';

  const adminEmail = String(p.Email ?? p.AdminEmail ?? p.ContactEmail ?? p.HREmail ?? p.EmailAddress ?? '');

  let status = 'Active';
  if (p.Active === false || p.IsActive === false) {
    status = 'Inactive';
  } else if (typeof p.Status === 'string') {
    const s = p.Status.toLowerCase();
    if (s === 'inactive' || s === 'terminated' || s === 'expired') status = 'Inactive';
    else if (s === 'pending' || s === 'awaiting') status = 'Pending';
    else status = p.Status;
  }

  const activeMembers = Number(
    p.ActiveLives ?? p.TotalActiveLives ?? p.ActiveMembers ??
    p.MemberCount ?? p.TotalEnrolled ?? p.NoOfLives ?? 0
  );

  const schemeCode = String(p.PolicyNumber ?? p.SchemeCode ?? p.PolicyCode ?? groupId);

  return {
    id: groupId || name,
    groupId,
    name,
    schemeCode,
    dateProvisioned,
    adminEmail,
    status,
    activeMembers,
    template: 'Default template',
    colors: ['#F56B22', '#131C4E', '#3B82F6'],
  };
}

export async function GET() {
  const session = await auth();
  const prognosisToken = (session?.user as { prognosisToken?: string })?.prognosisToken;

  if (!session || (session.user as { loginType?: string })?.loginType !== 'staff' || !prognosisToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${BASE}/api/CorporateProfile/GetAllPolicies`, {
      headers: {
        Authorization: `Bearer ${prognosisToken}`,
        Accept: 'application/json',
      },
    });

    console.log(`[api/policies] GET ${BASE}/api/CorporateProfile/GetAllPolicies → HTTP ${res.status}`);

    if (!res.ok) {
      return NextResponse.json({ error: `Prognosis error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    // Unwrap from various possible envelope shapes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: Record<string, any>[] =
      Array.isArray(data) ? data :
      Array.isArray(data?.data) ? data.data :
      Array.isArray(data?.Data) ? data.Data :
      Array.isArray(data?.result) ? data.result :
      Array.isArray(data?.Result) ? data.Result :
      [];

    const policies = raw.map(normalizePolicy);
    console.log(`[api/policies] normalized ${policies.length} policies`);

    return NextResponse.json({ policies, total: policies.length });
  } catch (err) {
    console.error('[api/policies] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch policies' }, { status: 500 });
  }
}
