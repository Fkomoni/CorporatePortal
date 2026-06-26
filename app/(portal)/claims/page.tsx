'use client';

import { useState, useEffect } from 'react';
import { Search, ArrowDownToLine, Filter, TrendingUp, Clock, XCircle } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { ClaimsVisibility, DEFAULT_CLAIMS_VISIBILITY, getClaimsVisibility } from '@/lib/claims-visibility';
import type { LiveClaim, ClaimsStats } from '@/app/api/hr/claims/route';

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

const fmt    = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;
const fmtDate = (d: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};

function memberInitials(fullName: string, enrolleeId: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    return parts.map((p) => p[0] + '.').join('');
  }
  if (enrolleeId) return enrolleeId.slice(0, 4);
  return '—';
}

export default function ClaimsPage() {
  const [search, setSearch]       = useState('');
  const [catFilter, setCat]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [vis, setVis]             = useState<ClaimsVisibility>(DEFAULT_CLAIMS_VISIBILITY);

  const [claims, setClaims]       = useState<LiveClaim[]>([]);
  const [stats, setStats]         = useState<ClaimsStats | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => { setVis(getClaimsVisibility()); }, []);

  useEffect(() => {
    fetch('/api/hr/claims')
      .then((r) => r.json())
      .then((d) => {
        if (d.claims) setClaims(d.claims);
        if (d.stats)  setStats(d.stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = claims.filter((c) => {
    const q = search.toLowerCase();
    return (!q || c.memberName.toLowerCase().includes(q) || c.claimRef.toLowerCase().includes(q) || c.provider.toLowerCase().includes(q) || c.diagnosis.toLowerCase().includes(q) || c.employeeId.toLowerCase().includes(q))
      && (!catFilter    || c.category === catFilter)
      && (!statusFilter || c.status   === statusFilter);
  });

  const filteredTotal = filtered.reduce((s, c) => s + c.amount, 0);

  const summaryCards = stats ? [
    {
      label: 'Total Paid YTD',
      value: fmt(stats.totalPaidAmount),
      sub: `${stats.paidCount} claim${stats.paidCount !== 1 ? 's' : ''} settled`,
      color: '#10B981', bg: '#ECFDF5', Icon: TrendingUp,
    },
    {
      label: 'Processing',
      value: fmt(stats.processingAmount),
      sub: `${stats.processingCount} claim${stats.processingCount !== 1 ? 's' : ''} pending`,
      color: '#F59E0B', bg: '#FFFBEB', Icon: Clock,
    },
    {
      label: 'Claims Queried',
      value: String(stats.queriedCount),
      sub: 'Awaiting additional info',
      color: '#3B82F6', bg: '#EFF6FF', Icon: Filter,
    },
    {
      label: 'Claims Rejected',
      value: String(stats.rejectedCount),
      sub: 'Declined for payment',
      color: '#EF4444', bg: '#FEF2F2', Icon: XCircle,
    },
  ] : null;

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Claims" subtitle="Claims Register · Spend Analysis" />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* SUMMARY STRIP */}
        {vis.showSummaryCards && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {(summaryCards ?? [
              { label: 'Total Paid YTD',  value: '…', sub: '',                       color: '#10B981', bg: '#ECFDF5', Icon: TrendingUp },
              { label: 'Processing',      value: '…', sub: '',                       color: '#F59E0B', bg: '#FFFBEB', Icon: Clock      },
              { label: 'Claims Queried',  value: '…', sub: 'Awaiting additional info', color: '#3B82F6', bg: '#EFF6FF', Icon: Filter   },
              { label: 'Claims Rejected', value: '…', sub: 'Declined for payment',    color: '#EF4444', bg: '#FEF2F2', Icon: XCircle  },
            ]).map((s) => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', borderLeft: `3px solid ${s.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '22px 22px 22px 20px' }}>
                <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 10, color: '#131C4E' }}>
                  {loading ? '…' : vis.showAmounts ? s.value : '—'}
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', marginBottom: 3 }}>{s.label}</p>
                <p style={{ fontSize: 11, fontWeight: 500, color: '#9CA3B8' }}>{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* TOOLBAR */}
        {vis.showFilters && (
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
              ].map(({ value, setter, opts }) => (
                <select key={opts[0]} value={value} onChange={(e) => setter(e.target.value)}
                  style={{ height: 42, padding: '0 32px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                  {opts.map((o, i) => <option key={o} value={i === 0 ? '' : o}>{o}</option>)}
                </select>
              ))}
              <div style={{ flex: 1 }} />
              {vis.showAmounts && !loading && (
                <div style={{ fontSize: 12, fontWeight: 600, color: '#131C4E', padding: '0 14px', height: 42, display: 'inline-flex', alignItems: 'center', background: '#FAFBFC', borderRadius: 14, border: '1px solid #E5E7F1' }}>
                  {fmt(filteredTotal)} total
                </div>
              )}
              {vis.showExports && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 16px', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(21,128,61,0.10)' }}>
                    <ArrowDownToLine style={{ width: 13, height: 13 }} /> XLS
                  </button>
                  <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 16px', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#FFF5EF,#FFE8D6)', color: '#C2410C', border: '1px solid #FDBA74', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(194,65,12,0.10)' }}>
                    <ArrowDownToLine style={{ width: 13, height: 13 }} /> PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CLAIMS TABLE */}
        {vis.showTable && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div
              className="grid text-[10.5px] font-bold uppercase bg-[#FAFBFC] border-b border-[#F0F1F5]"
              style={{ gridTemplateColumns: '140px 100px 110px 1fr 92px 100px 96px 88px', columnGap: 12, padding: '12px 24px', color: '#B0B7C9', letterSpacing: '0.07em', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <span>Ref</span>
              <span>Member</span>
              <span>Enrolee ID</span>
              <span>Provider</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
              <span>Status</span>
              <span>Date</span>
            </div>

            {loading && (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div style={{ width: 32, height: 32, border: '3px solid #F0F1F5', borderTopColor: '#F56B22', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p className="text-[13px] text-[#9CA3B8]">Loading claims…</p>
              </div>
            )}

            {!loading && filtered.map((c, i) => {
              const st  = statusStyles[c.status]     ?? statusStyles['Processing'];
              const cat = categoryStyles[c.category] ?? categoryStyles['Outpatient'];
              const initials = memberInitials(c.memberName, c.employeeId);
              return (
                <div
                  key={c.id || i}
                  className="grid items-center border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
                  style={{ gridTemplateColumns: '140px 100px 110px 1fr 92px 100px 96px 88px', columnGap: 12, padding: '16px 24px' }}>
                  <span className="text-[12px] font-bold text-[#F56B22] font-mono truncate">{c.claimRef}</span>
                  <span className="text-[13px] font-semibold text-[#131C4E]">{initials}</span>
                  <span className="text-[11px] text-[#9CA3B8] font-mono">{c.employeeId || '—'}</span>
                  <span className="text-[11px] text-[#9CA3B8] truncate">{c.provider || '—'}</span>
                  <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-semibold w-fit" style={{ background: cat.bg, color: cat.text }}>{c.category}</span>
                  <span className="text-[13px] font-bold text-[#131C4E] text-right">{vis.showAmounts ? fmt(c.amount) : '—'}</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold w-fit" style={{ background: st.bg, color: st.text }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />{c.status}
                  </span>
                  <span className="text-[11px] text-[#9CA3B8]">{fmtDate(c.submittedDate)}</span>
                </div>
              );
            })}

            {!loading && filtered.length === 0 && (
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
              <p className="text-[12px] text-[#9CA3B8]">
                Showing {filtered.length} of {claims.length} claims
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {(['‹', '1', '›'] as const).map((p) => (
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
        )}
      </div>
    </div>
  );
}
