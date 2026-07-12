'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardCheck, Check, X, RefreshCw, Calendar } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { useToast } from '@/components/ui/Toast';
import type { PendingGroup } from '@/app/api/hr/members/pending/route';

interface BeneficiaryRow {
  rowId: string;
  cifNumber: string;
  parentCif: string;
  staffName: string;
  beneficiaryName: string;
  relationship: string;
  age: number | null;
  registrationDate: string | null;
  membershipNo: string;
  sex: string;
  status: string;
  email: string;
  schemeName: string;
  registrationSource: 'Corporate Portal' | 'Enrolee App';
}

function flattenRows(groups: PendingGroup[]): BeneficiaryRow[] {
  const rows: BeneficiaryRow[] = [];
  for (const g of groups) {
    for (const m of g.members) {
      // Principals who self-register via their own HR-issued link also land
      // in this same pending-activation queue now, so they need approval too.
      rows.push({
        rowId: `${g.parentCif}-${m.cifNumber}`,
        cifNumber: m.cifNumber,
        parentCif: g.parentCif,
        staffName: g.principalName || `CIF ${g.parentCif}`,
        beneficiaryName: m.fullName || '—',
        relationship: m.relationship || 'Dependant',
        age: m.age,
        registrationDate: m.registrationDate,
        membershipNo: m.membershipNo || '—',
        sex: m.sex || '—',
        status: m.status,
        email: g.email,
        schemeName: m.schemeName || g.schemeName || '—',
        registrationSource: m.registrationSource,
      });
    }
  }
  return rows;
}

export default function PendingEnroleesPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<PendingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [decliningCif, setDecliningCif] = useState<string | null>(null); // null = not declining; 'bulk' = declining current selection
  const [declineReason, setDeclineReason] = useState('');
  const [busyCif, setBusyCif] = useState<string | null>(null); // parentCif or 'bulk'

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

  const rows = useMemo(() => flattenRows(groups), [groups]);
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleRow(rowId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.rowId)));
  }

  // ApproveEnrollees/RejectEnrollees each act on a single member's own CIF —
  // remove by that CIF, not the whole family's parentCif, so acting on one
  // dependant never drops unrelated siblings from the pending list.
  function removeCifNumbers(cifs: Set<string>) {
    setGroups((prev) => prev
      .map((g) => ({ ...g, members: g.members.filter((m) => !cifs.has(m.cifNumber)) }))
      .filter((g) => g.members.length > 0));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of rows) if (cifs.has(r.cifNumber)) next.delete(r.rowId);
      return next;
    });
  }

  async function approveCifs(cifs: string[]) {
    let updated = 0;
    let failed = 0;
    for (const cifNumber of cifs) {
      const row = rows.find((r) => r.cifNumber === cifNumber);
      try {
        const res = await fetch('/api/hr/members/pending/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentCif: row?.parentCif ?? cifNumber, principalName: row?.staffName, cifNumbers: [cifNumber] }),
        });
        const data = await res.json();
        if (!res.ok || data.error) failed++; else updated += data.recordsUpdated ?? 1;
      } catch { failed++; }
    }
    return { updated, failed };
  }

  async function handleApproveOne(row: BeneficiaryRow) {
    setBusyCif(row.cifNumber);
    const { updated, failed } = await approveCifs([row.cifNumber]);
    setBusyCif(null);
    if (failed) { toast(`Failed to approve ${row.beneficiaryName}.`, 'error'); return; }
    toast(`${row.beneficiaryName} approved${updated ? ` (${updated} record${updated !== 1 ? 's' : ''})` : ''}.`, 'success');
    removeCifNumbers(new Set([row.cifNumber]));
  }

  async function handleApproveSelected() {
    const cifs = [...new Set(rows.filter((r) => selected.has(r.rowId)).map((r) => r.cifNumber))];
    if (cifs.length === 0) return;
    setBusyCif('bulk');
    const { updated, failed } = await approveCifs(cifs);
    setBusyCif(null);
    if (failed) toast(`${failed} approval${failed !== 1 ? 's' : ''} failed. Please retry.`, failed === cifs.length ? 'error' : 'info');
    if (updated) toast(`Approved ${updated} record${updated !== 1 ? 's' : ''}.`, 'success');
    removeCifNumbers(new Set(cifs));
  }

  async function handleDecline(cifs: string[]) {
    if (!declineReason.trim()) { toast('Please provide a reason for declining.', 'error'); return; }
    setBusyCif(cifs.length > 1 ? 'bulk' : cifs[0]);
    let failed = 0;
    for (const cifNumber of cifs) {
      const row = rows.find((r) => r.cifNumber === cifNumber);
      try {
        const res = await fetch('/api/hr/members/pending/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentCif: row?.parentCif ?? cifNumber, principalName: row?.staffName, reason: declineReason.trim(), email: row?.email, cifNumbers: [cifNumber] }),
        });
        const data = await res.json();
        if (!res.ok || data.error) failed++;
      } catch { failed++; }
    }
    setBusyCif(null);
    if (failed) toast(`${failed} decline${failed !== 1 ? 's' : ''} failed. Please retry.`, failed === cifs.length ? 'error' : 'info');
    if (failed < cifs.length) toast(`Declined ${cifs.length - failed} record${cifs.length - failed !== 1 ? 's' : ''}.`, 'success');
    removeCifNumbers(new Set(cifs));
    setDecliningCif(null);
    setDeclineReason('');
  }

  const inputStyle: React.CSSProperties = { height: 40, padding: '0 12px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none' };

  const decliningCifs = decliningCif === 'bulk'
    ? [...new Set(rows.filter((r) => selected.has(r.rowId)).map((r) => r.cifNumber))]
    : decliningCif ? [decliningCif] : [];

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
              <div key={i} style={{ height: 56, borderRadius: 12, background: '#F0F1F5', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13 }}>{error}</div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #EDEEF2', padding: '48px 40px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <ClipboardCheck style={{ width: 26, height: 26, color: '#059669' }} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E', marginBottom: 8 }}>All caught up</p>
            <p style={{ fontSize: 13, color: '#9CA3B8', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
              No beneficiaries {from || to ? 'in this date range' : 'awaiting your approval right now'}.
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            {/* Bulk action bar */}
            {selected.size > 0 && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #FFD8C0', boxShadow: '0 4px 16px rgba(245,107,34,0.10)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{selected.size}</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', flex: 1 }}>beneficiar{selected.size > 1 ? 'ies' : 'y'} selected</span>
                <button onClick={() => setDecliningCif('bulk')} disabled={busyCif === 'bulk'}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, height: 38, padding: '0 16px', fontSize: 12.5, fontWeight: 700, color: '#DC2626', border: '1px solid #FECACA', borderRadius: 12, background: '#FEF2F2', cursor: busyCif === 'bulk' ? 'wait' : 'pointer' }}>
                  <X style={{ width: 13, height: 13 }} /> Decline Selected
                </button>
                <button onClick={handleApproveSelected} disabled={busyCif === 'bulk'}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, height: 38, padding: '0 16px', fontSize: 12.5, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#10B981,#059669)', cursor: busyCif === 'bulk' ? 'wait' : 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.28)' }}>
                  <Check style={{ width: 13, height: 13 }} /> {busyCif === 'bulk' ? 'Approving…' : 'Approve Selected'}
                </button>
              </div>
            )}

            {decliningCif && (
              <div style={{ padding: '16px 20px', borderRadius: 16, border: '1.5px solid #FECACA', background: '#FFF8F8' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Reason for declining {decliningCifs.length > 1 ? `${decliningCifs.length} beneficiaries` : ''} (required)
                </label>
                <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={2} placeholder="e.g. Not an eligible dependant"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #FECACA', borderRadius: 10, background: '#fff', color: '#131C4E', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => { setDecliningCif(null); setDeclineReason(''); }} disabled={busyCif !== null}
                    style={{ height: 38, padding: '0 16px', fontSize: 12.5, fontWeight: 600, color: '#6B7280', border: '1px solid #E5E7F1', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => handleDecline(decliningCifs)} disabled={busyCif !== null || !declineReason.trim()}
                    style={{ height: 38, padding: '0 18px', fontSize: 12.5, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 10, background: !declineReason.trim() ? '#E5E7F1' : 'linear-gradient(135deg,#EF4444,#DC2626)', cursor: busyCif !== null || !declineReason.trim() ? 'not-allowed' : 'pointer' }}>
                    {busyCif !== null ? 'Declining…' : 'Confirm Decline'}
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
              <div style={{ minWidth: 1180 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 0.7fr 0.35fr 0.75fr 0.75fr 0.8fr 0.75fr 0.4fr 0.75fr 190px', gap: 10, padding: '12px 20px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5', fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.05em', alignItems: 'center' }}>
                <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected; }} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                <span>Staff Name</span>
                <span>Beneficiary</span>
                <span>Relationship</span>
                <span>Age</span>
                <span>Date Registered</span>
                <span>Scheme</span>
                <span>Reg. Source</span>
                <span>Membership No</span>
                <span>Sex</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {rows.map((row) => {
                const isSelected = selected.has(row.rowId);
                const isBusy = busyCif === row.cifNumber || busyCif === 'bulk';
                return (
                  <div key={row.rowId}
                    style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 0.7fr 0.35fr 0.75fr 0.75fr 0.8fr 0.75fr 0.4fr 0.75fr 190px', gap: 10, padding: '14px 20px', borderBottom: '1px solid #F7F8FA', fontSize: 12.5, color: '#374151', alignItems: 'center', background: isSelected ? '#FFF8F5' : '#fff' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(row.rowId)} style={{ cursor: 'pointer' }} />
                    <span style={{ fontWeight: 600, color: '#131C4E' }}>{row.staffName}</span>
                    <span style={{ fontWeight: 600, color: '#131C4E' }}>{row.beneficiaryName}</span>
                    <span>{row.relationship}</span>
                    <span>{row.age != null ? row.age : '—'}</span>
                    <span>{row.registrationDate || '—'}</span>
                    <span>{row.schemeName}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 20, display: 'inline-block', width: 'fit-content', color: row.registrationSource === 'Corporate Portal' ? '#2563EB' : '#7C3AED', background: row.registrationSource === 'Corporate Portal' ? '#EFF6FF' : '#F5F3FF' }}>
                      {row.registrationSource}
                    </span>
                    <span>{row.membershipNo}</span>
                    <span>{row.sex}</span>
                    <span style={{ color: '#D97706', fontWeight: 600 }}>{row.status}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setDecliningCif(row.cifNumber); setDeclineReason(''); }} disabled={isBusy}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', fontSize: 11.5, fontWeight: 700, color: '#DC2626', border: '1px solid #FECACA', borderRadius: 9, background: '#FEF2F2', cursor: isBusy ? 'wait' : 'pointer' }}>
                        <X style={{ width: 11, height: 11 }} /> Decline
                      </button>
                      <button onClick={() => handleApproveOne(row)} disabled={isBusy}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', fontSize: 11.5, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 9, background: 'linear-gradient(135deg,#10B981,#059669)', cursor: isBusy ? 'wait' : 'pointer' }}>
                        <Check style={{ width: 11, height: 11 }} /> {busyCif === row.cifNumber ? '…' : 'Approve'}
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}
