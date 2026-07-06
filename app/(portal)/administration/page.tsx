'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, ArrowDownToLine, Phone, Mail, Upload, Eye, EyeOff, Bell, User, Building2, Shield, X, Check, Loader2, ClipboardList, Pencil } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';

const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  'Admin':      { bg: '#FFF1E6', text: '#F56B22', border: '#FFD8C0' },
  'HR Manager': { bg: '#EEF2FF', text: '#3730A3', border: '#C7D2FE' },
  'hr_admin':   { bg: '#EEF2FF', text: '#3730A3', border: '#C7D2FE' },
  'Finance':    { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  'Viewer':     { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
};

const roleCards = [
  { role: 'Admin',      desc: 'Full access to all modules' },
  { role: 'HR Manager', desc: 'Members · Benefits · Reports · Requests' },
  { role: 'Finance',    desc: 'Finance module & Finance Reports only' },
  { role: 'Viewer',     desc: 'View only · No edits or submissions' },
];

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  purple: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  teal:   { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
  rose:   { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  slate:  { bg: '#F1F5F9', text: '#334155', border: '#CBD5E1' },
};

const MODULE_LIST: { label: string; key: string }[] = [
  { label: 'Dashboard',    key: 'dashboard' },
  { label: 'Members',      key: 'members' },
  { label: 'Benefits',     key: 'benefits' },
  { label: 'Finance',      key: 'finance' },
  { label: 'Claims',       key: 'claims' },
  { label: 'Reports',      key: 'reports' },
  { label: 'Service Desk', key: 'serviceDesk' },
];

const faqs = [
  'How do I add a new member to the scheme?',
  'How do I download e-cards in bulk?',
  'What is the waiting period for maternity benefits?',
  'How do I dispute a claim?',
  "How do I change a member's plan?",
];

const downloads = [
  { name: 'Member Upload Template', type: 'Excel', updated: 'Jun 2026' },
  { name: 'Provider List',          type: 'Excel', updated: 'Jun 2026' },
  { name: 'User Guide',             type: 'PDF',   updated: 'v1.2' },
  { name: 'Benefit Guide',          type: 'PDF',   updated: '2026 Edition' },
];

const planColors: Record<string, { bg: string; text: string }> = {
  'Plus Plan':   { bg: '#FFF7ED', text: '#C2410C' },
  'Pro Plan':    { bg: '#F1F5F9', text: '#475569' },
  'Max Plan':    { bg: '#FFFBEB', text: '#D97706' },
  'Promax Plan': { bg: '#EFF6FF', text: '#2563EB' },
  'Magnum Plan': { bg: '#F5F3FF', text: '#6D28D9' },
};

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: on ? '#F56B22' : '#E5E7F1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s', display: 'block' }} />
    </button>
  );
}

interface CompanyProfile {
  companyName: string;
  companyId: string;
  policyNumber: string;
  user: { name: string; email: string; role: string };
  scheme: {
    policyStart: string;
    policyEnd: string;
    policyStartFmt: string;
    policyEndFmt: string;
    activeSince: string;
    activePlans: string[];
  };
}

interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
  lastLogin: string | null;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  userRole: string;
  action: string;
  resource: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
}

type Tab = 'users' | 'profile' | 'account' | 'help' | 'audit';

function formatLastLogin(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRoleLabel(role: string): string {
  if (role === 'hr_admin') return 'HR Manager';
  return role;
}

export default function AdministrationPage() {
  const [activeTab, setActiveTab]   = useState<Tab>('users');
  const [openFaq, setOpenFaq]       = useState<number | null>(null);
  const [logoUrl, setLogoUrl]       = useState<string | null>(null);
  const [logoDrag, setLogoDrag]     = useState(false);
  const fileRef                     = useRef<HTMLInputElement>(null);

  // Live data state
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [portalUsers, setPortalUsers]       = useState<PortalUser[]>([]);
  const [loading, setLoading]               = useState(true);
  const [auditLogs, setAuditLogs]           = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal]         = useState(0);
  const [auditLoading, setAuditLoading]     = useState(false);
  const [togglingUser, setTogglingUser]     = useState<string | null>(null);

  const [notifications, setNotifications] = useState({ invoiceIssued: true, invoiceDue: true, claimUpdates: false, enrolmentConfirm: true, bulkUpload: true });
  const [passwords, setPasswords]   = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw]         = useState({ current: false, next: false, confirm: false });
  const [pwSaved, setPwSaved]       = useState(false);
  const [pwError, setPwError]       = useState('');
  const [pwSaving, setPwSaving]     = useState(false);

  async function handleChangePassword() {
    setPwError(''); setPwSaved(false);
    if (!passwords.current || !passwords.next || !passwords.confirm) { setPwError('All password fields are required.'); return; }
    if (passwords.next !== passwords.confirm) { setPwError('New passwords do not match.'); return; }
    setPwSaving(true);
    try {
      const res = await fetch('/api/hr/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next, confirmPassword: passwords.confirm }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPwError(json.error ?? 'Failed to change password.');
      } else {
        setPwSaved(true);
        setPasswords({ current: '', next: '', confirm: '' });
        setTimeout(() => setPwSaved(false), 2500);
      }
    } catch {
      setPwError('Network error. Please try again.');
    } finally {
      setPwSaving(false);
    }
  }
  const [profileSaved, setProfileSaved] = useState(false);

  // 2FA state — twoFaActive mirrors the persisted server-side setting
  const [twoFaEnabled, setTwoFaEnabled] = useState(false); // wizard open
  const [twoFaSetup, setTwoFaSetup]     = useState<'choose' | 'scan'>('choose');
  const [twoFaMethod, setTwoFaMethod]   = useState<'email' | 'sms'>('email');
  const [twoFaCode, setTwoFaCode]       = useState('');
  const [twoFaActive, setTwoFaActive]   = useState(false);
  const [twoFaError, setTwoFaError]     = useState('');
  const [twoFaBusy, setTwoFaBusy]       = useState(false);
  const [disablePw, setDisablePw]       = useState('');
  const [showDisable, setShowDisable]   = useState(false);

  useEffect(() => {
    fetch('/api/hr/2fa').then((r) => r.json()).then((d) => {
      if (typeof d.enabled === 'boolean') setTwoFaActive(d.enabled);
    }).catch(() => {});
  }, []);

  async function start2FaSetup() {
    setTwoFaError(''); setTwoFaBusy(true);
    try {
      const res = await fetch('/api/hr/2fa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      });
      const json = await res.json();
      if (!res.ok) { setTwoFaError(json.error ?? 'Could not send the code.'); return false; }
      return true;
    } catch { setTwoFaError('Network error. Please try again.'); return false; }
    finally { setTwoFaBusy(false); }
  }

  async function verify2Fa() {
    setTwoFaError(''); setTwoFaBusy(true);
    try {
      const res = await fetch('/api/hr/2fa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code: twoFaCode }),
      });
      const json = await res.json();
      if (!res.ok) { setTwoFaError(json.error ?? 'Incorrect code.'); return; }
      setTwoFaActive(true); setTwoFaEnabled(false); setTwoFaCode('');
    } catch { setTwoFaError('Network error. Please try again.'); }
    finally { setTwoFaBusy(false); }
  }

  async function disable2Fa() {
    setTwoFaError(''); setTwoFaBusy(true);
    try {
      const res = await fetch('/api/hr/2fa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', password: disablePw }),
      });
      const json = await res.json();
      if (!res.ok) { setTwoFaError(json.error ?? 'Could not disable 2FA.'); return; }
      setTwoFaActive(false); setShowDisable(false); setDisablePw('');
    } catch { setTwoFaError('Network error. Please try again.'); }
    finally { setTwoFaBusy(false); }
  }

  // Custom roles state — persisted to localStorage so they survive refresh
  type CustomRole = { id: string; role: string; desc: string; colorKey: string; modules?: Record<string, boolean> };
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState('');
  const blankRoleForm = { name: '', desc: '', colorKey: 'purple', modules: { dashboard: true, members: true, benefits: false, finance: false, claims: false, reports: false, serviceDesk: false } };
  const [roleForm, setRoleForm] = useState(blankRoleForm);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('lw_custom_roles');
      if (stored) setCustomRoles(JSON.parse(stored));
    } catch { /* corrupt storage — start fresh */ }
    setRolesLoaded(true);
  }, []);
  useEffect(() => {
    if (rolesLoaded) localStorage.setItem('lw_custom_roles', JSON.stringify(customRoles));
  }, [customRoles, rolesLoaded]);

  function openEditRole(r: CustomRole) {
    setRoleForm({
      name: r.role,
      desc: r.desc,
      colorKey: r.colorKey,
      modules: { ...blankRoleForm.modules, ...(r.modules ?? {}) },
    });
    setEditingRoleId(r.id);
    setShowRoleForm(true);
    setRoleError('');
  }

  function deleteRole(r: CustomRole) {
    const assigned = portalUsers.filter((u) => u.role === r.role).length;
    if (assigned > 0) {
      setRoleError(`Cannot delete "${r.role}" — ${assigned} user${assigned !== 1 ? 's are' : ' is'} assigned to it. Reassign ${assigned !== 1 ? 'them' : 'the user'} first, or edit the role instead.`);
      return;
    }
    setRoleError('');
    setCustomRoles(customRoles.filter((cr) => cr.id !== r.id));
    if (editingRoleId === r.id) { setEditingRoleId(null); setShowRoleForm(false); setRoleForm(blankRoleForm); }
  }

  function saveRole() {
    if (!roleForm.name.trim()) return;
    const name = roleForm.name.trim();
    // Prevent duplicate role names (built-in or custom, excluding the one being edited)
    const clash = roleCards.some((rc) => rc.role.toLowerCase() === name.toLowerCase())
      || customRoles.some((cr) => cr.id !== editingRoleId && cr.role.toLowerCase() === name.toLowerCase());
    if (clash) { setRoleError(`A role named "${name}" already exists.`); return; }
    setRoleError('');

    const enabledMods = MODULE_LIST.filter(({ key }) => roleForm.modules[key as keyof typeof roleForm.modules]).map(({ label }) => label);
    const desc = roleForm.desc.trim() || (enabledMods.length ? enabledMods.join(' · ') : 'No module access');

    if (editingRoleId) {
      setCustomRoles(customRoles.map((cr) => cr.id === editingRoleId
        ? { ...cr, role: name, desc, colorKey: roleForm.colorKey, modules: { ...roleForm.modules } }
        : cr));
    } else {
      setCustomRoles([...customRoles, { id: String(Date.now()), role: name, desc, colorKey: roleForm.colorKey, modules: { ...roleForm.modules } }]);
    }
    setRoleForm(blankRoleForm);
    setEditingRoleId(null);
    setShowRoleForm(false);
  }

  // Invite user state
  const [showInvite, setShowInvite]   = useState(false);
  const [inviteForm, setInviteForm]   = useState({ name: '', email: '', role: 'Viewer' });
  const [inviteBusy, setInviteBusy]   = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSent, setInviteSent]   = useState('');

  async function sendInvite() {
    setInviteError(''); setInviteSent('');
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) { setInviteError('Name and email are required.'); return; }
    setInviteBusy(true);
    try {
      const res = await fetch('/api/hr/portal-users/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const json = await res.json();
      if (!res.ok) { setInviteError(json.error ?? 'Failed to send invitation.'); return; }
      setInviteSent(json.emailSent
        ? `Invitation sent to ${inviteForm.email}.`
        : `Account created for ${inviteForm.email}, but the email could not be sent — try again or contact support.`);
      setInviteForm({ name: '', email: '', role: 'Viewer' });
      // Refresh the users table so the pending account appears
      fetch('/api/hr/portal-users').then((r) => r.json()).then((d) => { if (d.users) setPortalUsers(d.users); }).catch(() => {});
    } catch { setInviteError('Network error. Please try again.'); }
    finally { setInviteBusy(false); }
  }

  // Profile form — initialised from API data
  const [profile, setProfile] = useState({ displayName: '', jobTitle: '', email: '', phone: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/hr/company-profile').then((r) => r.json()),
      fetch('/api/hr/portal-users').then((r) => r.json()),
    ]).then(([profileData, usersData]) => {
      if (profileData && !profileData.error) {
        setCompanyProfile(profileData as CompanyProfile);
        setProfile((prev) => ({
          ...prev,
          displayName: profileData.user?.name  || prev.displayName,
          email:       profileData.user?.email || prev.email,
        }));
      }
      if (usersData?.users) {
        setPortalUsers(usersData.users as PortalUser[]);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function loadAuditLogs() {
    setAuditLoading(true);
    fetch('/api/hr/audit-logs?limit=100')
      .then((r) => r.json())
      .then((data) => {
        if (data.logs) { setAuditLogs(data.logs); setAuditTotal(data.total ?? data.logs.length); }
        setAuditLoading(false);
      })
      .catch(() => setAuditLoading(false));
  }

  async function toggleUserStatus(user: PortalUser) {
    setTogglingUser(user.id);
    try {
      const res = await fetch('/api/hr/portal-users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, active: user.status !== 'Active' }),
      });
      if (res.ok) {
        setPortalUsers((prev) => prev.map((u) => u.id === user.id
          ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' }
          : u));
      }
    } finally {
      setTogglingUser(null);
    }
  }

  function handleLogoFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => setLogoUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setLogoDrag(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleLogoFile(file);
  }

  const card = { background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'users',   label: 'Users & Access' },
    { key: 'profile', label: 'Company Profile' },
    { key: 'account', label: 'My Account' },
    { key: 'help',    label: 'Help & Downloads' },
    { key: 'audit',   label: 'Audit Trail' },
  ];

  const inputStyle: React.CSSProperties = { width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' };
  const readonlyStyle: React.CSSProperties = { ...inputStyle, background: '#F7F8FC', color: '#6B7280', cursor: 'default' };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' };

  const cp = companyProfile;

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Administration" subtitle="Users · Company Profile · My Account · Help" />
      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* TAB SWITCHER */}
        <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 4, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 'fit-content' }}>
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => { setActiveTab(key); if (key === 'audit' && auditLogs.length === 0) loadAuditLogs(); }}
              style={{ padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: activeTab === key ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : 'transparent',
                color: activeTab === key ? '#fff' : '#6B7280',
                boxShadow: activeTab === key ? '0 2px 8px rgba(245,107,34,0.28)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── USERS & ACCESS ── */}
        {activeTab === 'users' && (
          <>
            <div style={{ ...card, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Access Roles</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>Define what each user can see and do in the portal</p>
                </div>
                <button onClick={() => { setShowRoleForm(!showRoleForm); setRoleForm(blankRoleForm); setEditingRoleId(null); setRoleError(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 18px', fontSize: 12, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', background: showRoleForm ? '#6B7280' : 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: showRoleForm ? 'none' : '0 2px 8px rgba(245,107,34,0.28)' }}>
                  {showRoleForm ? <X style={{ width: 13, height: 13 }} /> : <Plus style={{ width: 13, height: 13 }} />}
                  {showRoleForm ? 'Cancel' : 'Define Role'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {roleCards.map((r) => {
                  const c = roleColors[r.role] ?? roleColors['Viewer'];
                  return (
                    <div key={r.role} style={{ padding: '18px 18px 14px 16px', borderRadius: 12, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.text}`, background: c.bg }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 5 }}>{r.role}</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', lineHeight: 1.6, marginBottom: 10 }}>{r.desc}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: c.text }}>Built-in</span>
                    </div>
                  );
                })}
                {customRoles.map((r) => {
                  const c = ROLE_COLORS[r.colorKey] ?? ROLE_COLORS['slate'];
                  const assignedCount = portalUsers.filter((u) => u.role === r.role).length;
                  return (
                    <div key={r.id} style={{ padding: '18px 18px 14px 16px', borderRadius: 12, border: `1.5px solid ${c.border}`, borderLeft: `3px solid ${c.text}`, background: '#fff', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 8 }}>
                        <button onClick={() => openEditRole(r)} title="Edit role"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3B8', padding: 0, lineHeight: 0 }}>
                          <Pencil style={{ width: 13, height: 13 }} />
                        </button>
                        <button onClick={() => deleteRole(r)} title={assignedCount > 0 ? 'Reassign users before deleting' : 'Delete role'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: assignedCount > 0 ? '#E8CFCF' : '#D1D5DB', padding: 0, lineHeight: 0 }}>
                          <X style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 5 }}>{r.role}</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', lineHeight: 1.6, marginBottom: 10 }}>{r.desc || '—'}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.text }}>Custom</span>
                        {assignedCount > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3B8' }}>{assignedCount} user{assignedCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {roleError && (
                <div style={{ marginTop: 14, fontSize: 12, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{roleError}</div>
              )}

              {showRoleForm && (
                <div style={{ marginTop: 20, padding: '20px', background: '#FAFBFC', borderRadius: 14, border: '1px solid #EDEEF2' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 16 }}>{editingRoleId ? 'Edit Role' : 'New Role'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>Role Name</label>
                      <input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="e.g. Branch HR" style={inputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Description (optional)</label>
                      <input value={roleForm.desc} onChange={(e) => setRoleForm({ ...roleForm, desc: e.target.value })} placeholder="e.g. View Members & Claims only" style={inputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Role Colour</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {Object.entries(ROLE_COLORS).map(([key, c]) => (
                        <button key={key} onClick={() => setRoleForm({ ...roleForm, colorKey: key })}
                          style={{ width: 30, height: 30, borderRadius: 8, background: c.bg, border: `2px solid ${roleForm.colorKey === key ? c.text : c.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s' }}>
                          {roleForm.colorKey === key && <Check style={{ width: 13, height: 13, color: c.text }} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>Module Access</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {MODULE_LIST.map(({ label: mod, key }) => {
                        const on = roleForm.modules[key as keyof typeof roleForm.modules];
                        return (
                          <button key={key} onClick={() => setRoleForm({ ...roleForm, modules: { ...roleForm.modules, [key]: !on } })}
                            style={{ height: 30, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 99, border: `1.5px solid ${on ? '#F56B22' : '#E5E7F1'}`, background: on ? '#FFF5EF' : '#fff', color: on ? '#F56B22' : '#9CA3B8', cursor: 'pointer', transition: 'all 0.15s' }}>
                            {on ? '✓ ' : ''}{mod}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={saveRole}
                      style={{ height: 38, padding: '0 24px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', boxShadow: '0 2px 8px rgba(245,107,34,0.28)' }}>
                      {editingRoleId ? 'Save Changes' : 'Save Role'}
                    </button>
                    <button onClick={() => { setShowRoleForm(false); setRoleForm(blankRoleForm); setEditingRoleId(null); setRoleError(''); }}
                      style={{ height: 38, padding: '0 18px', fontSize: 13, fontWeight: 600, background: '#fff', color: '#9CA3B8', border: '1px solid #E5E7F1', borderRadius: 20, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PORTAL USERS TABLE */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Portal Users</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>
                    {loading ? 'Loading…' : `${portalUsers.length} user${portalUsers.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <button onClick={() => { setShowInvite(!showInvite); setInviteError(''); setInviteSent(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: 'pointer', background: showInvite ? '#6B7280' : 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: showInvite ? 'none' : '0 2px 10px rgba(245,107,34,0.32)' }}>
                  {showInvite ? <X style={{ width: 15, height: 15 }} /> : <Plus style={{ width: 15, height: 15 }} />}
                  {showInvite ? 'Close' : 'Invite User'}
                </button>
              </div>

              {showInvite && (
                <div style={{ padding: '20px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px auto', gap: 12, alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Full Name</label>
                      <input value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="e.g. Ada Obi"
                        style={{ width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 12, background: '#fff', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Email Address</label>
                      <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="colleague@company.com"
                        style={{ width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 12, background: '#fff', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Role</label>
                      <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                        style={{ width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 12, background: '#fff', color: '#131C4E', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                        {roleCards.map((r) => <option key={r.role} value={r.role}>{r.role}</option>)}
                        {customRoles.map((r) => <option key={r.id} value={r.role}>{r.role} (Custom)</option>)}
                      </select>
                    </div>
                    <button onClick={sendInvite} disabled={inviteBusy}
                      style={{ height: 42, padding: '0 22px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 12, cursor: inviteBusy ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 2px 8px rgba(245,107,34,0.28)', opacity: inviteBusy ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                      {inviteBusy ? 'Sending…' : 'Send Invitation'}
                    </button>
                  </div>
                  {inviteError && <p style={{ marginTop: 10, fontSize: 12, color: '#DC2626' }}>{inviteError}</p>}
                  {inviteSent && <p style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: '#059669' }}>✓ {inviteSent}</p>}
                  <p style={{ marginTop: 10, fontSize: 11, color: '#B0B7C9' }}>The invitee receives an email link to set their password. Their account stays inactive until they do. Invitation links expire after 7 days.</p>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px 160px 130px', columnGap: 12, padding: '10px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                {['User', 'Role', 'Last Activity', 'Status', ''].map((h) => (
                  <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 10, color: '#9CA3B8' }}>
                  <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13 }}>Loading users…</span>
                </div>
              ) : portalUsers.length === 0 ? (
                <div style={{ padding: '32px 24px', color: '#9CA3B8', fontSize: 13 }}>No portal users found.</div>
              ) : (
                portalUsers.map((u) => {
                  const displayRole = formatRoleLabel(u.role);
                  const rc = roleColors[displayRole] ?? roleColors['Viewer'];
                  return (
                    <div key={u.id}
                      style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px 160px 130px', columnGap: 12, alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #F7F8FA', transition: 'background 0.12s' }}
                      className="last:border-0 hover:bg-[#FAFBFC]">
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{u.name}</p>
                        <p style={{ fontSize: 11, color: '#B8BFD0', marginTop: 2 }}>{u.email}</p>
                      </div>
                      <span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: rc.bg, color: rc.text, width: 'fit-content' }}>{displayRole}</span>
                      <span style={{ fontSize: 12, color: '#9CA3B8' }}>{formatLastLogin(u.lastLogin)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: u.status === 'Active' ? '#ECFDF5' : '#F7F8FA',
                        color:      u.status === 'Active' ? '#059669'  : '#9CA3B8',
                        width: 'fit-content' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.status === 'Active' ? '#10B981' : '#D1D5DB' }} />
                        {u.status}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ height: 30, padding: '0 12px', fontSize: 11, fontWeight: 500, color: '#3A4382', border: '1px solid #E5E7F1', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Edit</button>
                        <button
                          disabled={togglingUser === u.id}
                          onClick={() => toggleUserStatus(u)}
                          style={{ height: 30, padding: '0 12px', fontSize: 11, fontWeight: 500, color: u.status === 'Active' ? '#EF4444' : '#059669', border: `1px solid ${u.status === 'Active' ? '#FECACA' : '#A7F3D0'}`, borderRadius: 8, background: u.status === 'Active' ? '#FEF2F2' : '#ECFDF5', cursor: togglingUser === u.id ? 'wait' : 'pointer', opacity: togglingUser === u.id ? 0.6 : 1 }}>
                          {togglingUser === u.id ? '…' : u.status === 'Active' ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── COMPANY PROFILE ── */}
        {activeTab === 'profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* LOGO UPLOAD */}
              <div style={{ ...card, padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FFF1E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 style={{ width: 16, height: 16, color: '#F56B22' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Company Logo</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 1 }}>Appears in the portal sidebar and header</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ width: 88, height: 88, borderRadius: 20, border: '2px dashed #E5E7F1', background: '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {logoUrl
                      ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: 22, fontWeight: 900, color: '#C4C9D9', letterSpacing: '-0.04em' }}>
                          {cp?.companyName?.slice(0, 2).toUpperCase() || 'GN'}
                        </span>}
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setLogoDrag(true); }}
                    onDragLeave={() => setLogoDrag(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    style={{ flex: 1, height: 88, border: `2px dashed ${logoDrag ? '#F56B22' : '#E5E7F1'}`, borderRadius: 16, background: logoDrag ? '#FFF5EF' : '#FAFBFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.15s' }}>
                    <Upload style={{ width: 20, height: 20, color: logoDrag ? '#F56B22' : '#C4C9D9' }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: logoDrag ? '#F56B22' : '#131C4E' }}>Drop logo here or <span style={{ color: '#F56B22' }}>click to browse</span></p>
                    <p style={{ fontSize: 11, color: '#9CA3B8' }}>PNG, JPG or SVG · Max 300 KB</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }} />
                </div>
                {logoUrl && (
                  <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                    <button style={{ height: 36, padding: '0 18px', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: '0 2px 8px rgba(245,107,34,0.28)' }}>Save Logo</button>
                    <button onClick={() => setLogoUrl(null)} style={{ height: 36, padding: '0 18px', fontSize: 12, fontWeight: 600, background: '#fff', color: '#9CA3B8', border: '1px solid #E5E7F1', borderRadius: 10, cursor: 'pointer' }}>Remove</button>
                  </div>
                )}
              </div>

              {/* COMPANY DETAILS */}
              <div style={{ ...card, padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Company Details</p>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', background: '#F7F8FC', border: '1px solid #EDEEF2', borderRadius: 8, padding: '4px 10px' }}>Read-only · Managed by Leadway Health</span>
                </div>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3B8', fontSize: 13 }}>
                    <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Loading…
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {[
                      { label: 'Company Name',  value: cp?.companyName  || '—' },
                      { label: 'Group ID',      value: cp?.companyId    || '—' },
                      { label: 'Policy Number', value: cp?.policyNumber || '—' },
                      { label: 'HR Contact',    value: cp?.user?.name   || '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <label style={labelStyle}>{label}</label>
                        <input readOnly value={value} style={readonlyStyle} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* SCHEME INFO */}
              <div style={{ ...card, padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Scheme Info</p>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', background: '#F7F8FC', border: '1px solid #EDEEF2', borderRadius: 8, padding: '4px 10px' }}>Read-only</span>
                </div>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3B8', fontSize: 13 }}>
                    <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Loading…
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                      { label: 'Policy Start', value: cp?.scheme?.policyStartFmt || '—' },
                      { label: 'Renewal Date', value: cp?.scheme?.policyEndFmt   || '—' },
                      { label: 'Active Since',  value: cp?.scheme?.activeSince    || '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <label style={labelStyle}>{label}</label>
                        <input readOnly value={value} style={readonlyStyle} />
                      </div>
                    ))}
                    {cp?.scheme?.activePlans && cp.scheme.activePlans.length > 0 && (
                      <div>
                        <label style={labelStyle}>Active Plan Tiers</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                          {cp.scheme.activePlans.map((p) => {
                            const pc = planColors[p] ?? { bg: '#F1F5F9', text: '#475569' };
                            return <span key={p} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: pc.bg, color: pc.text }}>{p}</span>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CONTACT LEADWAY HEALTH */}
              <div style={{ ...card, padding: '22px 24px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 16 }}>Contact Leadway Health</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F1F2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Phone style={{ width: 14, height: 14, color: '#3A4382' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E' }}>Customer Care</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>0800-LEADWAY</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F1F2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Mail style={{ width: 14, height: 14, color: '#3A4382' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E' }}>Corporate Email</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>corporate@leadwayhealth.com</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MY ACCOUNT ── */}
        {activeTab === 'account' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* PERSONAL DETAILS */}
              <div style={{ ...card, padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User style={{ width: 16, height: 16, color: '#3730A3' }} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Personal Details</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Display Name</label>
                    <input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Job Title</label>
                    <input value={profile.jobTitle} onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })} placeholder="e.g. HR Administrator" style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <input readOnly value={profile.email} style={readonlyStyle} />
                    <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 5 }}>Contact your Admin to update your email.</p>
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+234 …" style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                  </div>
                </div>
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2500); }}
                    style={{ height: 42, padding: '0 24px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', border: 'none', borderRadius: 24, cursor: 'pointer', boxShadow: '0 2px 10px rgba(245,107,34,0.32)' }}>
                    Save Changes
                  </button>
                  {profileSaved && <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>✓ Saved successfully</span>}
                </div>
              </div>

              {/* CHANGE PASSWORD */}
              <div style={{ ...card, padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 15 }}>🔒</span>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Change Password</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
                  {([
                    { key: 'current' as const, label: 'Current Password' },
                    { key: 'next'    as const, label: 'New Password' },
                    { key: 'confirm' as const, label: 'Confirm New Password' },
                  ]).map(({ key, label }) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPw[key] ? 'text' : 'password'}
                          value={passwords[key]}
                          onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
                          style={{ ...inputStyle, paddingRight: 44 }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                        <button type="button" onClick={() => setShowPw({ ...showPw, [key]: !showPw[key] })}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#9CA3B8' }}>
                          {showPw[key] ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {pwError && (
                  <div style={{ marginTop: 16, fontSize: 12, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{pwError}</div>
                )}
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={handleChangePassword} disabled={pwSaving}
                    style={{ height: 42, padding: '0 24px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', border: 'none', borderRadius: 24, cursor: pwSaving ? 'wait' : 'pointer', boxShadow: '0 2px 10px rgba(245,107,34,0.32)', opacity: pwSaving ? 0.6 : 1 }}>
                    {pwSaving ? 'Updating…' : 'Update Password'}
                  </button>
                  {pwSaved && <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>✓ Password updated</span>}
                </div>
              </div>

              {/* TWO-FACTOR AUTHENTICATION */}
              <div style={{ ...card, padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: (twoFaEnabled && !twoFaActive) ? 20 : 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Shield style={{ width: 16, height: 16, color: '#2563EB' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Two-Factor Authentication</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 1 }}>Require a second verification step at every login</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {twoFaActive && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                        {twoFaMethod === 'email' ? 'Email' : 'SMS'} · Active
                      </span>
                    )}
                    <Toggle on={twoFaActive || twoFaEnabled} onChange={() => {
                      if (twoFaActive) { setShowDisable(true); setTwoFaError(''); }
                      else if (!twoFaEnabled) { setTwoFaEnabled(true); setTwoFaSetup('choose'); setTwoFaCode(''); setTwoFaError(''); }
                      else { setTwoFaEnabled(false); setTwoFaCode(''); setTwoFaError(''); }
                    }} />
                  </div>
                </div>

                {twoFaEnabled && !twoFaActive && (
                  <div style={{ borderRadius: 14, border: '1px solid #E5E7F1', overflow: 'hidden' }}>
                    {twoFaSetup === 'choose' && (
                      <div style={{ padding: '20px' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Step 1 of 2 · Choose verification method</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {([
                            { key: 'email' as const, Icon: Mail,  label: 'Email',            desc: `Send a one-time code to ${profile.email || 'your email'}` },
                            { key: 'sms'   as const, Icon: Phone, label: 'SMS Text Message', desc: 'Receive a one-time code on your registered phone' },
                          ]).map(({ key, Icon, label, desc }) => (
                            <button key={key} disabled={key === 'sms' || twoFaBusy}
                              title={key === 'sms' ? 'SMS verification is coming soon' : undefined}
                              onClick={async () => {
                                if (key !== 'email') return;
                                setTwoFaMethod(key);
                                const ok = await start2FaSetup();
                                if (ok) setTwoFaSetup('scan');
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${twoFaMethod === key ? '#F56B22' : '#E5E7F1'}`, background: twoFaMethod === key ? '#FFF5EF' : '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon style={{ width: 16, height: 16, color: '#2563EB' }} />
                              </div>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{label}</p>
                                <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>{desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                        {twoFaError && <p style={{ marginTop: 10, fontSize: 12, color: '#DC2626' }}>{twoFaError}</p>}
                        {twoFaBusy && <p style={{ marginTop: 10, fontSize: 12, color: '#9CA3B8' }}>Sending verification code…</p>}
                      </div>
                    )}

                    {twoFaSetup === 'scan' && (
                      <div style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                          <button onClick={() => setTwoFaSetup('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3B8', padding: 0, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>← Back</button>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Step 2 of 2 · {twoFaMethod === 'email' ? 'Verify Email' : 'Verify Phone'}</p>
                        </div>
                        <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 14 }}>
                          {twoFaMethod === 'email'
                            ? <>A verification code has been sent to <strong>{profile.email || 'your email'}</strong>. Enter it below.</>
                            : <>A verification code will be sent to <strong>{profile.phone || 'your phone'}</strong>. Enter it below.</>}
                        </p>
                        <label style={labelStyle}>6-digit code</label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000 000" maxLength={6}
                            style={{ ...inputStyle, width: 150, letterSpacing: '0.25em', fontWeight: 700, fontSize: 17 }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                          <button onClick={() => { if (twoFaCode.length === 6 && !twoFaBusy) verify2Fa(); }}
                            style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, background: twoFaCode.length === 6 && !twoFaBusy ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : '#E5E7F1', color: twoFaCode.length === 6 && !twoFaBusy ? '#fff' : '#9CA3B8', border: 'none', borderRadius: 14, cursor: twoFaCode.length === 6 && !twoFaBusy ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                            {twoFaBusy ? 'Verifying…' : 'Verify'}
                          </button>
                        </div>
                        {twoFaError && <p style={{ marginTop: 10, fontSize: 12, color: '#DC2626' }}>{twoFaError}</p>}
                        <button onClick={() => { if (!twoFaBusy) start2FaSetup(); }} disabled={twoFaBusy}
                          style={{ marginTop: 10, background: 'none', border: 'none', color: '#F56B22', fontSize: 12, fontWeight: 600, cursor: twoFaBusy ? 'wait' : 'pointer', padding: 0 }}>
                          {twoFaBusy ? 'Sending…' : 'Resend Code'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {twoFaActive && (
                  <div style={{ marginTop: 20, padding: '14px 16px', background: '#F0FDF4', borderRadius: 12, border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Check style={{ width: 16, height: 16, color: '#15803D', flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: '#166534', flex: 1 }}>Two-factor authentication is active. You&apos;ll be asked to verify each time you log in.</p>
                    <button onClick={() => { setShowDisable(true); setTwoFaError(''); }}
                      style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0, whiteSpace: 'nowrap' }}>Remove 2FA</button>
                  </div>
                )}

                {showDisable && (
                  <div style={{ marginTop: 14, padding: '16px', borderRadius: 12, border: '1px solid #FECACA', background: '#FFF8F8' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', marginBottom: 10 }}>Confirm your password to turn off two-factor authentication</p>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input type="password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} placeholder="Account password"
                        style={{ ...inputStyle, maxWidth: 260 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                      <button onClick={() => { if (disablePw && !twoFaBusy) disable2Fa(); }} disabled={!disablePw || twoFaBusy}
                        style={{ height: 42, padding: '0 18px', fontSize: 13, fontWeight: 700, background: disablePw && !twoFaBusy ? '#DC2626' : '#E5E7F1', color: disablePw && !twoFaBusy ? '#fff' : '#9CA3B8', border: 'none', borderRadius: 14, cursor: disablePw && !twoFaBusy ? 'pointer' : 'not-allowed' }}>
                        {twoFaBusy ? 'Disabling…' : 'Disable 2FA'}
                      </button>
                      <button onClick={() => { setShowDisable(false); setDisablePw(''); setTwoFaError(''); }}
                        style={{ fontSize: 12, fontWeight: 600, color: '#9CA3B8', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    </div>
                    {twoFaError && <p style={{ marginTop: 10, fontSize: 12, color: '#DC2626' }}>{twoFaError}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* NOTIFICATION PREFERENCES */}
            <div style={{ ...card, padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bell style={{ width: 16, height: 16, color: '#D97706' }} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Email Notifications</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {([
                  { key: 'invoiceIssued'    as const, label: 'New invoice issued',     sub: 'When Leadway raises a new invoice' },
                  { key: 'invoiceDue'       as const, label: 'Invoice payment due',     sub: '7 days before due date' },
                  { key: 'claimUpdates'     as const, label: 'Claim status updates',    sub: 'When a claim is paid, queried or rejected' },
                  { key: 'enrolmentConfirm' as const, label: 'Enrolment confirmations', sub: 'When a new member is activated' },
                  { key: 'bulkUpload'       as const, label: 'Bulk upload completed',   sub: 'When a census upload finishes processing' },
                ]).map(({ key, label, sub }, i, arr) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid #F7F8FA' : 'none' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{label}</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 3 }}>{sub}</p>
                    </div>
                    <Toggle on={notifications[key]} onChange={() => setNotifications({ ...notifications, [key]: !notifications[key] })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HELP & DOWNLOADS ── */}
        {activeTab === 'help' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Download Centre</p>
                </div>
                {downloads.map((d) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderBottom: '1px solid #F7F8FA', transition: 'background 0.12s' }} className="last:border-0 hover:bg-[#FAFBFC]">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: d.type === 'Excel' ? '#F0FDF4' : '#FFF5EF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ArrowDownToLine style={{ width: 16, height: 16, color: d.type === 'Excel' ? '#15803D' : '#C2410C' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{d.name}</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>{d.type} · Updated {d.updated}</p>
                    </div>
                    <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                      ...(d.type === 'Excel'
                        ? { background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', color: '#15803D', border: '1px solid #BBF7D0', boxShadow: '0 1px 3px rgba(21,128,61,0.10)' }
                        : { background: 'linear-gradient(135deg,#FFF5EF,#FFE8D6)', color: '#C2410C', border: '1px solid #FDBA74', boxShadow: '0 1px 3px rgba(194,65,12,0.10)' }) }}>
                      <ArrowDownToLine style={{ width: 11, height: 11 }} /> {d.type === 'Excel' ? 'XLS' : 'PDF'}
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Frequently Asked Questions</p>
                </div>
                {faqs.map((q, i) => (
                  <div key={i} style={{ borderBottom: i < faqs.length - 1 ? '1px solid #F7F8FA' : 'none' }}>
                    <button
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{q}</span>
                      <span style={{ color: '#9CA3B8', transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 12 }}>▾</span>
                    </button>
                    {openFaq === i && (
                      <div style={{ padding: '0 24px 16px', fontSize: 12, color: '#9CA3B8', lineHeight: 1.6 }}>
                        Please refer to the User Guide or contact your account manager for detailed instructions on this topic.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...card, padding: '22px 24px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 16 }}>Contact Leadway Health</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F1F2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Phone style={{ width: 14, height: 14, color: '#3A4382' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E' }}>Customer Care</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>0800-LEADWAY</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F1F2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Mail style={{ width: 14, height: 14, color: '#3A4382' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E' }}>Corporate Email</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>corporate@leadwayhealth.com</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── AUDIT TRAIL ── */}
        {activeTab === 'audit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Activity Audit Trail</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>
                  {auditLoading ? 'Loading…' : `${auditTotal} event${auditTotal !== 1 ? 's' : ''} recorded for your company`}
                </p>
              </div>
              <button
                onClick={loadAuditLogs}
                disabled={auditLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', fontSize: 12, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 20, background: '#fff', color: '#6B7280', cursor: auditLoading ? 'wait' : 'pointer', opacity: auditLoading ? 0.6 : 1 }}>
                <ClipboardList style={{ width: 13, height: 13 }} />
                Refresh
              </button>
            </div>

            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 140px 140px', columnGap: 12, padding: '10px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                {['Time', 'Event', 'User', 'Action'].map((h) => (
                  <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>

              {auditLoading ? (
                <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 10, color: '#9CA3B8' }}>
                  <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13 }}>Loading audit log…</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9CA3B8' }}>
                  <ClipboardList style={{ width: 32, height: 32, margin: '0 auto 12px', color: '#E5E7F1' }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#131C4E', marginBottom: 4 }}>No activity recorded yet</p>
                  <p style={{ fontSize: 12 }}>Actions taken in the portal will appear here</p>
                </div>
              ) : (
                auditLogs.map((log) => {
                  const actionColors: Record<string, { bg: string; text: string }> = {
                    VIEW_MEMBERS:       { bg: '#EFF6FF', text: '#2563EB' },
                    EXPORT_MEMBERS:     { bg: '#F0FDF4', text: '#16A34A' },
                    VIEW_CLAIMS:        { bg: '#FFF7ED', text: '#EA580C' },
                    EXPORT_CLAIMS:      { bg: '#F0FDF4', text: '#16A34A' },
                    CHANGE_PASSWORD:    { bg: '#FEF2F2', text: '#DC2626' },
                    VIEW_PORTAL_USERS:  { bg: '#F5F3FF', text: '#7C3AED' },
                    TOGGLE_USER_STATUS: { bg: '#FFFBEB', text: '#D97706' },
                    VIEW_DASHBOARD:     { bg: '#F0FDF4', text: '#16A34A' },
                    VIEW_COMPANY_PROFILE: { bg: '#F1F5F9', text: '#475569' },
                  };
                  const ac = actionColors[log.action] ?? { bg: '#F1F5F9', text: '#6B7280' };
                  const dt = new Date(log.timestamp);
                  const timeStr = isNaN(dt.getTime()) ? log.timestamp : dt.toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                  const actionLabel = log.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
                  const d = (log.details ?? {}) as Record<string, unknown>;
                  const detailCount = d.totalCount !== undefined ? `${String(d.totalCount)} records` : d.totalClaims !== undefined ? `${String(d.totalClaims)} claims` : null;
                  const detailUser  = d.targetUserName ? `User: ${String(d.targetUserName)} → ${String(d.newStatus ?? '')}` : null;

                  return (
                    <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 140px 140px', columnGap: 12, alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #F7F8FA' }}>
                      <span style={{ fontSize: 12, color: '#9CA3B8', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E' }}>{actionLabel}</p>
                        {detailCount && <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>{detailCount}</p>}
                        {detailUser  && <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>{detailUser}</p>}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.userName}</p>
                        <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.userEmail}</p>
                      </div>
                      <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: ac.bg, color: ac.text, width: 'fit-content', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {log.resource}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
