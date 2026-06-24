'use client';

import { useState } from 'react';
import { Search, ArrowDownToLine, Filter, TrendingUp, Clock, XCircle } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { mockClaims, mockMembers } from '@/lib/mock-data';

function getEnroleeId(employeeId: string, type: string): string {
  const num = parseInt(employeeId.replace('EMP', ''), 10);
  const base = `2100${String(num).padStart(4, '0')}`;
  return `${base}/${type === 'Dependant' ? '1' : '0'}`;
}

const memberTypeMap: Record<string, string> = Object.fromEntries(
  mockMembers.map((m) => [m.employeeId, m.type])
);

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
  { label: 'Total Paid YTD',  value: fmt(totalPaid),        sub: `${mockClaims.filter((c) => c.status === 'Paid').length} claims settled`,      color: '#10B981', bg: '#ECFDF5', Icon: TrendingUp },
  { label: 'Processing',      value: fmt(totalPending),     sub: `${mockClaims.filter((c) => c.status === 'Processing').length} claims pending`, color: '#F59E0B', bg: '#FFFBEB', Icon: Clock      },
  { label: 'Claims Queried',  value: String(totalQueried),  sub: 'Awaiting additional info',                                                     color: '#3B82F6', bg: '#EFF6FF', Icon: Filter     },
  { label: 'Claims Rejected', value: String(totalRejected), sub: 'Declined for payment',                                                         color: '#EF4444', bg: '#FEF2F2', Icon: XCircle    },
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
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Claims" subtitle="Claims Register · Spend Analysis" />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* SUMMARY STRIP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {summaryCards.map((s) => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '26px 28px' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <s.Icon style={{ width: 16, height: 16, color: s.color }} strokeWidth={1.75} />
              </div>
              <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 10, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', marginBottom: 3 }}>{s.label}</p>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#9CA3B8' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* TOOLBAR */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 220 }}>
              <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#C4C9D9' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by member, ref, provider, diagnosis..."
                style={{ width: '100%', height: 42, paddingLeft: 42, paddingRight: 14, fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
            </div>
            {[
              { value: catFilter,    setter: setCat,    opts: ['All Categories', ...Object.keys(categoryStyles)] },
              { value: statusFilter, setter: setStatus, opts: ['All Statuses',   ...Object.keys(statusStyles)] },
              { value: planFilter,   setter: setPlan,   opts: ['All Plans', 'Gold Plus', 'Silver', 'Bronze'] },
            ].map(({ value, setter, opts }) => (
              <select key={opts[0]} value={value} onChange={(e) => setter(e.target.value)}
                style={{ height: 42, padding: '0 32px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                {opts.map((o, i) => <option key={o} value={i === 0 ? '' : o}>{o}</option>)}
              </select>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: '#131C4E', padding: '0 14px', height: 42, display: 'inline-flex', alignItems: 'center', background: '#FAFBFC', borderRadius: 14, border: '1px solid #E5E7F1' }}>
              {fmt(filteredTotal)} total
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 16px', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(21,128,61,0.10)' }}>
                <ArrowDownToLine style={{ width: 13, height: 13 }} /> XLS
              </button>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 16px', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#FFF5EF,#FFE8D6)', color: '#C2410C', border: '1px solid #FDBA74', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(194,65,12,0.10)' }}>
                <ArrowDownToLine style={{ width: 13, height: 13 }} /> PDF
              </button>
            </div>
          </div>
        </div>

        {/* CLAIMS TABLE */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div
            className="grid text-[10.5px] font-bold uppercase bg-[#FAFBFC] border-b border-[#F0F1F5]"
            style={{ gridTemplateColumns: '106px 140px 118px 150px 140px 88px 100px 88px 80px', columnGap: 12, padding: '12px 24px', color: '#B0B7C9', letterSpacing: '0.07em', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <span>Ref</span>
            <span>Member</span>
            <span>Enrolee ID</span>
            <span>Diagnosis</span>
            <span>Provider</span>
            <span>Category</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
            <span>Date</span>
          </div>

          {filtered.map((c) => {
            const st  = statusStyles[c.status]        ?? statusStyles['Processing'];
            const cat = categoryStyles[c.category]    ?? categoryStyles['Outpatient'];
            const memberType = memberTypeMap[c.employeeId] ?? 'Principal';
            const enroleeId  = getEnroleeId(c.employeeId, memberType);
            return (
              <div
                key={c.id}
                className="grid items-center border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
                style={{ gridTemplateColumns: '106px 140px 118px 150px 140px 88px 100px 88px 80px', columnGap: 12, padding: '16px 24px' }}>
                <span className="text-[12px] font-bold text-[#F56B22] font-mono">{c.claimRef}</span>
                <span className="text-[13px] font-semibold text-[#131C4E] truncate">{c.memberName}</span>
                <span className="text-[11px] text-[#9CA3B8] font-mono">{enroleeId}</span>
                <span className="text-[12px] text-[#6B7280] truncate">{c.diagnosis}</span>
                <span className="text-[12px] text-[#6B7280] truncate">{c.provider}</span>
                <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-semibold w-fit" style={{ background: cat.bg, color: cat.text }}>{c.category}</span>
                <span className="text-[13px] font-bold text-[#131C4E] text-right">{fmt(c.amount)}</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold w-fit" style={{ background: st.bg, color: st.text }}>
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

          <div className="flex items-center justify-between px-6 py-4 border-t border-[#F0F1F5]" style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
            <p className="text-[12px] text-[#9CA3B8]">Showing {filtered.length} of {mockClaims.length} claims</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {(['‹', '1', '2', '›'] as const).map((p) => (
                <button key={p} style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: p === '1' ? 'none' : '1px solid #E5E7F1', borderRadius: 8, cursor: 'pointer',
                  fontSize: p === '‹' || p === '›' ? 15 : 12, fontWeight: p === '1' ? 700 : 500,
                  background: p === '1' ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : '#fff',
                  color: p === '1' ? '#fff' : '#6B7280',
                  boxShadow: p === '1' ? '0 2px 6px rgba(245,107,34,0.28)' : 'none',
                  transition: 'all 0.15s',
                }}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
