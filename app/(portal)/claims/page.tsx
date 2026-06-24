'use client';

import { useState } from 'react';
import { Search, Download, Filter, TrendingUp, Clock, XCircle } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { mockClaims } from '@/lib/mock-data';

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  'Paid':       { bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
  'Processing': { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
  'Queried':    { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
  'Rejected':   { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
};

const categoryStyles: Record<string, { bg: string; text: string }> = {
  'Outpatient': { bg: '#EFF6FF', text: '#2563EB' },
  'Inpatient':  { bg: '#F5F3FF', text: '#7C3AED' },
  'Dental':     { bg: '#FFF7ED', text: '#C2410C' },
  'Optical':    { bg: '#F0FDFD', text: '#0E7490' },
  'Maternity':  { bg: '#FFF1F2', text: '#BE123C' },
  'Emergency':  { bg: '#FEF2F2', text: '#DC2626' },
};

const planStyles: Record<string, { bg: string; text: string }> = {
  'Gold Plus': { bg: '#FFFBEB', text: '#D97706' },
  'Silver':    { bg: '#F1F5F9', text: '#475569' },
  'Bronze':    { bg: '#FFF7ED', text: '#C2410C' },
};

const fmt = (n: number) => `₦${n.toLocaleString('en-NG')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });

const totalPaid      = mockClaims.filter((c) => c.status === 'Paid').reduce((s, c) => s + c.amount, 0);
const totalPending   = mockClaims.filter((c) => c.status === 'Processing').reduce((s, c) => s + c.amount, 0);
const totalQueried   = mockClaims.filter((c) => c.status === 'Queried').length;
const totalRejected  = mockClaims.filter((c) => c.status === 'Rejected').length;

const summaryCards = [
  { label: 'Total Paid YTD',      value: fmt(totalPaid),    sub: `${mockClaims.filter((c) => c.status === 'Paid').length} claims settled`,       color: '#10B981', Icon: TrendingUp   },
  { label: 'Processing',          value: fmt(totalPending), sub: `${mockClaims.filter((c) => c.status === 'Processing').length} claims pending`,  color: '#F59E0B', Icon: Clock        },
  { label: 'Claims Queried',      value: String(totalQueried),  sub: 'Awaiting additional info',                                                  color: '#3B82F6', Icon: Filter       },
  { label: 'Claims Rejected',     value: String(totalRejected), sub: 'Declined for payment',                                                      color: '#EF4444', Icon: XCircle      },
];

export default function ClaimsPage() {
  const [search, setSearch]     = useState('');
  const [catFilter, setCat]     = useState('');
  const [statusFilter, setStatus] = useState('');
  const [planFilter, setPlan]   = useState('');

  const filtered = mockClaims.filter((c) => {
    const q = search.toLowerCase();
    return (!q || c.memberName.toLowerCase().includes(q) || c.claimRef.toLowerCase().includes(q) || c.provider.toLowerCase().includes(q) || c.diagnosis.toLowerCase().includes(q))
      && (!catFilter    || c.category === catFilter)
      && (!statusFilter || c.status   === statusFilter)
      && (!planFilter   || c.plan     === planFilter);
  });

  const filteredTotal = filtered.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="flex flex-col min-h-full bg-[#FAFBFC]">
      <TopBar title="Claims" subtitle="Claims Register · Spend Analysis" />

      <div className="p-6 flex flex-col gap-5">

        {/* SUMMARY STRIP */}
        <div className="grid grid-cols-4 gap-4">
          {summaryCards.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-[#9CA3B8] uppercase tracking-widest">{s.label}</p>
                <s.Icon className="w-4 h-4" style={{ color: s.color }} strokeWidth={1.75} />
              </div>
              <p className="text-[28px] font-black tracking-tight leading-none mb-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] text-[#9CA3B8]">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* TOOLBAR */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0F1F5]">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3B8]" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by member, ref, provider, diagnosis..."
                className="w-full h-9 pl-9 pr-3 text-[13px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] placeholder:text-[#9CA3B8] outline-none focus:border-[#F56B22] focus:bg-white transition-colors" />
            </div>
            <select value={catFilter} onChange={(e) => setCat(e.target.value)} className="h-9 px-3 text-[12px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none">
              <option value="">All Categories</option>
              {Object.keys(categoryStyles).map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatus(e.target.value)} className="h-9 px-3 text-[12px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none">
              <option value="">All Statuses</option>
              {Object.keys(statusStyles).map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={planFilter} onChange={(e) => setPlan(e.target.value)} className="h-9 px-3 text-[12px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none">
              <option value="">All Plans</option>
              <option>Gold Plus</option><option>Silver</option><option>Bronze</option>
            </select>
            <div className="flex-1" />
            <div className="text-[12px] font-semibold text-[#131C4E] px-3 py-1.5 bg-[#F7F8FA] rounded-lg border border-[#E5E7F1]">
              {fmt(filteredTotal)} total
            </div>
            <button className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA]">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        </div>

        {/* CLAIMS TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#F0F1F5] overflow-hidden">
          <div
            className="grid text-[10.5px] font-bold text-[#9CA3B8] uppercase tracking-widest px-5 py-3 bg-[#FAFBFC] border-b border-[#F0F1F5]"
            style={{ gridTemplateColumns: '130px 1fr 160px 110px 120px 100px 110px 110px' }}>
            <span>Ref</span>
            <span>Member · Diagnosis</span>
            <span>Provider</span>
            <span>Category</span>
            <span>Plan</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
            <span>Date</span>
          </div>

          {filtered.map((c) => {
            const st  = statusStyles[c.status]        ?? statusStyles['Processing'];
            const cat = categoryStyles[c.category]    ?? categoryStyles['Outpatient'];
            const pl  = planStyles[c.plan]            ?? planStyles['Bronze'];
            return (
              <div
                key={c.id}
                className="grid items-center px-5 py-3.5 border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
                style={{ gridTemplateColumns: '130px 1fr 160px 110px 120px 100px 110px 110px' }}>
                <span className="text-[12px] font-bold text-[#F56B22]">{c.claimRef}</span>
                <div className="min-w-0 pr-4">
                  <p className="text-[13px] font-semibold text-[#131C4E] truncate">{c.memberName}</p>
                  <p className="text-[11px] text-[#9CA3B8] truncate">{c.diagnosis}</p>
                </div>
                <span className="text-[12px] text-[#6B7280] truncate pr-2">{c.provider}</span>
                <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-semibold w-fit" style={{ background: cat.bg, color: cat.text }}>{c.category}</span>
                <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-semibold w-fit" style={{ background: pl.bg, color: pl.text }}>{c.plan}</span>
                <span className="text-[13px] font-bold text-[#131C4E] text-right">{fmt(c.amount)}</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold w-fit" style={{ background: st.bg, color: st.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />{c.status}
                </span>
                <span className="text-[11px] text-[#9CA3B8]">{fmtDate(c.submittedDate)}</span>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F7F8FA] flex items-center justify-center">
                <Search className="w-5 h-5 text-[#9CA3B8]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#131C4E]">No claims found</p>
                <p className="text-[12px] text-[#9CA3B8] mt-0.5">Try adjusting your search or filters</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F0F1F5]">
            <p className="text-[12px] text-[#9CA3B8]">Showing {filtered.length} of {mockClaims.length} claims</p>
            <div className="flex gap-1">
              {['‹', '1', '2', '›'].map((p) => (
                <button key={p} className={`w-8 h-8 text-[12px] font-medium rounded-lg transition-colors ${p === '1' ? 'text-white' : 'text-[#6B7280] hover:bg-[#F7F8FA]'}`}
                  style={p === '1' ? { background: '#F56B22' } : {}}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
