import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPrognosisToken, PROGNOSIS_BASE } from '@/lib/prognosis';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No company ID' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get('fromDate') ?? '';
  const toDate = searchParams.get('toDate') ?? '';

  try {
    const token = await getPrognosisToken();
    const url = fromDate && toDate
      ? `${PROGNOSIS_BASE}/api/Pharmacy/GetClienInvoiceSchedule_existing?GroupId=${groupId}&fromdate=${fromDate}&todate=${toDate}`
      : `${PROGNOSIS_BASE}/api/Pharmacy/GetClienInvoiceSchedule?GroupId=${groupId}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();
    const items = Array.isArray(data?.result) ? data.result : [];
    return NextResponse.json({ items });
  } catch (err) {
    console.error('[hr/invoice/schedule] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}
