'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Users, Pencil, X, Plus, MoreHorizontal, Trash2, Eye, EyeOff } from 'lucide-react';

/* ─── Mock data ─────────────────────────────────── */

const mockCorporates: Record<string, {
  id: string; name: string; template: string; dateProvisioned: string;
  adminEmail: string; status: string; schemeCode: string;
  colors: string[]; activeMembers: number;
}> = {
  'corp-001': { id: 'corp-001', name: 'Dangote Industries Ltd',            template: 'Default template', dateProvisioned: '2024-01-15', adminEmail: 'f.komoni@dangote.com',       status: 'Active',  schemeCode: '481421315', colors: ['#F56B22','#131C4E','#3B82F6'], activeMembers: 847  },
  'corp-002': { id: 'corp-002', name: 'SME - Herconomy',                   template: 'Default template', dateProvisioned: '2026-06-24', adminEmail: 'osaze.tom@cubecover.ai',     status: 'Pending', schemeCode: '729104823', colors: ['#FF8A00','#7C88B1','#369AFE'], activeMembers: 0    },
  'corp-003': { id: 'corp-003', name: 'Edves Nigeria Limited',             template: 'Default template', dateProvisioned: '2026-06-24', adminEmail: 'hr@edves.net',                status: 'Pending', schemeCode: '318472901', colors: ['#F56B22','#131C4E','#3B82F6'], activeMembers: 0    },
  'corp-004': { id: 'corp-004', name: 'Jackson, Etti And Edu (JEE Africa)',template: 'Default template', dateProvisioned: '2026-06-24', adminEmail: 'noemail@gmail.com',           status: 'Pending', schemeCode: '204817364', colors: ['#F56B22','#131C4E','#3B82F6'], activeMembers: 0    },
  'corp-005': { id: 'corp-005', name: 'Flour Mills of Nigeria Plc',        template: 'Default template', dateProvisioned: '2025-03-10', adminEmail: 'hr.admin@fmnplc.com',        status: 'Active',  schemeCode: '573829104', colors: ['#F56B22','#131C4E','#3B82F6'], activeMembers: 1204 },
  'corp-006': { id: 'corp-006', name: 'Baker Hughes Nigeria Ltd',          template: 'Custom template',  dateProvisioned: '2023-08-22', adminEmail: 'c.eze@bakerhughes.com',      status: 'Active',  schemeCode: '481421315', colors: ['#FF8A00','#7C88B1','#369AFE'], activeMembers: 362  },
  'corp-007': { id: 'corp-007', name: 'NLNG – Nigeria LNG Limited',        template: 'Default template', dateProvisioned: '2024-06-01', adminEmail: 'hr@nlng.com.ng',             status: 'Active',  schemeCode: '920384716', colors: ['#F56B22','#131C4E','#3B82F6'], activeMembers: 2103 },
  'corp-008': { id: 'corp-008', name: 'Zenith Bank Plc',                   template: 'Premium template', dateProvisioned: '2024-09-15', adminEmail: 'corp.health@zenithbank.com', status: 'Active',  schemeCode: '647291038', colors: ['#F56B22','#131C4E','#3B82F6'], activeMembers: 5847 },
  'corp-009': { id: 'corp-009', name: 'Primus Pharmacare Ltd',             template: 'Default template', dateProvisioned: '2025-11-02', adminEmail: 'hr@primusng.com',            status: 'Pending', schemeCode: '112938475', colors: ['#F56B22','#131C4E','#3B82F6'], activeMembers: 0    },
  'corp-010': { id: 'corp-010', name: 'Okomu Oil Palm Company Plc',        template: 'Default template', dateProvisioned: '2025-07-18', adminEmail: 'admin@okomuoil.com',         status: 'Active',  schemeCode: '839104726', colors: ['#F56B22','#131C4E','#3B82F6'], activeMembers: 281  },
};

const PERMISSIONS = [
  { key: 'dashboard',    label: 'Access to Dashboard' },
  { key: 'members',      label: 'Access to Beneficiary Management' },
  { key: 'finance',      label: 'Access to Finance' },
  { key: 'messages',     label: 'Send & Receive Messages' },
  { key: 'settings',     label: 'Edit Settings' },
  { key: 'pre_employ',   label: 'Pre-Employment' },
  { key: 'reports',      label: 'Report' },
];

type PermMap = Record<string, boolean>;

interface Role {
  id: string;
  name: string;
  permissions: PermMap;
  users: { id: string; name: string; email: string }[];
}

const defaultPerms = (): PermMap => Object.fromEntries(PERMISSIONS.map((p) => [p.key, true]));

const initRoles: Role[] = [
  { id: 'r1', name: 'Second admin', permissions: defaultPerms(), users: [{ id: 'u1', name: 'Amaka Eze', email: 'a.eze@dangote.com' }] },
  { id: 'r2', name: 'Third admin',  permissions: defaultPerms(), users: [] },
  { id: 'r3', name: 'FOURTH',       permissions: defaultPerms(), users: [] },
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
const permCount = (p: PermMap) => Object.values(p).filter(Boolean).length;

/* ─── Toggle ────────────────────────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: on ? '#F56B22' : '#E5E7F1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s', display: 'block' }} />
    </button>
  );
}

/* ─── Page ───────────────────────────────────────── */
export default function CorporateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const corp = mockCorporates[id];

  const [view, setView]           = useState<'detail' | 'access'>('detail');
  const [roles, setRoles]         = useState<Role[]>(initRoles);
  const [menuOpen, setMenuOpen]   = useState<string | null>(null);
  const [expandedRole, setExpanded] = useState<string | null>(null);

  // Modals
  const [showRoleModal, setShowRoleModal]         = useState(false);
  const [showAssignModal, setShowAssignModal]     = useState(false);
  const [showEmailToast, setShowEmailToast]       = useState(false);
  const [showEditModal, setShowEditModal]         = useState(false);
  const [showDeleteRole, setShowDeleteRole]       = useState<string | null>(null);

  // Add role form
  const [roleName, setRoleName]       = useState('');
  const [rolePerms, setRolePerms]     = useState<PermMap>(defaultPerms());
  const allOn = Object.values(rolePerms).every(Boolean);

  // Assign user form
  const [assignRole, setAssignRole]   = useState('');
  const [assignFirst, setAssignFirst] = useState('');
  const [assignLast, setAssignLast]   = useState('');
  const [assignEmail, setAssignEmail] = useState('');

  // Edit form
  const [editName, setEditName]       = useState(corp?.name ?? '');
  const [editEmail, setEditEmail]     = useState(corp?.adminEmail ?? '');
  const [editDate, setEditDate]       = useState(corp?.dateProvisioned ?? '');

  if (!corp) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#131C4E' }}>Corporate not found</p>
        <button onClick={() => router.push('/admin/corporates')} style={{ marginTop: 12, fontSize: 13, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>← Back to list</button>
      </div>
    );
  }

  const initials = corp.name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  function sendSignupEmail() {
    setShowEmailToast(true);
    setTimeout(() => setShowEmailToast(false), 3500);
  }

  function createRole() {
    if (!roleName.trim()) return;
    setRoles((prev) => [...prev, { id: `r${Date.now()}`, name: roleName.trim(), permissions: { ...rolePerms }, users: [] }]);
    setRoleName(''); setRolePerms(defaultPerms()); setShowRoleModal(false);
  }

  function deleteRole(roleId: string) {
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    setShowDeleteRole(null); setMenuOpen(null);
  }

  function assignUser() {
    if (!assignRole || !assignFirst || !assignEmail) return;
    setRoles((prev) => prev.map((r) => r.id === assignRole
      ? { ...r, users: [...r.users, { id: `u${Date.now()}`, name: `${assignFirst} ${assignLast}`.trim(), email: assignEmail }] }
      : r));
    setAssignRole(''); setAssignFirst(''); setAssignLast(''); setAssignEmail('');
    setShowAssignModal(false);
  }

  function removeUser(roleId: string, userId: string) {
    setRoles((prev) => prev.map((r) => r.id === roleId
      ? { ...r, users: r.users.filter((u) => u.id !== userId) }
      : r));
  }

  const statusStyle: Record<string, { bg: string; text: string; dot: string }> = {
    Active:  { bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
    Pending: { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
  };
  const st = statusStyle[corp.status] ?? statusStyle['Pending'];

  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
  const inputStyle: React.CSSProperties = { width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' };

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>

      {/* TOP BAR */}
      <header style={{ background: '#fff', borderBottom: '1px solid #F0F1F5', height: 58, display: 'flex', alignItems: 'center', padding: '0 36px', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Corporate</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#131C4E,#3A4382)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff' }}>G</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>Gideon</span>
        </div>
      </header>

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ACTION ROW */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => view === 'access' ? setView('detail') : router.push('/admin/corporates')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}>
            <ArrowLeft style={{ width: 15, height: 15 }} /> Back
          </button>

          {view === 'detail' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={sendSignupEmail}
                style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 14, background: '#fff', color: '#131C4E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Send style={{ width: 14, height: 14 }} /> Send Signup Email
              </button>
              <button onClick={() => setView('access')}
                style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 10px rgba(245,107,34,0.32)' }}>
                <Users style={{ width: 14, height: 14 }} /> Manage Access
              </button>
              <button onClick={() => setShowEditModal(true)}
                style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#131C4E,#3A4382)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Pencil style={{ width: 14, height: 14 }} /> Edit
              </button>
            </div>
          )}

          {view === 'access' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowRoleModal(true)}
                style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 14, background: '#fff', color: '#131C4E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Plus style={{ width: 14, height: 14 }} /> Add New Role
              </button>
              <button onClick={() => setShowAssignModal(true)}
                style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 10px rgba(245,107,34,0.32)' }}>
                <Users style={{ width: 14, height: 14 }} /> Assign User
              </button>
            </div>
          )}
        </div>

        {/* ── DETAIL VIEW ── */}
        {view === 'detail' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* COMPANY CARD */}
            <div style={{ ...card, padding: '28px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                {/* Logo */}
                <div style={{ width: 80, height: 80, borderRadius: 20, background: '#F1F2F8', border: '1px solid #EDEEF2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#C4C9D9', letterSpacing: '-0.04em' }}>{initials}</span>
                </div>

                {/* Name + code */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', marginBottom: 6 }}>{corp.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#9CA3B8' }}>Scheme Code:</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#F56B22', fontFamily: 'monospace' }}>{corp.schemeCode}</span>
                  </div>
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: st.bg, color: st.text }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />{corp.status}
                  </span>
                  <span style={{ fontSize: 11, color: '#9CA3B8' }}>Template: <strong style={{ color: '#131C4E' }}>{corp.template}</strong></span>
                </div>
              </div>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #F0F1F5', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
                {[
                  { label: 'Start Date',      value: fmtDate(corp.dateProvisioned) },
                  { label: 'Admin Email',      value: corp.adminEmail },
                  { label: 'Active Members',   value: corp.activeMembers.toLocaleString() },
                  { label: 'Brand Colours',    value: null },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</p>
                    {value !== null
                      ? <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{value}</p>
                      : <div style={{ display: 'flex', gap: 6 }}>{corp.colors.map((c) => (<div key={c} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }} title={c} />))}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* PORTAL PREVIEW PLACEHOLDER */}
            <div style={{ ...card, padding: '28px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 6 }}>Portal Preview</p>
              <p style={{ fontSize: 12, color: '#9CA3B8', marginBottom: 20 }}>Live preview of the HR portal as this client's users see it</p>
              <div style={{ background: '#F7F8FC', borderRadius: 12, border: '1px solid #EDEEF2', height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: '#fff' }}>{initials}</div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{corp.name}</p>
                <p style={{ fontSize: 11, color: '#9CA3B8' }}>Portal preview · 1 of 2 pages</p>
              </div>
            </div>
          </div>
        )}

        {/* ── ACCESS / ROLE ADMINISTRATION ── */}
        {view === 'access' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em' }}>Role Administration</p>
              <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 3 }}>{corp.name} · Manage roles and user access</p>
            </div>

            <div style={{ ...card, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 80px', columnGap: 12, padding: '11px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                {['Role', 'Permissions', 'Users', 'Manage'].map((h) => (
                  <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>

              {roles.map((role) => {
                const count = permCount(role.permissions);
                const hasUsers = role.users.length > 0;
                const isExpanded = expandedRole === role.id;
                return (
                  <div key={role.id}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 80px', columnGap: 12, alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F7F8FA', transition: 'background 0.12s' }}
                      className="hover:bg-[#FAFBFC]">
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{role.name}</span>
                      <span style={{ fontSize: 12, color: '#9CA3B8' }}>{count}/{PERMISSIONS.length}</span>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : role.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: hasUsers ? 'linear-gradient(135deg,#EEF2FF,#E0E7FF)' : '#FEF2F2', color: hasUsers ? '#3730A3' : '#EF4444', width: 'fit-content' }}>
                        <Users style={{ width: 13, height: 13 }} />{role.users.length}
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setMenuOpen(menuOpen === role.id ? null : role.id)}
                          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E5E7F1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MoreHorizontal style={{ width: 15, height: 15, color: '#6B7280' }} />
                        </button>
                        {menuOpen === role.id && (
                          <div style={{ position: 'absolute', right: 0, top: 38, background: '#fff', border: '1px solid #EDEEF2', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 50, minWidth: 130, overflow: 'hidden' }}>
                            <button
                              onClick={() => { setMenuOpen(null); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#131C4E', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                              className="hover:bg-[#FAFBFC]">
                              <Pencil style={{ width: 13, height: 13, color: '#9CA3B8' }} /> Edit Role
                            </button>
                            <button
                              onClick={() => { setShowDeleteRole(role.id); setMenuOpen(null); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer', borderTop: '1px solid #F7F8FA', textAlign: 'left' }}
                              className="hover:bg-[#FEF2F2]">
                              <Trash2 style={{ width: 13, height: 13 }} /> Delete Role
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded users list */}
                    {isExpanded && (
                      <div style={{ background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                        {role.users.length === 0 ? (
                          <p style={{ padding: '12px 40px', fontSize: 12, color: '#9CA3B8' }}>No users assigned to this role yet.</p>
                        ) : (
                          role.users.map((u) => (
                            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 40px', borderBottom: '1px solid #F0F1F5' }} className="last:border-0">
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{u.name}</p>
                                <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>{u.email}</p>
                              </div>
                              <button onClick={() => removeUser(role.id, u.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', fontSize: 11, fontWeight: 600, color: '#EF4444', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer' }}>
                                <Trash2 style={{ width: 11, height: 11 }} /> Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {roles.length === 0 && (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#131C4E' }}>No roles yet</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 4 }}>Click "Add New Role" to get started</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── TOAST — SIGNUP EMAIL ── */}
      {showEmailToast && (
        <div style={{ position: 'fixed', bottom: 32, right: 32, background: '#131C4E', color: '#fff', borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 100, fontSize: 13, fontWeight: 600 }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✓</span>
          Signup email sent to {corp.adminEmail}
        </div>
      )}

      {/* ── MODAL — ADD NEW ROLE ── */}
      {showRoleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(19,28,78,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRoleModal(false); }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 480, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#131C4E' }}>Add New Role</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>Set a name and configure permissions</p>
              </div>
              <button onClick={() => setShowRoleModal(false)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #EDEEF2', background: '#F7F8FC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: 14, height: 14, color: '#6B7280' }} />
              </button>
            </div>
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={labelStyle}>Role Name</label>
                <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Finance Manager"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>Permissions</p>
                  <p style={{ fontSize: 11, color: '#9CA3B8' }}>Enable or disable what this role can access</p>
                </div>

                {/* All Access master toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FAFBFC', borderRadius: 12, border: '1px solid #EDEEF2', marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>All Access</p>
                  <Toggle on={allOn} onChange={() => {
                    const newVal = !allOn;
                    setRolePerms(Object.fromEntries(PERMISSIONS.map((p) => [p.key, newVal])));
                  }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {PERMISSIONS.map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderRadius: 10 }} className="hover:bg-[#FAFBFC]">
                      <p style={{ fontSize: 13, color: '#131C4E' }}>{label}</p>
                      <Toggle on={rolePerms[key]} onChange={() => setRolePerms({ ...rolePerms, [key]: !rolePerms[key] })} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #F0F1F5', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRoleModal(false)}
                style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 24, background: '#fff', color: '#6B7280', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={createRole}
                style={{ height: 42, padding: '0 24px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 24, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 10px rgba(245,107,34,0.32)', opacity: roleName.trim() ? 1 : 0.5 }}>
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL — ASSIGN USER ── */}
      {showAssignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(19,28,78,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAssignModal(false); }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#131C4E' }}>Assign User</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>Add a person who can access this portal</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #EDEEF2', background: '#F7F8FC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: 14, height: 14, color: '#6B7280' }} />
              </button>
            </div>
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Role</label>
                <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36 }}>
                  <option value="">Select a role</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input value={assignFirst} onChange={(e) => setAssignFirst(e.target.value)} placeholder="Start typing..." style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input value={assignLast} onChange={(e) => setAssignLast(e.target.value)} placeholder="Start typing..." style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="Start typing..." style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
              </div>
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #F0F1F5', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAssignModal(false)}
                style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 24, background: '#fff', color: '#6B7280', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={assignUser}
                style={{ height: 42, padding: '0 24px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 24, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 10px rgba(245,107,34,0.32)', opacity: (assignRole && assignFirst && assignEmail) ? 1 : 0.5 }}>
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL — DELETE ROLE CONFIRM ── */}
      {showDeleteRole && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(19,28,78,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 400, padding: '32px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.20)', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 style={{ width: 22, height: 22, color: '#EF4444' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#131C4E', marginBottom: 8 }}>Delete Role?</p>
            <p style={{ fontSize: 13, color: '#9CA3B8', marginBottom: 24, lineHeight: 1.6 }}>
              This will remove the role and unassign all its users. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowDeleteRole(null)}
                style={{ height: 42, padding: '0 24px', fontSize: 13, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 24, background: '#fff', color: '#6B7280', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => deleteRole(showDeleteRole)}
                style={{ height: 42, padding: '0 24px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 24, background: 'linear-gradient(135deg,#EF4444,#F87171)', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 10px rgba(239,68,68,0.28)' }}>
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL — EDIT CORPORATE ── */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(19,28,78,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#131C4E' }}>Edit Corporate</p>
              <button onClick={() => setShowEditModal(false)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #EDEEF2', background: '#F7F8FC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: 14, height: 14, color: '#6B7280' }} />
              </button>
            </div>
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Company Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
              </div>
              <div>
                <label style={labelStyle}>Admin / Contact Email</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
              </div>
              <div>
                <label style={labelStyle}>Scheme Start Date</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
              </div>
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #F0F1F5', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEditModal(false)}
                style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 24, background: '#fff', color: '#6B7280', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => setShowEditModal(false)}
                style={{ height: 42, padding: '0 24px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 24, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 10px rgba(245,107,34,0.32)' }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close dropdown on outside click */}
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(null)} />}
    </div>
  );
}
