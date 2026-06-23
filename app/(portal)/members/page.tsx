'use client';

import { useState } from 'react';
import { Search, Upload, Download, Plus, MoreHorizontal, FileText, CreditCard, Edit2 } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { mockMembers } from '@/lib/mock-data';

const planColors: Record<string, { bg: string; text: string }> = {
  'Gold Plus': { bg: '#FFFBEB', text: '#D97706' },
  'Silver':    { bg: '#F1F5F9', text: '#475569' },
  'Bronze':    { bg: '#FFF7ED', text: '#C2410C' },
};

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  'Active':     { bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
  'Pending':    { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
  'Terminated': { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
};

const summaryCards = [
  { label: 'Active Members',       value: '1,842', sub: 'Total covered lives',  color: '#131C4E' },
  { label: 'New This Month',       value: '24',    sub: 'Enrolments in June',   color: '#10B981' },
  { label: 'Pending Additions',    value: '12',    sub: 'Awaiting activation',  color: '#D97706' },
  { label: 'Pending Terminations', value: '3',     sub: 'Pending approval',     color: '#EF4444' },
];

const avatarGradients = [
  'linear-gradient(135deg,#F56B22,#FFB54B)', 'linear-gradient(135deg,#131C4E,#3A4382)',
  'linear-gradient(135deg,#10B981,#059669)', 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
  'linear-gradient(135deg,#8B5CF6,#6D28D9)', 'linear-gradient(135deg,#EC4899,#DB2777)',
  'linear-gradient(135deg,#14B8A6,#0D9488)', 'linear-gradient(135deg,#F59E0B,#D97706)',
];

export default function MembersPage() {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = mockMembers.filter((m) => {
    const q = search.toLowerCase();
    return (!q || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || m.employeeId.toLowerCase().includes(q) || m.phone.includes(q))
      && (!planFilter || m.plan === planFilter)
      && (!statusFilter || m.status === statusFilter);
  });

  const toggleSelect = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((m) => m.id));

  return (
    <div className="flex flex-col min-h-full bg-[#FAFBFC]">
      <TopBar title="People" subtitle="Member Management · 1,842 active lives" />

      <div className="p-6 flex flex-col gap-5">
        <div className="grid grid-cols-4 gap-4">
          {summaryCards.map((c) => (
            <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
              <p className="text-[11px] font-semibold text-[#9CA3B8] uppercase tracking-widest mb-3">{c.label}</p>
              <p className="text-[36px] font-black tracking-tight leading-none mb-1" style={{ color: c.color }}>{c.value}</p>
              <p className="text-[11px] text-[#9CA3B8]">{c.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0F1F5]">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3B8]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or phone..."
                className="w-full h-9 pl-9 pr-3 text-[13px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] placeholder:text-[#9CA3B8] outline-none focus:border-[#F56B22] focus:bg-white transition-colors" />
            </div>
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
              className="h-9 px-3 text-[12px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none">
              <option value="">All Plans</option>
              <option>Gold Plus</option><option>Silver</option><option>Bronze</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-[12px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none">
              <option value="">All Status</option>
              <option>Active</option><option>Pending</option><option>Terminated</option>
            </select>
            <div className="flex-1" />
            <button className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA]">
              <Upload className="w-3.5 h-3.5" /> Bulk Upload
            </button>
            <button className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA]">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-semibold text-white rounded-xl" style={{ background: '#F56B22' }}>
              <Plus className="w-3.5 h-3.5" /> Add Member
            </button>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="bg-[#131C4E] text-white rounded-xl px-5 py-3 flex items-center gap-4">
            <span className="text-[13px] font-semibold">{selected.length} selected</span>
            <div className="flex-1" />
            {[{ label: 'Approve Additions', Icon: Plus }, { label: 'Download E-Cards', Icon: CreditCard }, { label: 'Export List', Icon: Download }, { label: 'Request Correction', Icon: FileText }].map(({ label, Icon }) => (
              <button key={label} className="flex items-center gap-1.5 text-[12px] font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg">
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
            <button onClick={() => setSelected([])} className="text-[12px] text-white/50 hover:text-white ml-2">✕ Clear</button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-[#F0F1F5] overflow-hidden">
          <div className="grid items-center gap-3 px-5 py-3 border-b border-[#F0F1F5] bg-[#FAFBFC]"
            style={{ gridTemplateColumns: '40px 1fr 120px 80px 100px 140px 100px 80px' }}>
            <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-[#F56B22] w-4 h-4 rounded" />
            {['Member', 'Plan', 'Type', 'Status', 'Phone', 'Location', ''].map((h) => (
              <span key={h} className="text-[10.5px] font-bold text-[#9CA3B8] uppercase tracking-widest">{h}</span>
            ))}
          </div>
          {filtered.map((m, i) => {
            const plan   = planColors[m.plan]   ?? { bg: '#F1F5F9', text: '#475569' };
            const status = statusColors[m.status] ?? { bg: '#F1F5F9', text: '#475569', dot: '#9CA3B8' };
            const isSel  = selected.includes(m.id);
            return (
              <div key={m.id} className={`grid items-center gap-3 px-5 py-3 border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] ${isSel ? 'bg-[#FFF8F5]' : ''}`}
                style={{ gridTemplateColumns: '40px 1fr 120px 80px 100px 140px 100px 80px' }}>
                <input type="checkbox" checked={isSel} onChange={() => toggleSelect(m.id)} className="accent-[#F56B22] w-4 h-4 rounded" />
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0" style={{ background: avatarGradients[i % avatarGradients.length] }}>
                    {m.firstName[0]}{m.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#131C4E] truncate">{m.firstName} {m.lastName}</p>
                    <p className="text-[11px] text-[#9CA3B8]">{m.employeeId}</p>
                  </div>
                </div>
                <span className="inline-flex px-2 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: plan.bg, color: plan.text }}>{m.plan}</span>
                <span className="text-[12px] text-[#6B7280]">{m.type}</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: status.bg, color: status.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />{m.status}
                </span>
                <span className="text-[12px] text-[#6B7280]">{m.phone}</span>
                <span className="text-[12px] text-[#6B7280]">{m.location}</span>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 rounded-lg hover:bg-[#F7F8FA] text-[#9CA3B8]"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button className="p-1.5 rounded-lg hover:bg-[#F7F8FA] text-[#9CA3B8]"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="py-12 text-center text-[#9CA3B8] text-[13px]">No members match your filters.</div>}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F0F1F5]">
            <p className="text-[12px] text-[#9CA3B8]">Showing {filtered.length} of 1,842 members</p>
            <div className="flex gap-1">
              {['‹', '1', '2', '3', '›'].map((p) => (
                <button key={p} className={`w-8 h-8 text-[12px] font-medium rounded-lg ${p === '1' ? 'text-white' : 'text-[#6B7280] hover:bg-[#F7F8FA]'}`} style={p === '1' ? { background: '#F56B22' } : {}}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
