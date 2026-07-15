'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, ShieldCheck, ShieldOff } from 'lucide-react';

interface Policy { groupId: string; name: string; schemeCode: string }
interface AccessRow { id: string; staffEmail: string; companyId: string; companyName: string | null; policyNumber: string | null }
interface StaffUserRow { email: string; active: boolean; role: string }

const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const inputStyle: React.CSSProperties = { width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' };

export default function StaffAccessPage() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserRow[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showEnable, setShowEnable] = useState(false);
  const [enableEmail, setEnableEmail] = useState('');
  const [enableLoading, setEnableLoading] = useState(false);
  const [enableError, setEnableError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addCompanyId, setAddCompanyId] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const load = useCallback(async () => {
    try {
      const [accessRes, policiesRes] = await Promise.all([
        fetch('/api/admin/staff-access').then((r) => r.json()),
        fetch('/api/admin/policies').then((r) => r.json()),
      ]);
      setRows(accessRes.access ?? []);
      setStaffUsers(accessRes.staffUsers ?? []);
      setPolicies(policiesRes.policies ?? []);
    } catch {
      setError('Failed to load staff access.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setEnableError('');
    setEnableLoading(true);
    try {
      const res = await fetch('/api/admin/staff-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: enableEmail, active: true }),
      });
      const json = await res.json();
      if (!res.ok) { setEnableError(json.error ?? 'Failed to enable this email.'); return; }
      setEnableEmail(''); setShowEnable(false);
      await load();
    } catch {
      setEnableError('Network error. Please try again.');
    } finally {
      setEnableLoading(false);
    }
  }

  async function handleToggleActive(email: string, active: boolean) {
    try {
      await fetch('/api/admin/staff-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, active }),
      });
      setStaffUsers((prev) => prev.map((s) => (s.email === email ? { ...s, active } : s)));
    } catch {
      setError('Failed to update access.');
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    const policy = policies.find((p) => p.groupId === addCompanyId);
    if (!policy) { setAddError('Select a client.'); return; }
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/staff-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffEmail: addEmail, companyId: policy.groupId, companyName: policy.name, policyNumber: policy.schemeCode }),
      });
      const json = await res.json();
      if (!res.ok) { setAddError(json.error ?? 'Failed to grant access.'); return; }
      setAddEmail(''); setAddCompanyId(''); setClientQuery(''); setShowAdd(false);
      await load();
    } catch {
      setAddError('Network error. Please try again.');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this client access?')) return;
    try {
      await fetch(`/api/admin/staff-access?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('Failed to remove access.');
    }
  }

  const clientsByEmail = rows.reduce<Record<string, AccessRow[]>>((acc, r) => {
    (acc[r.staffEmail] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#131C4E' }}>Internal Admin Access</p>
        <p style={{ fontSize: 13, color: '#9CA3B8', marginTop: 4 }}>
          A valid Leadway AD login is not enough on its own — only emails explicitly enabled below can use the internal admin portal at all.
        </p>
      </div>

      {error && <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626' }}>{error}</div>}

      {/* ── ENABLED STAFF ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>Enabled for Portal Access</p>
          <button onClick={() => { setShowEnable(!showEnable); setEnableError(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', fontSize: 12, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', background: showEnable ? '#6B7280' : 'linear-gradient(135deg,#F56B22,#FF8C4B)' }}>
            {showEnable ? <X style={{ width: 13, height: 13 }} /> : <Plus style={{ width: 13, height: 13 }} />}
            {showEnable ? 'Close' : 'Enable a Staff Email'}
          </button>
        </div>

        {showEnable && (
          <div style={{ ...card, padding: '20px 24px', marginBottom: 12 }}>
            <form onSubmit={handleEnable} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', marginBottom: 6 }}>Leadway Staff Email</label>
                <input type="email" value={enableEmail} onChange={(e) => setEnableEmail(e.target.value)} placeholder="firstname.lastname@leadway.com" required style={inputStyle} />
              </div>
              <button type="submit" disabled={enableLoading}
                style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', cursor: enableLoading ? 'not-allowed' : 'pointer', opacity: enableLoading ? 0.6 : 1 }}>
                {enableLoading ? 'Enabling…' : 'Enable'}
              </button>
            </form>
            {enableError && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 10 }}>{enableError}</p>}
          </div>
        )}

        <div style={{ ...card, overflow: 'hidden' }}>
          {loading ? (
            <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#9CA3B8' }}>Loading…</p>
          ) : staffUsers.length === 0 ? (
            <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#9CA3B8' }}>No staff emails enabled yet.</p>
          ) : (
            staffUsers.map((s) => (
              <div key={s.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #F0F1F5' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{s.email}</p>
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1, textTransform: 'capitalize' }}>{s.role.replace('_', ' ')}</p>
                </div>
                <button onClick={() => handleToggleActive(s.email, !s.active)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
                    border: s.active ? '1px solid #A7F3D0' : '1px solid #FECACA',
                    background: s.active ? '#ECFDF5' : '#FEF2F2',
                    color: s.active ? '#059669' : '#DC2626',
                  }}>
                  {s.active ? <ShieldCheck style={{ width: 13, height: 13 }} /> : <ShieldOff style={{ width: 13, height: 13 }} />}
                  {s.active ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── CLIENT ACCESS ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>Client HR Desk Access</p>
            <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>Which client(s) an enabled staff email can act as HR for.</p>
          </div>
          <button onClick={() => { setShowAdd(!showAdd); setAddError(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', fontSize: 12, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', background: showAdd ? '#6B7280' : 'linear-gradient(135deg,#F56B22,#FF8C4B)' }}>
            {showAdd ? <X style={{ width: 13, height: 13 }} /> : <Plus style={{ width: 13, height: 13 }} />}
            {showAdd ? 'Close' : 'Grant Client Access'}
          </button>
        </div>

        {showAdd && (
          <div style={{ ...card, padding: '20px 24px', marginBottom: 12 }}>
            <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', marginBottom: 6 }}>Leadway Staff Email</label>
                <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="firstname.lastname@leadway.com" required style={inputStyle} />
              </div>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', marginBottom: 6 }}>Client</label>
                <input
                  type="text"
                  value={clientQuery}
                  onChange={(e) => { setClientQuery(e.target.value); setAddCompanyId(''); setClientDropdownOpen(true); }}
                  onFocus={() => setClientDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
                  placeholder="Type to search clients…"
                  autoComplete="off"
                  required={!addCompanyId}
                  style={inputStyle}
                />
                {clientDropdownOpen && clientQuery.trim() && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 260, overflowY: 'auto', background: '#fff', border: '1px solid #E5E7F1', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', zIndex: 20 }}>
                    {policies
                      .filter((p) => p.name.toLowerCase().includes(clientQuery.trim().toLowerCase()))
                      .slice(0, 50)
                      .map((p) => (
                        <button
                          key={p.groupId}
                          type="button"
                          onClick={() => { setAddCompanyId(p.groupId); setClientQuery(p.name); setClientDropdownOpen(false); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, color: '#131C4E', background: p.groupId === addCompanyId ? '#FFF5EF' : 'transparent', border: 'none', borderBottom: '1px solid #F7F8FA', cursor: 'pointer' }}
                        >
                          {p.name}
                        </button>
                      ))}
                    {policies.filter((p) => p.name.toLowerCase().includes(clientQuery.trim().toLowerCase())).length === 0 && (
                      <p style={{ padding: '10px 14px', fontSize: 12, color: '#9CA3B8' }}>No matching clients.</p>
                    )}
                  </div>
                )}
              </div>
              <button type="submit" disabled={addLoading}
                style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', cursor: addLoading ? 'not-allowed' : 'pointer', opacity: addLoading ? 0.6 : 1 }}>
                {addLoading ? 'Granting…' : 'Grant'}
              </button>
            </form>
            {addError && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 10 }}>{addError}</p>}
            <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 10 }}>
              Note: granting client access alone does not enable portal login — the email must also be enabled above.
            </p>
          </div>
        )}

        <div style={{ ...card, overflow: 'hidden' }}>
          {loading ? (
            <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#9CA3B8' }}>Loading…</p>
          ) : Object.keys(clientsByEmail).length === 0 ? (
            <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#9CA3B8' }}>No internal admins linked to any client yet.</p>
          ) : (
            Object.entries(clientsByEmail).map(([email, accessRows]) => (
              <div key={email} style={{ padding: '18px 24px', borderBottom: '1px solid #F0F1F5' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 10 }}>{email}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {accessRows.map((r) => (
                    <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: '#F7F8FC', border: '1px solid #EDEEF2', fontSize: 12, color: '#374151' }}>
                      {r.companyName || r.companyId}
                      <button onClick={() => handleRemove(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3B8', display: 'flex' }}>
                        <Trash2 style={{ width: 12, height: 12 }} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
