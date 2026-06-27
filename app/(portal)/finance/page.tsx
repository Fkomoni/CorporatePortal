'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, AlertTriangle, CheckCircle2, Clock, ArrowDownToLine,
  Loader2, CalendarDays, RotateCcw, TrendingUp, TrendingDown, Activity,
  ChevronRight, Info, Circle,
} from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';

// ── Types ────────────────────────────────────────────────────────────────────
interface InvoiceHistory {
  HasOutstanding?: number;
  TotalAmount?: number | null;
  AmountPaid?: number | null;
  OutstandingBalance?: number | null;
  NextDue?: string | null;
  NextDueAmount?: number | null;
  Frequency?: string | null;
  ReceiptNumber?: string | null;
}

type InvoiceRow = Record<string, unknown>;

interface InvoiceData {
  items: InvoiceRow[];
  posTotal: number;
  negTotal: number;
  netTotal: number;
  count: number;
}

type InvoiceType = 'additions' | 'deletions' | 'endorsement';
type Tab = 'overview' | 'generate' | 'schedule';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) =>
  n != null ? `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const PREMIUM_KEYS = ['IndividualPremiumFees', 'ActualPremium', 'BasePremiumIndividual', 'PremiumAmount', 'Premium', 'premium', 'Production_Amount'];
const NAME_KEYS = ['Member_CustomerName', 'EnrolleeName', 'Enrollee_Name', 'FullName', 'Full_Name', 'MemberName', 'PatientName'];
const ID_KEYS = ['Member_EnrolleeID', 'MemberShipNo', 'MembershipNo', 'EnrolleeID', 'MemberCifNo', 'CifNo', 'MemberID'];
const PLAN_KEYS = ['Member_Plan', 'Product_SchemeType', 'PlanName', 'Plan', 'BenefitPlan', 'PackageName', 'SchemeName'];
const TYPE_KEYS = ['Member_Relationship', 'MemberType', 'EnrolleeType', 'Relationship'];
const DATE_KEYS = ['Member_Effectivedate', 'MemberOriginalStartdate', 'Fromdate', 'StartDate', 'EnrollmentDate'];

function getStr(row: InvoiceRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '—';
}

function getNum(row: InvoiceRow, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
    if (!isNaN(n)) return n;
  }
  return 0;
}

function downloadCSV(items: InvoiceRow[], invoiceType: InvoiceType, receiptNo: string) {
  const headers = ['Enrollee ID', 'Member Name', 'Plan', 'Type', 'Effective Date', 'Premium (₦)'];
  const rows = items.map((r) => [
    getStr(r, ...ID_KEYS),
    getStr(r, ...NAME_KEYS),
    getStr(r, ...PLAN_KEYS),
    getStr(r, ...TYPE_KEYS),
    getStr(r, ...DATE_KEYS),
    getNum(r, ...PREMIUM_KEYS).toFixed(2),
  ]);
  const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${receiptNo || 'invoice'}-${invoiceType}.csv`;
  a.click();
}

function printInvoice() {
  window.print();
}

// ── Invoice type config ───────────────────────────────────────────────────────
const INVOICE_TYPES: { id: InvoiceType; label: string; desc: string; color: string; icon: React.ReactNode }[] = [
  {
    id: 'additions',
    label: 'Additions',
    desc: 'New members or re-enrolled lives added to the scheme',
    color: '#059669',
    icon: <TrendingUp style={{ width: 20, height: 20 }} />,
  },
  {
    id: 'deletions',
    label: 'Deletions',
    desc: 'Members removed or terminated from the scheme',
    color: '#DC2626',
    icon: <TrendingDown style={{ width: 20, height: 20 }} />,
  },
  {
    id: 'endorsement',
    label: 'Endorsement',
    desc: 'Mid-cycle adjustments between two specific dates',
    color: '#7C3AED',
    icon: <Activity style={{ width: 20, height: 20 }} />,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('additions');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [history, setHistory] = useState<InvoiceHistory | null>(null);
  const [historyList, setHistoryList] = useState<InvoiceRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');

  const [schedule, setSchedule] = useState<InvoiceRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedReceipt, setSavedReceipt] = useState('');
  const [saveError, setSaveError] = useState('');

  const tableRef = useRef<HTMLDivElement>(null);

  // Load invoice history on mount
  useEffect(() => {
    fetch('/api/hr/invoice/history')
      .then((r) => r.json())
      .then((d) => {
        setHistory(d.summary ?? d);
        setHistoryList(d.list ?? []);
      })
      .catch(() => { setHistory(null); setHistoryList([]); })
      .finally(() => setHistoryLoading(false));
  }, []);

  // Load schedule when tab changes
  useEffect(() => {
    if (tab !== 'schedule') return;
    setScheduleLoading(true);
    fetch('/api/hr/invoice/schedule')
      .then((r) => r.json())
      .then((d) => setSchedule(d.items ?? []))
      .catch(() => setSchedule([]))
      .finally(() => setScheduleLoading(false));
  }, [tab]);

  const loadInvoice = useCallback(async () => {
    setInvoiceLoading(true);
    setInvoiceError('');
    setInvoiceData(null);
    setSavedReceipt('');
    setSaveError('');
    try {
      const params = new URLSearchParams({ type: invoiceType });
      if (invoiceType === 'endorsement') {
        if (!fromDate || !toDate) { setInvoiceError('Please select both From and To dates.'); setInvoiceLoading(false); return; }
        params.set('fromDate', fromDate);
        params.set('toDate', toDate);
      }
      const res = await fetch(`/api/hr/invoice?${params}`);
      const data = await res.json();
      if (!res.ok) { setInvoiceError(data.error ?? 'Failed to load invoice'); return; }
      setInvoiceData(data);
      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setInvoiceError('Network error. Please try again.');
    } finally {
      setInvoiceLoading(false);
    }
  }, [invoiceType, fromDate, toDate]);

  const saveInvoice = async () => {
    if (!invoiceData) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/hr/invoice/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: invoiceData.netTotal,
          posTotal: invoiceData.posTotal,
          negTotal: invoiceData.negTotal,
          nextDueAmount: invoiceData.netTotal,
          frequency: history?.Frequency ?? 'Monthly',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(
          data.outstandingBalance
            ? `Outstanding balance of ${fmt(data.outstandingBalance)} on receipt ${data.existingReceiptNumber}. Please clear before generating a new invoice.`
            : data.error ?? 'Failed to save invoice'
        );
        return;
      }
      setSavedReceipt(data.receiptNumber);
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasOutstanding = (history?.HasOutstanding ?? 0) === 1;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #invoice-print-area { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
        }
        #invoice-print-area { display: none; }
      `}</style>

      <TopBar title="Finance" subtitle="Generate Invoices · Payment Schedule · Balance Overview" />

      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Outstanding balance banner */}
        {!historyLoading && hasOutstanding && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px', borderRadius: 14, background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <AlertTriangle style={{ width: 18, height: 18, color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 3 }}>Outstanding Balance</p>
              <p style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.6 }}>
                You have an outstanding balance of <strong>{fmt(history?.OutstandingBalance)}</strong> on receipt <strong>{history?.ReceiptNumber}</strong>.
                Next due: <strong>{fmtDate(history?.NextDue)}</strong>. Please clear this before generating a new invoice.
              </p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        {!historyLoading && history && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Total Invoiced', value: fmt(history.TotalAmount), sub: 'Current invoice total', color: '#131C4E' },
              { label: 'Amount Paid', value: fmt(history.AmountPaid), sub: 'Received so far', color: '#059669' },
              { label: 'Outstanding', value: fmt(history.OutstandingBalance), sub: history.OutstandingBalance ? 'Due now' : 'All clear', color: history.OutstandingBalance ? '#DC2626' : '#059669' },
              { label: 'Next Due', value: fmtDate(history.NextDue), sub: history.Frequency ?? 'Monthly billing', color: '#7C3AED' },
            ].map((c) => (
              <div key={c.label} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', borderLeft: `3px solid ${c.color}`, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: '#131C4E', lineHeight: 1, marginBottom: 8 }}>{c.value}</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#131C4E', marginBottom: 2 }}>{c.label}</p>
                <p style={{ fontSize: 11, color: '#9CA3B8' }}>{c.sub}</p>
              </div>
            ))}
          </div>
        )}

        {historyLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[0,1,2,3].map((i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '20px 22px', height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 style={{ width: 20, height: 20, color: '#D1D5DB', animation: 'spin 1s linear infinite' }} />
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 4, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 'fit-content' }}>
          {(['overview', 'generate', 'schedule'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: tab === t ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : 'transparent',
                color: tab === t ? '#fff' : '#6B7280',
                boxShadow: tab === t ? '0 2px 8px rgba(245,107,34,0.28)' : 'none',
              }}>
              {t === 'overview' ? 'Overview' : t === 'generate' ? 'Generate Invoice' : 'Schedule'}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Payment timeline */}
            {history && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '26px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#131C4E', marginBottom: 4 }}>Payment Status</p>
                <p style={{ fontSize: 11, color: '#9CA3B8', marginBottom: 24 }}>{history.ReceiptNumber ?? 'No active invoice'} · {history.Frequency ?? 'Monthly'} billing</p>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {[
                    { label: 'Invoice Generated', done: !!history.TotalAmount },
                    { label: 'Invoice Sent', done: !!history.TotalAmount },
                    { label: 'Payment Received', done: (history.AmountPaid ?? 0) >= (history.TotalAmount ?? 1), current: (history.AmountPaid ?? 0) > 0 && (history.AmountPaid ?? 0) < (history.TotalAmount ?? 1) },
                    { label: 'Receipt Issued', done: (history.AmountPaid ?? 0) >= (history.TotalAmount ?? 1) },
                  ].map((step, i, arr) => (
                    <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: step.done ? '#ECFDF5' : step.current ? '#FFF1E6' : '#F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {step.done
                            ? <CheckCircle2 style={{ width: 16, height: 16, color: '#059669' }} />
                            : step.current
                            ? <Clock style={{ width: 16, height: 16, color: '#F56B22' }} />
                            : <Circle style={{ width: 16, height: 16, color: '#9CA3B8' }} />}
                        </div>
                        <p style={{ fontSize: 10, fontWeight: 600, marginTop: 8, textAlign: 'center', color: step.done ? '#059669' : step.current ? '#F56B22' : '#9CA3B8', whiteSpace: 'nowrap' }}>{step.label}</p>
                      </div>
                      {i < arr.length - 1 && <div style={{ flex: 1, height: 2, margin: '0 8px', marginBottom: 18, background: step.done ? '#10B981' : '#E5E7F1' }} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Past invoices list */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 28px', borderBottom: '1px solid #F0F1F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#131C4E' }}>Invoice History</p>
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 3 }}>All invoices raised for your company</p>
                </div>
                <button onClick={() => setTab('generate')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(245,107,34,0.22)', whiteSpace: 'nowrap' }}>
                  + New Invoice
                </button>
              </div>

              {historyLoading ? (
                <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
                  <Loader2 style={{ width: 24, height: 24, color: '#F56B22', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : historyList.length === 0 ? (
                <div style={{ padding: '56px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText style={{ width: 20, height: 20, color: '#9CA3B8' }} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>No invoices found</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8' }}>No invoice history has been recorded for your company yet.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                        {['Receipt No.', 'Date Raised', 'Total Amount', 'Amount Paid', 'Outstanding', 'Next Due', 'Status'].map((h) => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historyList.map((row, i) => {
                        const receipt = String(row.ReceiptNumber ?? row.receiptnumber ?? '—');
                        const created = String(row.createddate ?? row.DatePaid ?? row.datepaid ?? '');
                        const total = Number(row.TotalAmount ?? row.totalamount ?? 0);
                        const paid = Number(row.AmountPaid ?? row.amountpaid ?? 0);
                        const outstanding = Number(row.OutstandingBalance ?? row.OutstandingBalance ?? (total - paid));
                        const nextDue = String(row.NextDue ?? row.nextdue ?? '');
                        const isPaid = outstanding <= 0;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #F7F8FA' }}>
                            <td style={{ padding: '13px 16px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#131C4E' }}>{receipt}</td>
                            <td style={{ padding: '13px 16px', color: '#6B7280', whiteSpace: 'nowrap' }}>{created ? new Date(created).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                            <td style={{ padding: '13px 16px', fontWeight: 700, color: '#131C4E' }}>{fmt(total)}</td>
                            <td style={{ padding: '13px 16px', color: '#059669', fontWeight: 600 }}>{fmt(paid)}</td>
                            <td style={{ padding: '13px 16px', color: outstanding > 0 ? '#DC2626' : '#059669', fontWeight: 600 }}>{outstanding > 0 ? fmt(outstanding) : 'Nil'}</td>
                            <td style={{ padding: '13px 16px', color: '#6B7280', whiteSpace: 'nowrap' }}>{nextDue ? new Date(nextDue).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                            <td style={{ padding: '13px 16px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: isPaid ? '#ECFDF5' : '#FEF2F2', color: isPaid ? '#059669' : '#DC2626' }}>
                                {isPaid ? 'Paid' : 'Outstanding'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GENERATE INVOICE TAB ──────────────────────────────────────────── */}
        {tab === 'generate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Type selector */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 16 }}>Step 1 — Select Invoice Type</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {INVOICE_TYPES.map((t) => (
                  <button key={t.id} onClick={() => { setInvoiceType(t.id); setInvoiceData(null); setSavedReceipt(''); setSaveError(''); }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
                      padding: '16px 18px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      border: invoiceType === t.id ? `2px solid ${t.color}` : '1.5px solid #E5E7F1',
                      background: invoiceType === t.id ? `${t.color}0D` : '#FAFBFC',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color }}>
                      {t.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>{t.label}</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2, lineHeight: 1.5 }}>{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Date range for endorsement */}
              {invoiceType === 'endorsement' && (
                <div style={{ display: 'flex', gap: 12, marginTop: 20, padding: '16px 18px', borderRadius: 12, background: '#F3F0FF', border: '1px solid #DDD6FE' }}>
                  <CalendarDays style={{ width: 16, height: 16, color: '#7C3AED', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ display: 'flex', gap: 16, flex: 1, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em' }}>From Date</label>
                      <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                        style={{ height: 36, padding: '0 12px', fontSize: 13, border: '1.5px solid #DDD6FE', borderRadius: 8, background: '#fff', color: '#131C4E', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em' }}>To Date</label>
                      <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                        style={{ height: 36, padding: '0 12px', fontSize: 13, border: '1.5px solid #DDD6FE', borderRadius: 8, background: '#fff', color: '#131C4E', outline: 'none' }} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                <button onClick={loadInvoice} disabled={invoiceLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 28px', borderRadius: 10, border: 'none', background: invoiceLoading ? '#E5E7F1' : 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: invoiceLoading ? '#9CA3B8' : '#fff', fontSize: 13, fontWeight: 700, cursor: invoiceLoading ? 'not-allowed' : 'pointer', boxShadow: invoiceLoading ? 'none' : '0 2px 8px rgba(245,107,34,0.28)', transition: 'all 0.15s' }}>
                  {invoiceLoading
                    ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Loading Invoice...</>
                    : <><FileText style={{ width: 14, height: 14 }} /> Load Invoice</>}
                </button>
              </div>

              {invoiceError && (
                <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13 }}>
                  {invoiceError}
                </div>
              )}
            </div>

            {/* Line items table */}
            {invoiceData && invoiceData.count === 0 && (
              <div ref={tableRef} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '60px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF5EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText style={{ width: 20, height: 20, color: '#F56B22' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>No records found</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', textAlign: 'center', maxWidth: 340 }}>
                  No {invoiceType === 'additions' ? 'additions' : invoiceType === 'deletions' ? 'deletions' : 'endorsement records'} were found for your company in the current period. If you believe this is incorrect, please contact Leadway Health.
                </p>
              </div>
            )}
            {invoiceData && invoiceData.count > 0 && (
              <div ref={tableRef} id="invoice-print-area" style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                {/* Table header */}
                <div style={{ padding: '20px 28px', borderBottom: '1px solid #F0F1F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#131C4E' }}>
                      {invoiceType === 'additions' ? 'Addition Invoice' : invoiceType === 'deletions' ? 'Deletion Invoice' : 'Endorsement Invoice'}
                    </p>
                    <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 3 }}>{invoiceData.count} member{invoiceData.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => downloadCSV(invoiceData.items, invoiceType, savedReceipt)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1.5px solid #E5E7F1', background: '#FAFBFC', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <ArrowDownToLine style={{ width: 12, height: 12 }} /> Excel / CSV
                    </button>
                    <button onClick={printInvoice}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1.5px solid #E5E7F1', background: '#FAFBFC', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <ArrowDownToLine style={{ width: 12, height: 12 }} /> PDF
                    </button>
                  </div>
                </div>

                {/* Line items */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                        {['#', 'Enrollee ID', 'Member Name', 'Plan', 'Type', 'Effective Date', 'Premium'].map((h) => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceData.items.map((row, i) => {
                        const premium = getNum(row, ...PREMIUM_KEYS);
                        const isNeg = premium < 0;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #F7F8FA' }}>
                            <td style={{ padding: '12px 16px', color: '#9CA3B8', fontSize: 11 }}>{i + 1}</td>
                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{getStr(row, ...ID_KEYS)}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#131C4E' }}>{getStr(row, ...NAME_KEYS)}</td>
                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>{getStr(row, ...PLAN_KEYS)}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: getStr(row, ...TYPE_KEYS).toLowerCase().includes('dep') ? '#FFF5EF' : '#EFF6FF', color: getStr(row, ...TYPE_KEYS).toLowerCase().includes('dep') ? '#C2410C' : '#1D4ED8' }}>
                                {getStr(row, ...TYPE_KEYS)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: 11 }}>{getStr(row, ...DATE_KEYS)}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: isNeg ? '#DC2626' : '#131C4E', textAlign: 'right' }}>
                              {isNeg ? '-' : ''}{fmt(Math.abs(premium))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div style={{ padding: '20px 28px', borderTop: '1px solid #F0F1F5', background: '#FAFBFC', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 280 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280' }}>
                      <span>Positive Premium</span>
                      <span style={{ fontWeight: 600, color: '#059669' }}>{fmt(invoiceData.posTotal)}</span>
                    </div>
                    {invoiceData.negTotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280' }}>
                        <span>Negative Premium (Credits)</span>
                        <span style={{ fontWeight: 600, color: '#DC2626' }}>-{fmt(invoiceData.negTotal)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#131C4E', borderTop: '1px solid #E5E7F1', paddingTop: 10, marginTop: 4 }}>
                      <span>Net Invoice Total</span>
                      <span>{fmt(invoiceData.netTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Save section */}
                <div style={{ padding: '20px 28px', borderTop: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  {savedReceipt ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                      <CheckCircle2 style={{ width: 16, height: 16, color: '#059669' }} />
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>Invoice Saved Successfully</p>
                        <p style={{ fontSize: 11, color: '#065F46', marginTop: 1 }}>Receipt No: <strong>{savedReceipt}</strong></p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <Info style={{ width: 14, height: 14, color: '#9CA3B8', marginTop: 2, flexShrink: 0 }} />
                      <p style={{ fontSize: 11, color: '#9CA3B8', lineHeight: 1.5 }}>
                        Review the line items above, then click Save Invoice to record this invoice in the system.
                      </p>
                    </div>
                  )}

                  {!savedReceipt && (
                    <button onClick={saveInvoice} disabled={saving || hasOutstanding}
                      title={hasOutstanding ? 'Clear outstanding balance before saving a new invoice' : ''}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 10, border: 'none', background: (saving || hasOutstanding) ? '#E5E7F1' : 'linear-gradient(135deg,#131C4E,#1E2A6E)', color: (saving || hasOutstanding) ? '#9CA3B8' : '#fff', fontSize: 13, fontWeight: 700, cursor: (saving || hasOutstanding) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                      {saving
                        ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Saving...</>
                        : 'Save Invoice'}
                    </button>
                  )}

                  {saveError && (
                    <div style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12 }}>
                      {saveError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!invoiceData && !invoiceLoading && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '60px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText style={{ width: 20, height: 20, color: '#9CA3B8' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>Select an invoice type and click Load Invoice</p>
                <p style={{ fontSize: 12, color: '#9CA3B8' }}>Your invoice line items will appear here.</p>
              </div>
            )}
          </div>
        )}

        {/* ── SCHEDULE TAB ─────────────────────────────────────────────────── */}
        {tab === 'schedule' && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            {scheduleLoading ? (
              <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
                <Loader2 style={{ width: 24, height: 24, color: '#F56B22', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : schedule.length === 0 ? (
              <div style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarDays style={{ width: 20, height: 20, color: '#9CA3B8' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>No schedule available</p>
                <p style={{ fontSize: 12, color: '#9CA3B8' }}>Your payment schedule will appear here once an invoice is generated.</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F1F5' }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#131C4E' }}>Payment Schedule</p>
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 3 }}>{schedule.length} payment{schedule.length !== 1 ? 's' : ''} scheduled</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                        {['#', 'Due Date', 'Amount Due', 'Status', 'Receipt No.'].map((h) => (
                          <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((row, i) => {
                        const due = getStr(row, 'NextDue', 'DueDate', 'due_date', 'nextdue');
                        const amount = getNum(row, 'NextDueAmount', 'Amount', 'AmountDue', 'amount');
                        const receipt = getStr(row, 'ReceiptNumber', 'receiptnumber', 'InvoiceNo');
                        const isPast = due !== '—' && new Date(due) < new Date();
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #F7F8FA' }}>
                            <td style={{ padding: '14px 20px', color: '#9CA3B8', fontSize: 11 }}>{i + 1}</td>
                            <td style={{ padding: '14px 20px', fontWeight: 600, color: isPast ? '#DC2626' : '#131C4E' }}>{fmtDate(due)}</td>
                            <td style={{ padding: '14px 20px', fontWeight: 700, color: '#131C4E' }}>{fmt(amount)}</td>
                            <td style={{ padding: '14px 20px' }}>
                              <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: isPast ? '#FEF2F2' : '#FFFBEB', color: isPast ? '#DC2626' : '#D97706' }}>
                                {isPast ? 'Overdue' : 'Pending'}
                              </span>
                            </td>
                            <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{receipt}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
