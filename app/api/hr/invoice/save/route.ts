import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPrognosisToken, PROGNOSIS_BASE } from '@/lib/prognosis';

function generateReceiptNumber(groupId: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `LWH-INV-${groupId}-${dateStr}-${rand}`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No company ID' }, { status: 400 });

  const body = await request.json();
  const receiptNumber = generateReceiptNumber(groupId);
  const now = new Date().toISOString();

  try {
    const token = await getPrognosisToken();
    const payload = {
      GroupId: Number(groupId),
      ReceiptNumber: receiptNumber,
      DatePaid: now,
      AmountPaid: 0,
      TotalAmount: body.totalAmount ?? 0,
      nextdueamount: body.nextDueAmount ?? body.totalAmount ?? 0,
      NextDue: body.nextDue ?? '',
      frequency: body.frequency ?? 'Monthly',
      schemes: body.schemes ?? '',
      positivePremium: String(body.posTotal ?? 0),
      NegativePremium: String(body.negTotal ?? 0),
      PositivePop: body.positivePop ?? '',
      NegativePop: body.negativePop ?? '',
    };

    const res = await fetch(`${PROGNOSIS_BASE}/api/InvoiceReceipt/InsertInvoiceReceiptHistory`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || data?.result?.Success === false) {
      return NextResponse.json(
        {
          error: data?.result?.Message ?? 'Failed to save invoice',
          existingReceiptNumber: data?.result?.ExistingReceiptNumber,
          outstandingBalance: data?.result?.OutstandingBalance,
        },
        { status: res.status === 400 ? 400 : 500 }
      );
    }

    return NextResponse.json({ success: true, receiptNumber, data });
  } catch (err) {
    console.error('[hr/invoice/save] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save invoice' },
      { status: 500 }
    );
  }
}
