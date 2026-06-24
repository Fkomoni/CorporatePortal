'use client';

import { useState } from 'react';
import {
  Search, Upload, Download, Plus, FileText,
  CreditCard, X, Phone, Mail, MapPin, Calendar,
  ShieldCheck, Users, Activity, AlertCircle,
} from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { mockMembers } from '@/lib/mock-data';
import type { Member } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';

function getEnroleeId(employeeId: string, type: string): string {
  const num = parseInt(employeeId.replace('EMP', ''), 10);
  const base = `2100${String(num).padStart(4, '0')}`;
  return `${base}/${type === 'Dependant' ? '1' : '0'}`;
}

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

const mockClaimHistory = [
  { date: 'Jun 12, 2026', provider: 'Reddington Hospital',   category: 'Outpatient',  amount: '₦28,500',  status: 'Paid' },
  { date: 'May 04, 2026', provider: 'Apex Dental Clinic',    category: 'Dental',      amount: '₦45,000',  status: 'Paid' },
  { date: 'Mar 22, 2026', provider: 'Lagos Island General',  category: 'Inpatient',   amount: '₦312,000', status: 'Paid' },
  { date: 'Feb 10, 2026', provider: 'Clear Vision Eye',      category: 'Optical',     amount: '₦22,000',  status: 'Paid' },
];

function Member360Drawer({ member, index, onClose }: { member: Member; index: number; onClose: () => void }) {
  const [drawerTab, setDrawerTab] = useState<'overview' | 'claims' | 'benefits'>('overview');
  const { toast } = useToast();
  const plan   = planColors[member.plan]   ?? { bg: '#F1F5F9', text: '#475569' };
  const status = statusColors[member.status] ?? { bg: '#F1F5F9', text: '#475569', dot: '#9CA3B8' };
  const grad   = avatarGradients[index % avatarGradients.length];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 h-screen w-[420px] bg-white z-50 flex flex-col shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F1F5] flex-shrink-0">
          <p className="text-[13px] font-bold text-[#131C4E]">Member 360</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F7F8FA] text-[#9CA3B8] hover:text-[#131C4E] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 border-b border-[#F0F1F5] flex-shrink-0">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-[18px] flex-shrink-0"
              style={{ background: grad }}
            >
              {member.firstName[0]}{member.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-extrabold text-[#131C4E] leading-tight">{member.firstName} {member.lastName}</p>
              <p className="text-[11px] text-[#9CA3B8] mt-0.5 font-mono">{getEnroleeId(member.employeeId, member.type)}</p>
              <p className="text-[11px] text-[#B8BFD0] mt-0.5">{member.employeeId} · {member.type}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold" style={{ background: plan.bg, color: plan.text }}>{member.plan}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold" style={{ background: status.bg, color: status.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />{member.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
              <Phone className="w-3.5 h-3.5 text-[#9CA3B8] flex-shrink-0" />{member.phone}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
              <Mail className="w-3.5 h-3.5 text-[#9CA3B8] flex-shrink-0" />{member.email}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
              <MapPin className="w-3.5 h-3.5 text-[#9CA3B8] flex-shrink-0" />{member.location}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
              <Calendar className="w-3.5 h-3.5 text-[#9CA3B8] flex-shrink-0" />
              Enrolled {new Date(member.enrollmentDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-b border-[#F0F1F5] flex-shrink-0">
          {[
            { label: 'Dependants',   value: member.dependants ?? 0, Icon: Users,       color: '#3A4382' },
            { label: 'Claims YTD',   value: '4',                    Icon: Activity,    color: '#F56B22' },
            { label: 'Utilization',  value: '74%',                  Icon: ShieldCheck, color: '#10B981' },
          ].map((k) => (
            <div key={k.label} className="flex flex-col items-center py-4 border-r border-[#F0F1F5] last:border-0">
              <k.Icon className="w-4 h-4 mb-1.5" style={{ color: k.color }} strokeWidth={1.75} />
              <p className="text-[20px] font-black text-[#131C4E] leading-none">{k.value}</p>
              <p className="text-[10px] text-[#9CA3B8] font-medium mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="flex border-b border-[#F0F1F5] flex-shrink-0">
          {(['overview', 'claims', 'benefits'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDrawerTab(tab)}
              className={`flex-1 py-3 text-[12px] font-semibold capitalize transition-colors border-b-2 ${drawerTab === tab ? 'text-[#F56B22] border-[#F56B22]' : 'text-[#9CA3B8] border-transparent hover:text-[#131C4E]'}`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'claims' ? 'Claim History' : 'Benefits'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {drawerTab === 'overview' && (
            <div className="p-5 flex flex-col gap-4">
              <div className="bg-[#FAFBFC] rounded-2xl p-4 border border-[#F0F1F5]">
                <p className="text-[11px] font-bold text-[#9CA3B8] uppercase tracking-widest mb-3">Personal Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Date of Birth', value: new Date(member.dateOfBirth).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) },
                    { label: 'Gender',        value: member.gender },
                    { label: 'Plan',          value: member.plan },
                    { label: 'Member Type',   value: member.type },
                    { label: 'State',         value: member.location },
                    { label: 'Dependants',    value: String(member.dependants ?? 0) },
                  ].map((row) => (
                    <div key={row.label}>
                      <p className="text-[10px] text-[#9CA3B8] font-medium">{row.label}</p>
                      <p className="text-[13px] font-semibold text-[#131C4E] mt-0.5">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#FAFBFC] rounded-2xl p-4 border border-[#F0F1F5]">
                <p className="text-[11px] font-bold text-[#9CA3B8] uppercase tracking-widest mb-3">Utilization Summary · 2026</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Total Spend YTD',   value: '₦407,500', color: '#131C4E' },
                    { label: 'Visits Count',       value: '4 visits',  color: '#131C4E' },
                    { label: 'Avg Per Visit',      value: '₦101,875', color: '#131C4E' },
                    { label: 'Benefit Remaining',  value: '₦4,592,500', color: '#10B981' },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between">
                      <span className="text-[12px] text-[#6B7280]">{r.label}</span>
                      <span className="text-[13px] font-bold" style={{ color: r.color }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#131C4E,#3A4382)' }}>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Leadway Health</p>
                    <p className="text-[11px] text-white/70 mt-0.5">Corporate Health Card</p>
                  </div>
                  <ShieldCheck className="w-6 h-6 text-white/40" strokeWidth={1.5} />
                </div>
                <p className="text-[18px] font-extrabold tracking-tight mb-1">{member.firstName} {member.lastName}</p>
                <p className="text-[11px] text-white/50">{member.employeeId} · {member.plan}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                  <div><p className="text-[9px] text-white/40">Group No.</p><p className="text-[11px] font-bold">ACM-2026</p></div>
                  <div className="text-right"><p className="text-[9px] text-white/40">Valid Thru</p><p className="text-[11px] font-bold">Dec 2026</p></div>
                </div>
              </div>
            </div>
          )}

          {drawerTab === 'claims' && (
            <div className="p-5">
              <p className="text-[11px] font-bold text-[#9CA3B8] uppercase tracking-widest mb-4">Recent Claims</p>
              <div className="flex flex-col gap-3">
                {mockClaimHistory.map((c, i) => (
                  <div key={i} className="bg-[#FAFBFC] rounded-xl p-4 border border-[#F0F1F5]">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-[13px] font-semibold text-[#131C4E]">{c.provider}</p>
                      <span className="text-[13px] font-bold text-[#131C4E]">{c.amount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold bg-[#EEF2FF] text-[#3A4382] px-2 py-0.5 rounded-full">{c.category}</span>
                      <span className="text-[10px] text-[#9CA3B8]">{c.date}</span>
                      <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 h-9 text-[12px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA] transition-colors">
                View all claims →
              </button>
            </div>
          )}

          {drawerTab === 'benefits' && (
            <div className="p-5 flex flex-col gap-3">
              <p className="text-[11px] font-bold text-[#9CA3B8] uppercase tracking-widest mb-1">Active Benefit Limits · {member.plan}</p>
              {[
                { cat: 'Outpatient',  limit: '₦5,000,000', used: '₦28,500',    pct: 1 },
                { cat: 'Inpatient',   limit: '₦5,000,000', used: '₦312,000',   pct: 6 },
                { cat: 'Dental',      limit: '₦150,000',   used: '₦45,000',    pct: 30 },
                { cat: 'Optical',     limit: '₦80,000',    used: '₦22,000',    pct: 28 },
                { cat: 'Maternity',   limit: '₦400,000',   used: '₦0',         pct: 0 },
              ].map((b) => (
                <div key={b.cat} className="bg-[#FAFBFC] rounded-xl p-4 border border-[#F0F1F5]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-semibold text-[#131C4E]">{b.cat}</p>
                    <p className="text-[11px] text-[#9CA3B8]">{b.used} / {b.limit}</p>
                  </div>
                  <div className="h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${b.pct}%`,
                        background: b.pct > 80 ? '#EF4444' : b.pct > 50 ? '#F59E0B' : '#10B981',
                        minWidth: b.pct > 0 ? 4 : 0,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-[#9CA3B8] mt-1.5">{b.pct}% utilised</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-[#F0F1F5] flex-shrink-0">
          <button onClick={() => toast('Member record opened for editing.')} className="flex-1 h-9 text-[12px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA] transition-colors">
            Edit Member
          </button>
          <button onClick={() => toast('E-Card sent to member\'s email.')} className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA] transition-colors">
            <CreditCard className="w-3.5 h-3.5" /> E-Card
          </button>
          <button onClick={() => { toast('Termination request submitted for review.', 'error'); onClose(); }} className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-semibold text-white rounded-xl transition-colors" style={{ background: '#EF4444' }}>
            <AlertCircle className="w-3.5 h-3.5" /> Terminate
          </button>
        </div>
      </div>
    </>
  );
}

export default function MembersPage() {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [activeMember, setActiveMember] = useState<{ member: Member; index: number } | null>(null);
  const { toast } = useToast();

  const filtered = mockMembers.filter((m) => {
    const q = search.toLowerCase();
    return (!q || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || m.employeeId.toLowerCase().includes(q) || m.phone.includes(q))
      && (!planFilter || m.plan === planFilter)
      && (!statusFilter || m.status === statusFilter);
  });

  const toggleSelect = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((m) => m.id));

  const card: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #EDEEF2',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="People" subtitle="Member Management · 1,842 active lives" />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {summaryCards.map((c) => (
            <div key={c.label} style={{ ...card, padding: '26px 28px' }}>
              <p style={{ fontSize: 12, color: '#9CA3B8', fontWeight: 500, marginBottom: 12 }}>{c.label}</p>
              <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 12, color: c.color }}>{c.value}</p>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#9CA3B8' }}>{c.sub}</p>
            </div>
          ))}
        </div>

        <div style={{ ...card, padding: '14px 20px' }}>
          <div className="flex items-center gap-3">
            <div className="relative" style={{ flex: '1 1 320px', maxWidth: 480 }}>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B8BFD0]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or phone..."
                className="w-full h-10 pl-10 pr-4 text-[13px] border border-[#E5E7F1] rounded-xl bg-white text-[#131C4E] placeholder:text-[#B8BFD0] outline-none focus:border-[#F56B22] transition-colors"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }} />
            </div>
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
              className="h-10 px-3 pr-8 text-[13px] border border-[#E5E7F1] rounded-xl bg-white text-[#131C4E] outline-none focus:border-[#F56B22] transition-colors cursor-pointer"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
              <option value="">All Plans</option>
              <option>Gold Plus</option><option>Silver</option><option>Bronze</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 pr-8 text-[13px] border border-[#E5E7F1] rounded-xl bg-white text-[#131C4E] outline-none focus:border-[#F56B22] transition-colors cursor-pointer"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
              <option value="">All Status</option>
              <option>Active</option><option>Pending</option><option>Terminated</option>
            </select>
            <div style={{ flex: 1 }} />
            <div className="flex items-center gap-2">
              <button onClick={() => toast('Upload your Census CSV to bulk-enrol members.', 'info')}
                className="flex items-center gap-2 h-10 px-4 text-[13px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA] transition-colors"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <Upload className="w-4 h-4" /> Bulk Upload
              </button>
              <button onClick={() => toast('Member list exported to Excel.')}
                className="flex items-center gap-2 h-10 px-4 text-[13px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA] transition-colors"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <Download className="w-4 h-4" /> Export
              </button>
              <button onClick={() => toast('Add Member form coming soon.', 'info')}
                className="flex items-center gap-2 h-10 px-5 text-[13px] font-semibold text-white rounded-xl transition-colors"
                style={{ background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 2px 8px rgba(245,107,34,0.30)' }}>
                <Plus className="w-4 h-4" /> Add Member
              </button>
            </div>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="bg-[#131C4E] text-white rounded-xl px-5 py-3 flex items-center gap-4">
            <span className="text-[13px] font-semibold">{selected.length} selected</span>
            <div className="flex-1" />
            {[
              { label: 'Approve Additions',  Icon: Plus },
              { label: 'Download E-Cards',   Icon: CreditCard },
              { label: 'Export List',         Icon: Download },
              { label: 'Request Correction',  Icon: FileText },
            ].map(({ label, Icon }) => (
              <button key={label} className="flex items-center gap-1.5 text-[12px] font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
            <button onClick={() => setSelected([])} className="text-[12px] text-white/50 hover:text-white ml-2">✕ Clear</button>
          </div>
        )}

        <div style={{ ...card, overflow: 'hidden' }}>
          <div className="grid items-center gap-3 px-5 py-3 border-b border-[#F0F1F5] bg-[#FAFBFC]"
            style={{ gridTemplateColumns: '36px 1fr 88px 132px 118px 76px 108px 120px 96px' }}>
            <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-[#F56B22] w-4 h-4 rounded" />
            {['Member', 'Emp ID', 'Enrolee ID', 'Plan', 'Type', 'Status', 'Phone', 'Location'].map((h) => (
              <span key={h} className="text-[10.5px] font-bold text-[#9CA3B8] uppercase tracking-widest">{h}</span>
            ))}
          </div>

          {filtered.map((m, i) => {
            const plan   = planColors[m.plan]    ?? { bg: '#F1F5F9', text: '#475569' };
            const status = statusColors[m.status] ?? { bg: '#F1F5F9', text: '#475569', dot: '#9CA3B8' };
            const isSel  = selected.includes(m.id);
            const enroleeId = getEnroleeId(m.employeeId, m.type);
            return (
              <div
                key={m.id}
                className={`grid items-center gap-3 px-5 py-3.5 border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] cursor-pointer transition-colors ${isSel ? 'bg-[#FFF8F5]' : ''}`}
                style={{ gridTemplateColumns: '36px 1fr 88px 132px 118px 76px 108px 120px 96px' }}
                onClick={() => setActiveMember({ member: m, index: i })}
              >
                <input
                  type="checkbox" checked={isSel}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(m.id); }}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-[#F56B22] w-4 h-4 rounded"
                />
                <p className="text-[13px] font-semibold text-[#131C4E] truncate">{m.firstName} {m.lastName}</p>
                <span className="text-[12px] text-[#6B7280] font-mono">{m.employeeId}</span>
                <span className="text-[12px] text-[#131C4E] font-mono font-semibold">{enroleeId}</span>
                <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: plan.bg, color: plan.text }}>{m.plan}</span>
                <span className="text-[12px] text-[#6B7280]">{m.type}</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: status.bg, color: status.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />{m.status}
                </span>
                <span className="text-[12px] text-[#6B7280]">{m.phone}</span>
                <span className="text-[12px] text-[#6B7280]">{m.location}</span>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F7F8FA] flex items-center justify-center">
                <Search className="w-5 h-5 text-[#9CA3B8]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#131C4E]">No members found</p>
                <p className="text-[12px] text-[#9CA3B8] mt-0.5">Try adjusting your search or filters</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F0F1F5]">
            <p className="text-[12px] text-[#9CA3B8]">Showing {filtered.length} of 1,842 members</p>
            <div className="flex gap-1">
              {['‹', '1', '2', '3', '›'].map((p) => (
                <button key={p} className={`w-8 h-8 text-[12px] font-medium rounded-lg transition-colors ${p === '1' ? 'text-white' : 'text-[#6B7280] hover:bg-[#F7F8FA]'}`}
                  style={p === '1' ? { background: '#F56B22' } : {}}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeMember && (
        <Member360Drawer
          member={activeMember.member}
          index={activeMember.index}
          onClose={() => setActiveMember(null)}
        />
      )}
    </div>
  );
}
