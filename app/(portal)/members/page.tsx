'use client';

import { useState } from 'react';
import {
  Search, Upload, ArrowDownToLine, Plus, FileText,
  CreditCard, X, Phone, Mail, MapPin, Calendar,
  ShieldCheck, Users, Activity, AlertCircle, Send, Link2,
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
  'Plus Plan':   { bg: '#FFF7ED', text: '#C2410C' },
  'Pro Plan':    { bg: '#F1F5F9', text: '#475569' },
  'Max Plan':    { bg: '#FFFBEB', text: '#D97706' },
  'Promax Plan': { bg: '#EFF6FF', text: '#2563EB' },
  'Magnum Plan': { bg: '#F5F3FF', text: '#6D28D9' },
};

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  'Active':     { bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
  'Pending':    { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
  'Terminated': { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
};

const summaryCards = [
  { label: 'Active Members',    value: '1,842', sub: 'Total covered lives',  color: '#131C4E', bg: '#EEF2FF', Icon: Users       },
  { label: 'New This Month',    value: '24',    sub: 'Enrolments in June',   color: '#10B981', bg: '#ECFDF5', Icon: Activity    },
  { label: 'Pending Additions', value: '12',    sub: 'Awaiting activation',  color: '#D97706', bg: '#FFFBEB', Icon: ShieldCheck },
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

const categoryIconColors: Record<string, { bg: string; color: string }> = {
  'Outpatient': { bg: '#FFF3E8', color: '#F56B22' },
  'Dental':     { bg: '#FFF7ED', color: '#C2410C' },
  'Inpatient':  { bg: '#EFF6FF', color: '#2563EB' },
  'Optical':    { bg: '#F5F3FF', color: '#7C3AED' },
  'Maternity':  { bg: '#FFF1F2', color: '#BE123C' },
};

/* ── Custom checkbox ─────────────────────────────────────────────────── */
function Checkbox({
  checked, indeterminate = false, onChange, onClick, title,
}: {
  checked: boolean; indeterminate?: boolean; onChange: () => void;
  onClick?: (e: React.MouseEvent) => void; title?: string;
}) {
  const active = checked || indeterminate;
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      title={title}
      onClick={(e) => { onClick?.(e); onChange(); }}
      style={{
        width: 18, height: 18, borderRadius: 5, cursor: 'pointer', flexShrink: 0,
        border: active ? 'none' : '2px solid #D1D5DB',
        background: active ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        boxShadow: active ? '0 2px 6px rgba(245,107,34,0.28)' : 'inset 0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {indeterminate && !checked
        ? <svg width="8" height="2" viewBox="0 0 8 2" fill="none"><path d="M1 1H7" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
        : checked
          ? <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : null}
    </div>
  );
}

/* ── Add Member Modal ────────────────────────────────────────────────── */
function AddMemberModal({ initialMode, onClose }: { initialMode?: 'individual' | 'bulk'; onClose: () => void }) {
  const [mode, setMode]             = useState<'individual' | 'bulk'>(initialMode ?? 'individual');
  const [memberType, setMemberType] = useState<'new' | 'existing'>('new');
  const [actionType, setActionType] = useState<'link' | 'form'>('link');
  const [linkScope, setLinkScope]   = useState<'self' | 'self-dependent'>('self');
  const [bulkAction, setBulkAction] = useState<'csv' | 'invite'>('csv');
  const [email, setEmail]           = useState('');
  const { toast } = useToast();

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 40, padding: '0 14px', fontSize: 13,
    border: '1.5px solid #E5E7F1', borderRadius: 12, background: '#FAFBFC',
    color: '#131C4E', outline: 'none', boxSizing: 'border-box',
  };

  function handleSubmit() {
    if (mode === 'individual' && actionType === 'link') {
      toast(`Self-enrolment link sent to ${email || 'staff member'}.`, 'info');
    } else if (mode === 'individual' && actionType === 'form') {
      toast('Member record created successfully.', 'info');
    } else if (mode === 'bulk' && bulkAction === 'csv') {
      toast('Census CSV uploaded. Members will be activated shortly.', 'info');
    } else {
      toast(`Bulk invitation links sent (${linkScope === 'self' ? 'Principal only' : 'Principal + Dependent'}).`, 'info');
    }
    onClose();
  }

  const submitLabel =
    mode === 'individual' && actionType === 'link' ? 'Send Link'
    : mode === 'individual' ? 'Add Member'
    : bulkAction === 'csv' ? 'Upload & Enrol'
    : 'Send Invitations';

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 560, maxHeight: '88vh', background: '#fff', borderRadius: 20, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.18)', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '22px 28px', borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#131C4E' }}>Add Members</p>
            <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>Enrol individually, bulk upload, or send self-enrolment links</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F7F8FA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3B8' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0F1F5', padding: '0 28px', flexShrink: 0 }}>
          {(['individual', 'bulk'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '13px 0', marginRight: 28, fontSize: 13, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'all 0.15s', color: mode === m ? '#F56B22' : '#9CA3B8', borderBottom: `2px solid ${mode === m ? '#F56B22' : 'transparent'}` }}>
              {m === 'individual' ? 'Single Member' : 'Bulk Upload'}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* ── Individual mode ── */}
          {mode === 'individual' && (
            <>
              {/* Member type */}
              <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Member Status</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                {([
                  { key: 'new',      label: 'New Member',      desc: 'Not yet on the plan' },
                  { key: 'existing', label: 'Existing Member', desc: 'Already on plan — add a dependent' },
                ] as const).map((t) => (
                  <div key={t.key} onClick={() => setMemberType(t.key)}
                    style={{ padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${memberType === t.key ? '#F56B22' : '#E5E7F1'}`, background: memberType === t.key ? '#FFF8F5' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: memberType === t.key ? '#F56B22' : '#131C4E', marginBottom: 3 }}>{t.label}</p>
                    <p style={{ fontSize: 11, color: '#9CA3B8' }}>{t.desc}</p>
                  </div>
                ))}
              </div>

              {/* How to enrol */}
              <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>How to Enrol</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                {([
                  {
                    key: 'link',
                    label: 'Send Self-Enrolment Link',
                    desc: memberType === 'new' ? 'Staff enrols themselves via a link' : 'Staff adds their own dependent via link',
                  },
                  {
                    key: 'form',
                    label: 'HR Adds Directly',
                    desc: memberType === 'new' ? 'Fill the form on their behalf' : 'HR adds dependent on their behalf',
                  },
                ] as const).map((t) => (
                  <div key={t.key} onClick={() => setActionType(t.key)}
                    style={{ padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${actionType === t.key ? '#3A4382' : '#E5E7F1'}`, background: actionType === t.key ? '#EEF2FF' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: actionType === t.key ? '#3A4382' : '#131C4E', marginBottom: 3 }}>{t.label}</p>
                    <p style={{ fontSize: 11, color: '#9CA3B8' }}>{t.desc}</p>
                  </div>
                ))}
              </div>

              {/* Enrolment scope — only for new + link */}
              {actionType === 'link' && memberType === 'new' && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Enrolment Scope</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                    {([
                      { key: 'self',           label: 'Principal Only',         desc: 'Staff member enrols themselves only' },
                      { key: 'self-dependent', label: 'Principal + Dependent',  desc: 'Staff + one or more dependants' },
                    ] as const).map((t) => (
                      <div key={t.key} onClick={() => setLinkScope(t.key)}
                        style={{ padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${linkScope === t.key ? '#10B981' : '#E5E7F1'}`, background: linkScope === t.key ? '#ECFDF5' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: linkScope === t.key ? '#059669' : '#131C4E', marginBottom: 3 }}>{t.label}</p>
                        <p style={{ fontSize: 11, color: '#9CA3B8' }}>{t.desc}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Email field — for link mode */}
              {actionType === 'link' && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Staff Email Address</p>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="e.g. john.doe@company.com"
                    style={{ ...inputStyle, height: 44, fontSize: 14 }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; }}
                  />
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 6 }}>
                    {memberType === 'new'
                      ? `A unique ${linkScope === 'self-dependent' ? 'principal + dependent' : 'principal-only'} enrolment link will be sent to this address.`
                      : "A link to add a dependent will be sent to the member's registered email."}
                  </p>
                </div>
              )}

              {/* Direct form — for form mode */}
              {actionType === 'form' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[
                    { label: 'First Name',     placeholder: 'e.g. Amaka' },
                    { label: 'Last Name',      placeholder: 'e.g. Okafor' },
                    { label: 'Employee ID',    placeholder: 'e.g. EMP0042' },
                    { label: 'Email Address',  placeholder: 'e.g. amaka@company.com' },
                    { label: 'Phone Number',   placeholder: 'e.g. 08012345678' },
                    { label: 'Date of Birth',  placeholder: 'DD MMM YYYY' },
                  ].map((f) => (
                    <div key={f.label}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{f.label}</p>
                      <input placeholder={f.placeholder} style={inputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; }} />
                    </div>
                  ))}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Plan</p>
                    <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                      {['Plus Plan', 'Pro Plan', 'Max Plan', 'Promax Plan', 'Magnum Plan'].map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  {memberType === 'existing' && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Relationship</p>
                      <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                        {['Spouse', 'Child', 'Parent'].map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Bulk mode ── */}
          {mode === 'bulk' && (
            <>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Bulk Action Type</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                {([
                  { key: 'csv',    label: 'Upload Census CSV',       desc: 'HR adds multiple members at once via spreadsheet' },
                  { key: 'invite', label: 'Bulk Send Invite Links',  desc: 'Email self-enrolment links to a list of staff' },
                ] as const).map((t) => (
                  <div key={t.key} onClick={() => setBulkAction(t.key)}
                    style={{ padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${bulkAction === t.key ? '#F56B22' : '#E5E7F1'}`, background: bulkAction === t.key ? '#FFF8F5' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: bulkAction === t.key ? '#F56B22' : '#131C4E', marginBottom: 3 }}>{t.label}</p>
                    <p style={{ fontSize: 11, color: '#9CA3B8' }}>{t.desc}</p>
                  </div>
                ))}
              </div>

              {bulkAction === 'csv' && (
                <div style={{ border: '2px dashed #E5E7F1', borderRadius: 16, padding: '36px 24px', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Upload style={{ width: 22, height: 22, color: '#F56B22' }} />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 6 }}>Drop your Census CSV here</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginBottom: 16 }}>Supports .csv and .xlsx · One member per row</p>
                  <button style={{ height: 38, padding: '0 20px', fontSize: 13, fontWeight: 600, color: '#3A4382', border: '1px solid #C7D2FE', borderRadius: 12, background: '#EEF2FF', cursor: 'pointer' }}>
                    Browse File
                  </button>
                </div>
              )}

              {bulkAction === 'invite' && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Enrolment Scope for Links</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                    {([
                      { key: 'self',           label: 'Principal Only',        desc: 'Each staff enrols themselves' },
                      { key: 'self-dependent', label: 'Principal + Dependent', desc: 'Self-enrol with dependent option' },
                    ] as const).map((t) => (
                      <div key={t.key} onClick={() => setLinkScope(t.key)}
                        style={{ padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${linkScope === t.key ? '#10B981' : '#E5E7F1'}`, background: linkScope === t.key ? '#ECFDF5' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: linkScope === t.key ? '#059669' : '#131C4E', marginBottom: 3 }}>{t.label}</p>
                        <p style={{ fontSize: 11, color: '#9CA3B8' }}>{t.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ border: '2px dashed #BBFEF0', borderRadius: 16, padding: '36px 24px', textAlign: 'center', background: '#F0FFF9' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      <Upload style={{ width: 22, height: 22, color: '#10B981' }} />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 6 }}>Upload staff email list (CSV)</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', marginBottom: 16 }}>One email per row · We'll send a unique link to each</p>
                    <button style={{ height: 38, padding: '0 20px', fontSize: 13, fontWeight: 600, color: '#059669', border: '1px solid #BBF7D0', borderRadius: 12, background: '#ECFDF5', cursor: 'pointer' }}>
                      Browse File
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 44, padding: '0 22px', fontSize: 14, fontWeight: 600, color: '#9CA3B8', background: '#F7F8FA', border: 'none', borderRadius: 14, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit}
            style={{ height: 44, padding: '0 28px', fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', border: 'none', borderRadius: 14, cursor: 'pointer', boxShadow: '0 3px 12px rgba(245,107,34,0.35)' }}>
            {submitLabel}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Member 360 Drawer ───────────────────────────────────────────────── */
function Member360Drawer({ member, index, onClose }: { member: Member; index: number; onClose: () => void }) {
  const [drawerTab, setDrawerTab] = useState<'overview' | 'claims' | 'benefits'>('overview');
  const { toast } = useToast();
  const plan   = planColors[member.plan]     ?? { bg: '#F1F5F9', text: '#475569' };
  const status = statusColors[member.status] ?? { bg: '#F1F5F9', text: '#475569', dot: '#9CA3B8' };
  const grad   = avatarGradients[index % avatarGradients.length];
  const enroleeId = getEnroleeId(member.employeeId, member.type);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 460, background: '#fff', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Member 360</p>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3B8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F7F8FA'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Profile */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 17, background: grad }}>
              {member.firstName[0]}{member.lastName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#131C4E', lineHeight: 1.2 }}>{member.firstName} {member.lastName}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: '#F1F2F8', color: '#3A4382', padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace' }}>{member.employeeId}</span>
                <span style={{ fontSize: 10, fontWeight: 700, background: '#FFF3E8', color: '#F56B22', padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace' }}>{enroleeId}</span>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {[
              { Icon: Phone,    value: member.phone },
              { Icon: Mail,     value: member.email },
              { Icon: MapPin,   value: member.location },
              { Icon: Calendar, value: `Enrolled ${new Date(member.enrollmentDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}` },
            ].map(({ Icon, value }) => (
              <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 11, height: 11, color: '#9CA3B8' }} />
                </div>
                <span style={{ fontSize: 12, color: '#9CA3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          {[
            { label: 'Dependants',  value: String(member.dependants ?? 0), Icon: Users,       color: '#3A4382', bg: '#EEF2FF' },
            { label: 'Claims YTD',  value: '4',                            Icon: Activity,    color: '#F56B22', bg: '#FFF3E8' },
            { label: 'Utilization', value: '74%',                          Icon: ShieldCheck, color: '#10B981', bg: '#ECFDF5' },
          ].map((k, ki) => (
            <div key={k.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 8px', borderRight: ki < 2 ? '1px solid #F0F1F5' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}>
                <k.Icon style={{ width: 15, height: 15, color: k.color }} strokeWidth={1.75} />
              </div>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#131C4E', lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</p>
              <p style={{ fontSize: 10, color: '#9CA3B8', fontWeight: 500, marginTop: 3 }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0F1F5', flexShrink: 0, padding: '0 24px' }}>
          {(['overview', 'claims', 'benefits'] as const).map((tab) => (
            <button key={tab} onClick={() => setDrawerTab(tab)}
              style={{ padding: '13px 0', marginRight: 28, fontSize: 13, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'all 0.15s', color: drawerTab === tab ? '#F56B22' : '#9CA3B8', borderBottom: `2px solid ${drawerTab === tab ? '#F56B22' : 'transparent'}` }}>
              {tab === 'overview' ? 'Overview' : tab === 'claims' ? 'Claim History' : 'Benefits'}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── Overview ── */}
          {drawerTab === 'overview' && (
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#C4C9D9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Personal Details</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 20px', marginBottom: 24 }}>
                {[
                  { label: 'Date of Birth', value: new Date(member.dateOfBirth).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) },
                  { label: 'Gender',        value: member.gender },
                  { label: 'Plan',          value: member.plan },
                  { label: 'Member Type',   value: member.type },
                  { label: 'State',         value: member.location },
                  { label: 'Dependants',    value: String(member.dependants ?? 0) },
                ].map((row) => (
                  <div key={row.label}>
                    <p style={{ fontSize: 10, color: '#B0B7C9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{row.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>{row.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ height: 1, background: '#F0F1F5', marginBottom: 24 }} />

              <p style={{ fontSize: 10, fontWeight: 700, color: '#C4C9D9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Utilization · 2026</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Total Spend YTD',   value: '₦407,500',   color: '#131C4E' },
                  { label: 'Visits Count',       value: '4 visits',   color: '#131C4E' },
                  { label: 'Avg Per Visit',      value: '₦101,875',  color: '#131C4E' },
                  { label: 'Benefit Remaining',  value: '₦4,592,500', color: '#10B981' },
                ].map((r) => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: '#9CA3B8' }}>{r.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: r.color }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Claim History ── */}
          {drawerTab === 'claims' && (
            <div style={{ padding: '22px 24px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#C4C9D9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Recent Claims</p>
              <div>
                {mockClaimHistory.map((c, i) => {
                  const ic = categoryIconColors[c.category] ?? { bg: '#F7F8FA', color: '#9CA3B8' };
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < mockClaimHistory.length - 1 ? '1px solid #F7F8FA' : 'none' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: ic.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Activity style={{ width: 16, height: 16, color: ic.color }} strokeWidth={1.75} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.provider}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, background: ic.bg, color: ic.color, padding: '1px 7px', borderRadius: 20 }}>{c.category}</span>
                          <span style={{ fontSize: 10, color: '#B0B7C9' }}>{c.date}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#131C4E' }}>{c.amount}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '1px 7px', borderRadius: 20 }}>{c.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button style={{ width: '100%', marginTop: 16, height: 42, fontSize: 13, fontWeight: 600, color: '#3A4382', border: '1px solid #C7D2FE', borderRadius: 14, background: '#EEF2FF', cursor: 'pointer' }}>
                View All Claims →
              </button>
            </div>
          )}

          {/* ── Benefits ── */}
          {drawerTab === 'benefits' && (
            <div style={{ padding: '22px 24px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#C4C9D9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Benefit Limits · {member.plan}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {[
                  { cat: 'Outpatient', limit: '₦5,000,000', used: '₦28,500',   pct: 1,  color: '#F56B22' },
                  { cat: 'Inpatient',  limit: '₦5,000,000', used: '₦312,000',  pct: 6,  color: '#2563EB' },
                  { cat: 'Dental',     limit: '₦150,000',   used: '₦45,000',   pct: 30, color: '#F59E0B' },
                  { cat: 'Optical',    limit: '₦80,000',    used: '₦22,000',   pct: 28, color: '#7C3AED' },
                  { cat: 'Maternity',  limit: '₦400,000',   used: '₦0',        pct: 0,  color: '#EC4899' },
                ].map((b) => {
                  const barColor = b.pct > 80 ? '#EF4444' : b.pct > 50 ? '#F59E0B' : b.color;
                  return (
                    <div key={b.cat}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, display: 'block', flexShrink: 0 }} />
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{b.cat}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#131C4E' }}>{b.used}</span>
                          <span style={{ fontSize: 11, color: '#B0B7C9' }}> / {b.limit}</span>
                        </div>
                      </div>
                      <div style={{ height: 6, background: '#F0F1F5', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: barColor, width: `${b.pct}%`, minWidth: b.pct > 0 ? 6 : 0, transition: 'width 0.4s' }} />
                      </div>
                      <p style={{ fontSize: 10, color: '#B0B7C9', marginTop: 4 }}>{b.pct}% utilised</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F0F1F5', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Send Enrolee ID row */}
          <button
            onClick={() => toast(`Enrolee ID ${enroleeId} sent to ${member.email}.`, 'info')}
            style={{ width: '100%', height: 42, fontSize: 13, fontWeight: 600, color: '#3A4382', border: '1px solid #C7D2FE', borderRadius: 14, background: 'linear-gradient(135deg,#F8F9FF,#EEF2FF)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Send style={{ width: 14, height: 14 }} /> Send Enrolee ID via Email
          </button>
          {/* Secondary actions row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => toast('Member record opened for editing.')}
              style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#3A4382', border: '1px solid #C7D2FE', borderRadius: 14, background: '#EEF2FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              Edit Member
            </button>
            <button
              onClick={() => toast("E-Card sent to member's email.")}
              style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 14, background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <CreditCard style={{ width: 14, height: 14 }} /> E-Card
            </button>
            <button
              onClick={() => { toast('Member terminated successfully.', 'error'); onClose(); }}
              style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#EF4444,#DC2626)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 2px 8px rgba(239,68,68,0.28)' }}>
              <AlertCircle style={{ width: 14, height: 14 }} /> Terminate
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Synthetic dependants for beneficiaries view ─────────────────────── */
const depFirstNames = ['Chioma', 'Ngozi', 'Emeka Jr', 'Tunde Jr', 'Kemi', 'Blessing', 'David', 'Grace'];
const mockBeneficiaries: Member[] = mockMembers.flatMap((m, mi) => {
  const rows: Member[] = [m];
  if (m.type === 'Principal' && (m.dependants ?? 0) > 0) {
    const count = Math.min(m.dependants ?? 0, 2);
    for (let i = 0; i < count; i++) {
      rows.push({
        ...m,
        id: `${m.id}-dep-${i}`,
        firstName: depFirstNames[(mi * 2 + i) % depFirstNames.length],
        lastName: m.lastName,
        email: `dep.${m.lastName.toLowerCase()}${i + 1}@personal.com`,
        type: 'Dependant',
        dependants: 0,
      });
    }
  }
  return rows;
});

/* ── Members Page ────────────────────────────────────────────────────── */
export default function MembersPage() {
  const [search, setSearch]               = useState('');
  const [planFilter, setPlanFilter]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [selected, setSelected]           = useState<string[]>([]);
  const [activeMember, setActiveMember]   = useState<{ member: Member; index: number } | null>(null);
  const [showAddModal, setShowAddModal]   = useState<false | 'individual' | 'bulk'>(false);
  const [viewBeneficiaries, setViewBeneficiaries] = useState(false);
  const { toast } = useToast();

  const sourceList = viewBeneficiaries ? mockBeneficiaries : mockMembers;

  const filtered = sourceList.filter((m) => {
    const q = search.toLowerCase();
    return (!q || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || m.employeeId.toLowerCase().includes(q) || m.phone.includes(q))
      && (!planFilter || m.plan === planFilter)
      && (!statusFilter || m.status === statusFilter);
  });

  const toggleSelect = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const allSelected  = filtered.length > 0 && selected.length === filtered.length;
  const someSelected = selected.length > 0 && !allSelected;
  const toggleAll    = () => setSelected(allSelected ? [] : filtered.map((m) => m.id));

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const principalCount = mockBeneficiaries.filter((m) => m.type === 'Principal').length;
  const dependantCount = mockBeneficiaries.filter((m) => m.type === 'Dependant').length;

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="People" subtitle="Member Management · 1,842 active lives" />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Summary cards — 3 columns (Pending Terminations removed) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {summaryCards.map((c) => (
            <div key={c.label} style={{ ...card, padding: '22px 22px 22px 20px', borderLeft: `3px solid ${c.color}` }}>
              <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 10, color: '#131C4E' }}>{c.value}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', marginBottom: 3 }}>{c.label}</p>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#9CA3B8' }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 440 }}>
              <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#C4C9D9' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or phone..."
                style={{ width: '100%', height: 42, paddingLeft: 44, paddingRight: 16, fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
            </div>
            {[
              { value: planFilter,   setter: setPlanFilter,   options: ['All Plans','Plus Plan','Pro Plan','Max Plan','Promax Plan','Magnum Plan'] },
              { value: statusFilter, setter: setStatusFilter, options: ['All Status','Active','Pending','Terminated'] },
            ].map(({ value, setter, options }) => (
              <select key={options[0]} value={value} onChange={(e) => setter(e.target.value)}
                style={{ height: 42, padding: '0 34px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
                {options.map((o) => <option key={o} value={o === options[0] ? '' : o}>{o}</option>)}
              </select>
            ))}
            <div style={{ flex: 1 }} />

            {/* View toggle: Members / All Beneficiaries */}
            <div style={{ display: 'flex', background: '#F7F8FC', borderRadius: 12, padding: 3, border: '1px solid #E5E7F1', gap: 2 }}>
              {([false, true] as const).map((val) => (
                <button key={String(val)} onClick={() => setViewBeneficiaries(val)}
                  style={{
                    height: 34, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 9, border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                    background: viewBeneficiaries === val ? '#fff' : 'transparent',
                    color: viewBeneficiaries === val ? '#131C4E' : '#9CA3B8',
                    boxShadow: viewBeneficiaries === val ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  {val ? 'All Beneficiaries' : 'Members'}
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 28, background: '#E5E7F1' }} />
            <button onClick={() => setShowAddModal('bulk')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontSize: 13, fontWeight: 500, color: '#3A4382', border: '1px solid #E5E7F1', borderRadius: 14, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Upload style={{ width: 15, height: 15 }} /> Bulk Upload
            </button>
            <button onClick={() => toast('Member list exported to Excel.')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <ArrowDownToLine style={{ width: 15, height: 15 }} /> Export XLS
            </button>
            <button onClick={() => setShowAddModal('individual')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 22px', fontSize: 13, fontWeight: 700, color: '#fff', borderRadius: 24, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 3px 12px rgba(245,107,34,0.35)', whiteSpace: 'nowrap' }}>
              <Plus style={{ width: 16, height: 16 }} /> Add Member
            </button>
          </div>
        </div>

        {/* Beneficiaries summary banner */}
        {viewBeneficiaries && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 14 }}>
            <Users style={{ width: 18, height: 18, color: '#0284C7', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0C4A6E' }}>
              All Beneficiaries View — {principalCount} principals + {dependantCount} dependants = {principalCount + dependantCount} total covered lives
            </span>
            <span style={{ fontSize: 12, color: '#38BDF8', marginLeft: 'auto' }}>Showing all covered lives including dependants</span>
          </div>
        )}

        {/* Bulk actions */}
        {selected.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #FFD8C0', boxShadow: '0 4px 16px rgba(245,107,34,0.10)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800 }}>{selected.length}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>member{selected.length > 1 ? 's' : ''} selected</span>
            </div>
            <div style={{ width: 1, height: 24, background: '#F0F1F5', flexShrink: 0, margin: '0 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
              {[
                { label: 'Approve Additions',   Icon: Plus,            color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
                { label: 'Send Enrolee IDs',     Icon: Send,            color: '#3730A3', bg: '#EEF2FF', border: '#C7D2FE' },
                { label: 'Download E-Cards',     Icon: CreditCard,      color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
                { label: 'Export List',          Icon: ArrowDownToLine, color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
                { label: 'Send Invite Links',    Icon: Link2,           color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                { label: 'Request Correction',   Icon: FileText,        color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
              ].map(({ label, Icon, color, bg, border }) => (
                <button key={label}
                  onClick={() => toast(`${label} action applied to ${selected.length} member${selected.length > 1 ? 's' : ''}.`, 'info')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 14, border: `1px solid ${border}`, background: bg, color, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Icon style={{ width: 13, height: 13 }} /> {label}
                </button>
              ))}
            </div>
            <button onClick={() => setSelected([])} style={{ fontSize: 12, fontWeight: 500, color: '#9CA3B8', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, flexShrink: 0 }}>✕ Clear</button>
          </div>
        )}

        {/* Members / Beneficiaries table */}
        <div style={{ ...card }}>
          <div className="grid items-center border-b border-[#F0F1F5] bg-[#FAFBFC]"
            style={{ gridTemplateColumns: '36px 1fr 88px 132px 118px 76px 108px 120px 96px', columnGap: 12, padding: '12px 24px', color: '#B0B7C9', letterSpacing: '0.07em', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} title="Select all" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} onClick={toggleAll} title="Click to select all">
              <span className="text-[10.5px] font-bold text-[#9CA3B8] uppercase tracking-widest select-none">
                {viewBeneficiaries ? 'Beneficiary' : 'Member'}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#C4C9D9', background: '#F0F1F5', padding: '1px 5px', borderRadius: 4, letterSpacing: '0.04em' }}>SELECT ALL</span>
            </div>
            {['Emp ID', 'Enrolee ID', 'Plan', 'Type', 'Status', 'Phone', 'Location'].map((h) => (
              <span key={h} className="text-[10.5px] font-bold uppercase">{h}</span>
            ))}
          </div>

          {filtered.map((m, i) => {
            const plan   = planColors[m.plan]     ?? { bg: '#F1F5F9', text: '#475569' };
            const status = statusColors[m.status] ?? { bg: '#F1F5F9', text: '#475569', dot: '#9CA3B8' };
            const isSel  = selected.includes(m.id);
            const enroleeId = getEnroleeId(m.employeeId, m.type);
            const isDependant = m.type === 'Dependant';
            return (
              <div
                key={m.id}
                className={`grid items-center border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] cursor-pointer transition-colors ${isSel ? 'bg-[#FFF8F5]' : ''}`}
                style={{ gridTemplateColumns: '36px 1fr 88px 132px 118px 76px 108px 120px 96px', columnGap: 12, padding: '16px 24px', borderLeft: isDependant && viewBeneficiaries ? '3px solid #E0E7FF' : '3px solid transparent' }}
                onClick={() => setActiveMember({ member: m, index: i })}
              >
                <Checkbox checked={isSel} onChange={() => toggleSelect(m.id)} onClick={(e) => e.stopPropagation()} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {isDependant && viewBeneficiaries && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#6366F1', background: '#EEF2FF', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>DEP</span>
                  )}
                  <p className="text-[13px] font-semibold text-[#131C4E] truncate">{m.firstName} {m.lastName}</p>
                </div>
                <span className="text-[11px] text-[#9CA3B8] font-mono">{m.employeeId}</span>
                <span className="text-[11px] text-[#131C4E] font-mono font-semibold">{enroleeId}</span>
                <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: plan.bg, color: plan.text }}>{m.plan}</span>
                <span className="text-[11px]" style={{ color: isDependant ? '#6366F1' : '#9CA3B8', fontWeight: isDependant ? 600 : 400 }}>{m.type}</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: status.bg, color: status.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />{m.status}
                </span>
                <span className="text-[11px] text-[#9CA3B8]">{m.phone}</span>
                <span className="text-[11px] text-[#9CA3B8]">{m.location}</span>
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid #F0F1F5', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
            <p className="text-[12px] text-[#9CA3B8]">
              Showing {filtered.length} of {viewBeneficiaries ? `${principalCount + dependantCount} beneficiaries` : '1,842 members'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {(['‹', '1', '2', '3', '›'] as const).map((p) => (
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

      {activeMember && (
        <Member360Drawer
          member={activeMember.member}
          index={activeMember.index}
          onClose={() => setActiveMember(null)}
        />
      )}

      {showAddModal && (
        <AddMemberModal
          initialMode={showAddModal}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
