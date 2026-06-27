import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPrognosisToken, PROGNOSIS_BASE } from '@/lib/prognosis';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No company ID' }, { status: 400 });

  try {
    const token = await getPrognosisToken();
    const res = await fetch(
      `${PROGNOSIS_BASE}/api/Pharmacy/GetInvoiceReceiptHistory?groupid=${groupId}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    const data = await res.json();
    const list: Record<string, unknown>[] = Array.isArray(data?.result) ? data.result : [];
    const summary = list.length > 0 ? list[0] : null;
    return NextResponse.json({ summary: summary ?? {}, list });
  } catch (err) {
    console.error('[hr/invoice/history] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch invoice history' },
      { status: 500 }
    );
  }
}
