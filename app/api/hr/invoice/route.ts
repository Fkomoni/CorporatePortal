import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPrognosisToken, PROGNOSIS_BASE } from '@/lib/prognosis';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No company ID on account' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'additions'; // additions | deletions | endorsement
  const fromDate = searchParams.get('fromDate') ?? '';
  const toDate = searchParams.get('toDate') ?? '';

  try {
    const token = await getPrognosisToken();
    let url: string;

    if (type === 'endorsement') {
      if (!fromDate || !toDate)
        return NextResponse.json({ error: 'fromDate and toDate required for endorsement' }, { status: 400 });
      url = `${PROGNOSIS_BASE}/api/Pharmacy/GetClientInvoice_Existing?GroupId=${groupId}&fromdate=${fromDate}&todate=${toDate}`;
    } else if (type === 'deletions') {
      url = `${PROGNOSIS_BASE}/api/Pharmacy/GetClientInvoice?GroupId=${groupId}&isneg=1`;
    } else {
      url = `${PROGNOSIS_BASE}/api/Pharmacy/GetClientInvoice?GroupId=${groupId}&isneg=0`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();
    const items: Record<string, unknown>[] = Array.isArray(data?.result)
      ? data.result
      : Array.isArray(data?.Result)
      ? data.Result
      : [];

    const premiumKeys = ['IndividualPremiumFees', 'ActualPremium', 'BasePremiumIndividual', 'PremiumAmount', 'Premium', 'premium', 'Production_Amount'];
    function getPremium(row: Record<string, unknown>): number {
      for (const k of premiumKeys) {
        const v = row[k];
        if (v == null) continue;
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
        if (!isNaN(n)) return n;
      }
      return 0;
    }

    let posTotal = 0;
    let negTotal = 0;
    for (const row of items) {
      const p = getPremium(row);
      if (p >= 0) posTotal += p;
      else negTotal += Math.abs(p);
    }

    return NextResponse.json({
      items,
      posTotal,
      negTotal,
      netTotal: posTotal - negTotal,
      count: items.length,
    });
  } catch (err) {
    console.error('[hr/invoice] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}
