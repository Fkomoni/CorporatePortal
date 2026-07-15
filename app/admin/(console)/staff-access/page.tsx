'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

interface Policy { groupId: string; name: string; schemeCode: string }
interface AccessRow { id: string; staffEmail: string; companyId: string; companyName: string | null; policyNumber: string | null }

const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const inputStyle: React.CSSProperties = { width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' };

export default function StaffAccessPage() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addCompanyId, setAddCompanyId] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const load = useCallback(async () => {
    try {
      const [accessRes, policiesRes] = await Promise.all([
        fetch('/api/admin/staff-access').then((r) => r.json()),
        fetch('/api/admin/policies').then((r) => r.json()),
      ]);
      setRows(accessRes.access ?? []);
      setPolicies(policiesRes.policies ?? []);
    } catch {
      setError('Failed to load staff access.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      setAddEmail(''); setAddCompanyId(''); setShowAdd(false);
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

  const grouped = rows.reduce<Record<string, AccessRow[]>>((acc, r) => {
    (acc[r.staffEmail] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#131C4E' }}>Internal Admin Access</p>
          <p style={{ fontSize: 13, color: '#9CA3B8', marginTop: 4 }}>
            Link a Leadway staff email to the client(s) they can manage as an internal admin.
          </p>
        </div>
        <button onClick={() => { setShowAdd(!showAdd); setAddError(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: 'pointer', background: showAdd ? '#6B7280' : 'linear-gradient(135deg,#F56B22,#FF8C4B)' }}>
          {showAdd ? <X style={{ width: 15, height: 15 }} /> : <Plus style={{ width: 15, height: 15 }} />}
          {showAdd ? 'Close' : 'Grant Access'}
        </button>
      </div>

      {showAdd && (
        <div style={{ ...card, padding: '20px 24px' }}>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', marginBottom: 6 }}>Leadway Staff Email</label>
              <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="firstname.lastname@leadway.com" required style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', marginBottom: 6 }}>Client</label>
              <select value={addCompanyId} onChange={(e) => setAddCompanyId(e.target.value)} required style={inputStyle}>
                <option value="">Select a client…</option>
                {policies.map((p) => <option key={p.groupId} value={p.groupId}>{p.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={addLoading}
              style={{ height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', cursor: addLoading ? 'not-allowed' : 'pointer', opacity: addLoading ? 0.6 : 1 }}>
              {addLoading ? 'Granting…' : 'Grant'}
            </button>
          </form>
          {addError && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 10 }}>{addError}</p>}
        </div>
      )}

      {error && <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626' }}>{error}</div>}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#9CA3B8' }}>Loading…</p>
        ) : Object.keys(grouped).length === 0 ? (
          <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#9CA3B8' }}>No internal admins linked to any client yet.</p>
        ) : (
          Object.entries(grouped).map(([email, accessRows]) => (
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
  );
}
