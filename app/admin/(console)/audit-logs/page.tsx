'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ClipboardList } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  userEmail: string;
  userName: string;
  userRole: string;
  loginType: string;
  companyId: string | null;
  companyName: string | null;
  action: string;
  resource: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  VIEW_MEMBERS:         { bg: '#EFF6FF', text: '#2563EB' },
  EXPORT_MEMBERS:       { bg: '#F0FDF4', text: '#16A34A' },
  VIEW_CLAIMS:          { bg: '#FFF7ED', text: '#EA580C' },
  EXPORT_CLAIMS:        { bg: '#F0FDF4', text: '#16A34A' },
  CHANGE_PASSWORD:      { bg: '#FEF2F2', text: '#DC2626' },
  VIEW_PORTAL_USERS:    { bg: '#F5F3FF', text: '#7C3AED' },
  TOGGLE_USER_STATUS:   { bg: '#FFFBEB', text: '#D97706' },
  VIEW_CORPORATES:      { bg: '#F1F5F9', text: '#475569' },
  VIEW_CORPORATE_DETAIL:{ bg: '#F1F5F9', text: '#334155' },
  SEND_SIGNUP_EMAIL:    { bg: '#ECFDF5', text: '#059669' },
  VIEW_PORTAL_SETTINGS: { bg: '#F5F3FF', text: '#6D28D9' },
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

export default function AuditLogsPage() {
  const [logs, setLogs]         = useState<AuditLogEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [loginFilter, setLoginFilter] = useState('');
  const [offset, setOffset]     = useState(0);

  const load = useCallback(async (off = 0) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: String(PER_PAGE), offset: String(off) });
      if (search.trim())  params.set('search', search.trim());
      if (loginFilter)    params.set('loginType', loginFilter);
      const res  = await fetch(`/api/admin/audit-logs?${params}`);
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
  }, [search, loginFilter]);

  useEffect(() => { load(0); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.floor(offset / PER_PAGE) + 1;

  return (
    <div style={{ padding: '32px 36px', background: '#F7F8FC', minHeight: '100vh' }}>
      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <ClipboardList style={{ width: 20, height: 20, color: '#F56B22' }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em' }}>Audit Logs</h1>
        </div>
        <p style={{ fontSize: 13, color: '#9CA3B8' }}>All portal activity across all HR and staff accounts</p>
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 380 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#B0B7C9' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(0); }}
            placeholder="Search by user, company, action…"
            style={{ width: '100%', height: 38, padding: '0 14px 0 34px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 20, background: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={loginFilter}
          onChange={(e) => setLoginFilter(e.target.value)}
          style={{ height: 38, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 20, background: '#fff', color: '#131C4E', cursor: 'pointer', outline: 'none' }}>
          <option value="">All users</option>
          <option value="hr">HR users</option>
          <option value="staff">Leadway staff</option>
        </select>
        <button
          onClick={() => load(0)}
          disabled={loading}
          style={{ height: 38, padding: '0 16px', fontSize: 13, fontWeight: 600, border: '1px solid #E5E7F1', borderRadius: 20, background: '#fff', color: '#6B7280', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: loading ? 0.6 : 1 }}>
          <RefreshCw style={{ width: 13, height: 13 }} />
          Refresh
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9CA3B8', alignSelf: 'center' }}>
          {loading ? 'Loading…' : `${total.toLocaleString()} event${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13 }}>{error}</div>
      )}

      {/* TABLE */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '170px 140px 1fr 150px 130px', columnGap: 12, padding: '10px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
          {['Time', 'Company', 'Event / Details', 'User', 'Action'].map((h) => (
            <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9CA3B8', fontSize: 13 }}>Loading audit logs…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <ClipboardList style={{ width: 32, height: 32, margin: '0 auto 12px', color: '#E5E7F1' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#131C4E', marginBottom: 4 }}>No audit logs found</p>
            <p style={{ fontSize: 12, color: '#9CA3B8' }}>Try adjusting your filters</p>
          </div>
        ) : (
          logs.map((log) => {
            const ac = ACTION_COLORS[log.action] ?? { bg: '#F1F5F9', text: '#6B7280' };
            const label = actionLabel(log.action);
            const detailLine = log.details
              ? (() => {
                  const d = log.details as Record<string, unknown>;
                  if (log.action.includes('PENDING_ENROLEE')) {
                    return [
                      d.beneficiaryName ? `${String(d.beneficiaryName)}${d.relationship ? ` (${String(d.relationship)})` : ''}` : (d.principalName ? String(d.principalName) : null),
                      Array.isArray(d.cifNumbers) && d.cifNumbers.length > 0 ? `CIF ${(d.cifNumbers as unknown[]).join(', ')}` : null,
                      d.effectiveDate ? `effective ${String(d.effectiveDate)}` : null,
                      d.terminationDate ? `terminated ${String(d.terminationDate)}` : null,
                      d.reason ? `reason: ${String(d.reason)}` : null,
                    ].filter(Boolean).join(' · ');
                  }
                  if (d.totalCount !== undefined) return `${d.totalCount} records`;
                  if (d.totalClaims !== undefined) return `${d.totalClaims} claims`;
                  if (d.targetUserName) return `${d.targetUserName} → ${d.newStatus}`;
                  if (log.action === 'SEND_SIGNUP_EMAIL') {
                    return [
                      d.email ? `to ${String(d.email)}` : null,
                      d.PolicyNumber ? `policy ${String(d.PolicyNumber)}` : null,
                      d.emailSent === false ? 'send failed' : null,
                    ].filter(Boolean).join(' · ');
                  }
                  return '';
                })()
              : '';

            return (
              <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '170px 140px 1fr 150px 130px', columnGap: 12, alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #F7F8FA' }}>
                <span style={{ fontSize: 11, color: '#9CA3B8', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(log.timestamp)}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.companyName || '—'}</p>
                  <p style={{ fontSize: 10, color: '#B0B7C9', marginTop: 1 }}>{log.loginType === 'hr' ? 'HR' : 'Staff'}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E' }}>{label}</p>
                  {detailLine && <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>{detailLine}</p>}
                  {log.ipAddress && <p style={{ fontSize: 10, color: '#C4C9D9', marginTop: 1 }}>{log.ipAddress}</p>}
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

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
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
  );
}
