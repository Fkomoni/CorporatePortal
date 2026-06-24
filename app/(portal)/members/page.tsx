'use client';

import { useState } from 'react';
import {
  Search, Upload, ArrowDownToLine, Download, Plus, FileText,
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

      <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 440, background: '#fff', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>Member 360</p>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3B8' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F7F8FA'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Profile section */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, background: grad }}>
              {member.firstName[0]}{member.lastName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#131C4E', lineHeight: 1.2 }}>{member.firstName} {member.lastName}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 600, background: '#F1F2F8', color: '#3A4382', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>{member.employeeId}</span>
                <span style={{ fontSize: 10, fontWeight: 600, background: '#FFF3E8', color: '#F56B22', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>{getEnroleeId(member.employeeId, member.type)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: plan.bg, color: plan.text }}>{member.plan}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: status.bg, color: status.text }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: status.dot }} />{member.status}
                </span>
                <span style={{ fontSize: 11, color: '#B8BFD0' }}>{member.type}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
            {[
              { Icon: Phone,    value: member.phone },
              { Icon: Mail,     value: member.email },
              { Icon: MapPin,   value: member.location },
              { Icon: Calendar, value: `Enrolled ${new Date(member.enrollmentDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}` },
            ].map(({ Icon, value }) => (
              <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon style={{ width: 12, height: 12, color: '#C4C9D9', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          {[
            { label: 'Dependants',  value: member.dependants ?? 0, Icon: Users,       color: '#3A4382', bg: '#EEF2FF' },
            { label: 'Claims YTD',  value: '4',                    Icon: Activity,    color: '#F56B22', bg: '#FFF3E8' },
            { label: 'Utilization', value: '74%',                  Icon: ShieldCheck, color: '#10B981', bg: '#ECFDF5' },
          ].map((k) => (
            <div key={k.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 8px', borderRight: '1px solid #F0F1F5' }} className="last:border-r-0">
              <div style={{ width: 30, height: 30, borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <k.Icon style={{ width: 14, height: 14, color: k.color }} strokeWidth={1.75} />
              </div>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#131C4E', lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</p>
              <p style={{ fontSize: 10, color: '#9CA3B8', fontWeight: 500, marginTop: 3 }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          {(['overview', 'claims', 'benefits'] as const).map((tab) => (
            <button key={tab} onClick={() => setDrawerTab(tab)}
              style={{ flex: 1, padding: '12px 0', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'all 0.15s', color: drawerTab === tab ? '#F56B22' : '#9CA3B8', borderBottom: `2px solid ${drawerTab === tab ? '#F56B22' : 'transparent'}` }}>
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

        <div style={{ ...card, padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 440 }}>
              <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#C4C9D9' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or phone..."
                style={{ width: '100%', height: 42, paddingLeft: 44, paddingRight: 16, fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
            </div>
            {/* Filters */}
            {[
              { value: planFilter,   setter: setPlanFilter,   options: ['All Plans','Gold Plus','Silver','Bronze'] },
              { value: statusFilter, setter: setStatusFilter, options: ['All Status','Active','Pending','Terminated'] },
            ].map(({ value, setter, options }) => (
              <select key={options[0]} value={value} onChange={(e) => setter(e.target.value)}
                style={{ height: 42, padding: '0 34px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {options.map((o) => <option key={o} value={o === options[0] ? '' : o}>{o}</option>)}
              </select>
            ))}
            <div style={{ flex: 1 }} />
            {/* Divider */}
            <div style={{ width: 1, height: 28, background: '#E5E7F1' }} />
            {/* Actions */}
            <button onClick={() => toast('Upload your Census CSV to bulk-enrol members.', 'info')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontSize: 13, fontWeight: 500, color: '#3A4382', border: '1px solid #E5E7F1', borderRadius: 14, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <Upload style={{ width: 15, height: 15 }} /> Bulk Upload
            </button>
            <button onClick={() => toast('Member list exported to Excel.')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontSize: 13, fontWeight: 700, letterSpacing: '0.01em', background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(21,128,61,0.10)' }}>
              <ArrowDownToLine style={{ width: 15, height: 15 }} /> Export XLS
            </button>
            <button onClick={() => toast('Add Member form coming soon.', 'info')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 22px', fontSize: 13, fontWeight: 700, color: '#fff', borderRadius: 24, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 3px 12px rgba(245,107,34,0.35)', whiteSpace: 'nowrap' }}>
              <Plus style={{ width: 16, height: 16 }} /> Add Member
            </button>
          </div>
        </div>

        {selected.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #FFD8C0', boxShadow: '0 4px 16px rgba(245,107,34,0.10)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800 }}>{selected.length}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>member{selected.length > 1 ? 's' : ''} selected</span>
            </div>
            <div style={{ width: 1, height: 24, background: '#F0F1F5', flexShrink: 0, margin: '0 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
              {[
                { label: 'Approve Additions',  Icon: Plus,       color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
                { label: 'Download E-Cards',   Icon: CreditCard, color: '#3730A3', bg: '#EEF2FF', border: '#C7D2FE' },
                { label: 'Export List',         Icon: ArrowDownToLine, color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
                { label: 'Request Correction',  Icon: FileText,   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
              ].map(({ label, Icon, color, bg, border }) => (
                <button key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 10, border: `1px solid ${border}`, background: bg, color, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Icon style={{ width: 13, height: 13 }} /> {label}
                </button>
              ))}
            </div>
            <button onClick={() => setSelected([])} style={{ fontSize: 12, fontWeight: 500, color: '#9CA3B8', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, flexShrink: 0 }}>✕ Clear</button>
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
