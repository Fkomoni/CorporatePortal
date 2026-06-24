'use client';

import { useState } from 'react';
import { Download, CheckCircle2, Clock, Circle, FileText } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { mockInvoices } from '@/lib/mock-data';

const statusColors: Record<string, { bg: string; text: string }> = {
  Paid:    { bg: '#ECFDF5', text: '#059669' },
  Pending: { bg: '#FFFBEB', text: '#D97706' },
  Overdue: { bg: '#FEF2F2', text: '#DC2626' },
};

const paymentSteps = [
  { label: 'Invoice Generated', done: true },
  { label: 'Invoice Sent',      done: true },
  { label: 'Payment Received',  done: false, current: true },
  { label: 'Receipt Issued',    done: false },
];

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'receipts' | 'statement'>('invoices');

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Finance" subtitle="Invoices · Receipts · Statement of Account" />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* INVOICE HEALTH */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: 'Current Month Premium', value: '₦10.5M', sub: '1,842 lives billed',  color: '#131C4E' },
            { label: 'Avg Cost Per Life',     value: '₦5,702', sub: 'Per member / month',  color: '#131C4E' },
            { label: 'Outstanding Balance',   value: '₦10.5M', sub: 'Due in 7 days',        color: '#EF4444' },
          ].map((c) => (
            <div key={c.label} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '26px 28px' }}>
              <p style={{ fontSize: 12, color: '#9CA3B8', fontWeight: 500, marginBottom: 12 }}>{c.label}</p>
              <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 12, color: c.color }}>{c.value}</p>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#9CA3B8' }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* PAYMENT TIMELINE */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '26px 28px' }}>
          <p className="text-[14px] font-bold text-[#131C4E] mb-1">Payment Timeline</p>
          <p className="text-[11px] text-[#9CA3B8] mb-5">INV-2026-0042 · June 2026 Premium</p>
          <div className="flex items-center gap-0">
            {paymentSteps.map((step, i) => (
              <div key={step.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: step.done ? '#ECFDF5' : step.current ? '#FFF1E6' : '#F0F1F5' }}
                  >
                    {step.done
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : step.current
                        ? <Clock className="w-4 h-4 text-[#F56B22]" />
                        : <Circle className="w-4 h-4 text-[#9CA3B8]" />
                    }
                  </div>
                  <p className="text-[11px] font-semibold mt-2 text-center"
                    style={{ color: step.done ? '#059669' : step.current ? '#F56B22' : '#9CA3B8' }}>
                    {step.label}
                  </p>
                </div>
                {i < paymentSteps.length - 1 && (
                  <div className="flex-1 h-px mx-2 mb-5" style={{ background: step.done ? '#10B981' : '#E5E7F1' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 4, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 'fit-content' }}>
          {(['invoices', 'receipts', 'statement'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '9px 22px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: activeTab === tab ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : 'transparent',
                color: activeTab === tab ? '#fff' : '#6B7280',
                boxShadow: activeTab === tab ? '0 2px 8px rgba(245,107,34,0.28)' : 'none',
              }}>
              {tab === 'statement' ? 'Statement' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* INVOICE TABLE */}
        {activeTab === 'invoices' && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F1F5]">
              <p className="text-[15px] font-bold text-[#131C4E]">Invoice List</p>
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA] transition-colors" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <Download className="w-3.5 h-3.5" /> Export PDF
                </button>
                <button className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA] transition-colors" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <Download className="w-3.5 h-3.5" /> Export Excel
                </button>
              </div>
            </div>
            <div className="grid text-[10.5px] font-bold text-[#9CA3B8] uppercase tracking-widest px-5 py-2.5 bg-[#FAFBFC] border-b border-[#F0F1F5]"
              style={{ gridTemplateColumns: '1fr 110px 110px 2fr 130px 120px 80px' }}>
              <span>Invoice No.</span><span>Date</span><span>Due Date</span><span>Description</span>
              <span>Amount</span><span>Status</span><span></span>
            </div>
            {mockInvoices.map((inv) => {
              const s = statusColors[inv.status] ?? { bg: '#F1F5F9', text: '#475569' };
              return (
                <div key={inv.id}
                  className="grid items-center px-5 py-3.5 border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] transition-colors"
                  style={{ gridTemplateColumns: '1fr 110px 110px 2fr 130px 120px 80px' }}>
                  <span className="text-[13px] font-bold text-[#131C4E]">{inv.invoiceNo}</span>
                  <span className="text-[12px] text-[#6B7280]">{new Date(inv.date).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' })}</span>
                  <span className="text-[12px] text-[#6B7280]">{new Date(inv.dueDate).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' })}</span>
                  <span className="text-[12px] text-[#6B7280] truncate pr-4">{inv.description}</span>
                  <span className="text-[13px] font-bold text-[#131C4E]">₦{inv.amount.toLocaleString()}</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: s.bg, color: s.text }}>
                    {inv.status}
                  </span>
                  <button className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold text-[#F56B22] rounded-lg border border-[#FFD8C0] bg-[#FFF5EF] hover:bg-[#FFF1E6] transition-colors">
                    <Download className="w-3 h-3" /> PDF
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activeTab !== 'invoices' && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', paddingTop: 80, paddingBottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div className="w-14 h-14 rounded-2xl bg-[#F7F8FA] border border-[#F0F1F5] flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#9CA3B8]" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-bold text-[#131C4E]">
                {activeTab === 'receipts' ? 'No receipts yet' : 'Statement unavailable'}
              </p>
              <p className="text-[13px] text-[#9CA3B8] mt-1">
                {activeTab === 'receipts'
                  ? 'Receipts will appear here once payments are confirmed by Leadway.'
                  : 'Your full statement of account will be available here soon.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
