'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Check, X, ChevronDown, RefreshCw, Users, Calendar, Mail, Phone } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { useToast } from '@/components/ui/Toast';
import type { PendingGroup } from '@/app/api/hr/members/pending/route';

export default function PendingEnroleesPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<PendingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [decliningCif, setDecliningCif] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [busyCif, setBusyCif] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError('');
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    fetch(`/api/hr/members/pending?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setGroups(d.groups ?? []);
      })
      .catch(() => setError('Failed to load pending enrolees'))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(cif: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cif)) next.delete(cif); else next.add(cif);
      return next;
    });
  }

  async function handleApprove(group: PendingGroup) {
    setBusyCif(group.parentCif);
    try {
      const res = await fetch('/api/hr/members/pending/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentCif: group.parentCif, principalName: group.principalName }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast(data.error ?? 'Failed to approve.', 'error');
      } else {
        toast(`${group.principalName || 'Registration'} approved${data.recordsUpdated ? ` (${data.recordsUpdated} record${data.recordsUpdated !== 1 ? 's' : ''})` : ''}.`, 'success');
        setGroups((prev) => prev.filter((g) => g.parentCif !== group.parentCif));
      }
    } catch {
      toast('Network error. Please try again.', 'error');
    } finally {
      setBusyCif(null);
    }
  }

  async function handleDecline(group: PendingGroup) {
    if (!declineReason.trim()) { toast('Please provide a reason for declining.', 'error'); return; }
    setBusyCif(group.parentCif);
    try {
      const res = await fetch('/api/hr/members/pending/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentCif: group.parentCif, principalName: group.principalName, reason: declineReason.trim(), email: group.email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast(data.error ?? 'Failed to decline.', 'error');
      } else {
        toast(`${group.principalName || 'Registration'} declined.`, 'success');
        setGroups((prev) => prev.filter((g) => g.parentCif !== group.parentCif));
        setDecliningCif(null);
        setDeclineReason('');
      }
    } catch {
      toast('Network error. Please try again.', 'error');
    } finally {
      setBusyCif(null);
    }
  }

  const inputStyle: React.CSSProperties = { height: 40, padding: '0 12px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none' };

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Pending Enrolees" subtitle="Beneficiaries enrolment awaiting your approval" />
      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Filters */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar style={{ width: 14, height: 14, color: '#9CA3B8' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Registered between</span>
          </div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          <span style={{ fontSize: 12, color: '#9CA3B8' }}>and</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} style={inputStyle} />
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo(''); }} style={{ height: 40, padding: '0 14px', fontSize: 12, fontWeight: 600, color: '#9CA3B8', border: '1px solid #E5E7F1', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>Clear</button>
          )}
          <button onClick={load} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px', fontSize: 12, fontWeight: 700, color: '#374151', border: '1px solid #E5E7F1', borderRadius: 10, background: '#fff', cursor: loading ? 'wait' : 'pointer', marginLeft: 'auto' }}>
            <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 90, borderRadius: 16, background: '#F0F1F5', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13 }}>{error}</div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #EDEEF2', padding: '48px 40px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <ClipboardCheck style={{ width: 26, height: 26, color: '#059669' }} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E', marginBottom: 8 }}>All caught up</p>
            <p style={{ fontSize: 13, color: '#9CA3B8', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
              No pending self-registrations {from || to ? 'in this date range' : 'from the mobile app right now'}.
            </p>
          </div>
        )}

        {!loading && groups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g) => {
              const isExpanded = expanded.has(g.parentCif);
              const isDeclining = decliningCif === g.parentCif;
              const isBusy = busyCif === g.parentCif;
              return (
                <div key={g.parentCif} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF5EF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users style={{ width: 20, height: 20, color: '#F56B22' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>{g.principalName || `CIF ${g.parentCif}`}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: '#EEF2FF', color: '#3730A3' }}>
                          {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                        {g.employeeCode && <span style={{ fontSize: 12, color: '#9CA3B8' }}>Emp. Code: {g.employeeCode}</span>}
                        {g.schemeName && <span style={{ fontSize: 12, color: '#9CA3B8' }}>{g.schemeName}</span>}
                        {g.registrationDate && <span style={{ fontSize: 12, color: '#9CA3B8' }}>Registered {g.registrationDate}</span>}
                      </div>
                    </div>
                    <button onClick={() => toggleExpand(g.parentCif)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                      {isExpanded ? 'Hide details' : 'View details'}
                      <ChevronDown style={{ width: 14, height: 14, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => { setDecliningCif(g.parentCif); setDeclineReason(''); }} disabled={isBusy}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, height: 38, padding: '0 16px', fontSize: 12.5, fontWeight: 700, color: '#DC2626', border: '1px solid #FECACA', borderRadius: 12, background: '#FEF2F2', cursor: isBusy ? 'wait' : 'pointer' }}>
                        <X style={{ width: 13, height: 13 }} /> Decline
                      </button>
                      <button onClick={() => handleApprove(g)} disabled={isBusy}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, height: 38, padding: '0 16px', fontSize: 12.5, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#10B981,#059669)', cursor: isBusy ? 'wait' : 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.28)' }}>
                        <Check style={{ width: 13, height: 13 }} /> {isBusy && !isDeclining ? 'Approving…' : 'Approve'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 22px 18px', borderTop: '1px solid #F0F1F5' }}>
                      <div style={{ display: 'flex', gap: 20, padding: '14px 0 10px', flexWrap: 'wrap' }}>
                        {g.email && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}><Mail style={{ width: 12, height: 12 }} />{g.email}</span>}
                        {g.mobile && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}><Phone style={{ width: 12, height: 12 }} />{g.mobile}</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.6fr 1fr', gap: 8, padding: '8px 0', fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <span>Name</span><span>Relationship</span><span>Membership No</span><span>Sex</span><span>Status</span>
                      </div>
                      {g.members.map((m, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.6fr 1fr', gap: 8, padding: '9px 0', borderTop: '1px solid #F7F8FA', fontSize: 12.5, color: '#374151' }}>
                          <span style={{ fontWeight: 600, color: '#131C4E' }}>{m.fullName || '—'}</span>
                          <span>{m.relationship || (m.isPrincipal ? 'Principal' : '—')}</span>
                          <span>{m.membershipNo || '—'}</span>
                          <span>{m.sex || '—'}</span>
                          <span style={{ color: '#D97706', fontWeight: 600 }}>{m.status}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isDeclining && (
                    <div style={{ padding: '16px 22px', borderTop: '1px solid #FECACA', background: '#FFF8F8' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Reason for declining (required)</label>
                      <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={2} placeholder="e.g. Employee no longer with the company"
                        style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #FECACA', borderRadius: 10, background: '#fff', color: '#131C4E', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => { setDecliningCif(null); setDeclineReason(''); }} disabled={isBusy}
                          style={{ height: 38, padding: '0 16px', fontSize: 12.5, fontWeight: 600, color: '#6B7280', border: '1px solid #E5E7F1', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => handleDecline(g)} disabled={isBusy || !declineReason.trim()}
                          style={{ height: 38, padding: '0 18px', fontSize: 12.5, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 10, background: !declineReason.trim() ? '#E5E7F1' : 'linear-gradient(135deg,#EF4444,#DC2626)', cursor: isBusy || !declineReason.trim() ? 'not-allowed' : 'pointer' }}>
                          {isBusy ? 'Declining…' : 'Confirm Decline'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}
