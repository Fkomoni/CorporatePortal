'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, RefreshCw, Search } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';

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

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  VIEW_MEMBERS:         { bg: '#EFF6FF', text: '#2563EB' },
  EXPORT_MEMBERS:       { bg: '#F0FDF4', text: '#16A34A' },
  VIEW_CLAIMS:          { bg: '#FFF7ED', text: '#EA580C' },
  EXPORT_CLAIMS:        { bg: '#F0FDF4', text: '#16A34A' },
  CHANGE_PASSWORD:      { bg: '#FEF2F2', text: '#DC2626' },
  VIEW_PORTAL_USERS:    { bg: '#F5F3FF', text: '#7C3AED' },
  TOGGLE_USER_STATUS:   { bg: '#FFFBEB', text: '#D97706' },
  VIEW_DASHBOARD:       { bg: '#F0FDF4', text: '#16A34A' },
  VIEW_COMPANY_PROFILE: { bg: '#F1F5F9', text: '#64748B' },
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function actionLabel(action: string) {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

const PER_PAGE = 100;

export default function HRAuditLogsPage() {
  const [logs, setLogs]       = useState<AuditLogEntry[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [offset, setOffset]   = useState(0);

  const load = useCallback(async (off = 0) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: String(PER_PAGE), offset: String(off) });
      const res  = await fetch(`/api/hr/audit-logs?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setLogs(json.logs ?? []);
      setTotal(json.total ?? 0);
      setOffset(off);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  const filtered = search.trim()
    ? logs.filter((l) =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.userName.toLowerCase().includes(search.toLowerCase()) ||
        l.userEmail.toLowerCase().includes(search.toLowerCase()) ||
        l.resource.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const totalPages  = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.floor(offset / PER_PAGE) + 1;

  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' };

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Audit Log" subtitle="Activity history for your company's portal account" />

      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HEADER ROW */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#FFF1E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList style={{ width: 18, height: 18, color: '#F56B22' }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Activity History</p>
              <p style={{ fontSize: 12, color: '#9CA3B8' }}>
                {loading ? 'Loading…' : `${total.toLocaleString()} event${total !== 1 ? 's' : ''} recorded`}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#B0B7C9' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by user, action…"
                style={{ height: 36, padding: '0 14px 0 30px', fontSize: 12, border: '1px solid #E5E7F1', borderRadius: 20, background: '#fff', outline: 'none', width: 220 }}
              />
            </div>
            <button
              onClick={() => load(0)}
              disabled={loading}
              style={{ height: 36, padding: '0 14px', fontSize: 12, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 20, background: '#fff', color: '#6B7280', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1 }}>
              <RefreshCw style={{ width: 12, height: 12 }} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13 }}>{error}</div>
        )}

        {/* TABLE */}
        <div style={card}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr 160px 130px', columnGap: 12, padding: '10px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
            {['Time', 'Event', 'User', 'Module'].map((h) => (
              <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9CA3B8', fontSize: 13 }}>Loading audit log…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <ClipboardList style={{ width: 36, height: 36, margin: '0 auto 12px', color: '#E5E7F1' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#131C4E', marginBottom: 4 }}>No activity recorded yet</p>
              <p style={{ fontSize: 12, color: '#9CA3B8' }}>Actions taken in the portal — viewing members, claims, changing passwords — will appear here</p>
            </div>
          ) : (
            filtered.map((log) => {
              const ac = ACTION_COLORS[log.action] ?? { bg: '#F1F5F9', text: '#6B7280' };
              const label = actionLabel(log.action);
              const d = (log.details ?? {}) as Record<string, unknown>;
              const detailLine = d.totalCount !== undefined
                ? `${String(d.totalCount)} records`
                : d.totalClaims !== undefined
                  ? `${String(d.totalClaims)} claims`
                  : d.targetUserName
                    ? `${String(d.targetUserName)} → ${String(d.newStatus ?? '')}`
                    : null;

              return (
                <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 160px 130px', columnGap: 12, alignItems: 'center', padding: '13px 24px', borderBottom: '1px solid #F7F8FA' }}>
                  <span style={{ fontSize: 11.5, color: '#9CA3B8', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(log.timestamp)}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{label}</p>
                    {detailLine && <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>{detailLine}</p>}
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.userName}</p>
                    <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.userEmail}</p>
                  </div>
                  <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 8, fontSize: 10.5, fontWeight: 700, background: ac.bg, color: ac.text, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em', width: 'fit-content' }}>
                    {log.resource}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => load(Math.max(0, offset - PER_PAGE))} disabled={offset === 0 || loading}
              style={{ height: 32, padding: '0 14px', fontSize: 12, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 8, background: '#fff', color: '#6B7280', cursor: 'pointer', opacity: offset === 0 ? 0.4 : 1 }}>
              Previous
            </button>
            <span style={{ fontSize: 12, color: '#9CA3B8' }}>Page {currentPage} of {totalPages}</span>
            <button onClick={() => load(offset + PER_PAGE)} disabled={offset + PER_PAGE >= total || loading}
              style={{ height: 32, padding: '0 14px', fontSize: 12, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 8, background: '#fff', color: '#6B7280', cursor: 'pointer', opacity: offset + PER_PAGE >= total ? 0.4 : 1 }}>
              Next
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
