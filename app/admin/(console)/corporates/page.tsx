'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ArrowDownToLine, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface Policy {
  id: string; groupId: string; name: string; schemeCode: string;
  dateProvisioned: string; adminEmail: string; contactName: string;
  status: string; activeMembers: number; template: string; colors: string[];
}

const PER_PAGE = 50;

const fmtDate = (d: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusStyle: Record<string, { bg: string; text: string; dot: string }> = {
  Active:   { bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
  Pending:  { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
  Inactive: { bg: '#F9FAFB', text: '#6B7280', dot: '#9CA3AF' },
};

export default function CorporatesPage() {
  const { data: session } = useSession();
  const staffName = (session?.user as { name?: string })?.name ?? 'Staff';
  const initials  = staffName.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'S';

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [syncing, setSyncing]   = useState(false);

  // Bump this when the API response shape changes to bust the cache automatically
  const CACHE_KEY = 'admin_policies_v3';

  const loadPolicies = useCallback(async () => {
    setError('');
    try {
      const res  = await fetch('/api/admin/policies');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      const list: Policy[] = json.policies ?? [];
      setPolicies(list);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load policies');
    }
  }, []);

  useEffect(() => {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try { setPolicies(JSON.parse(cached)); setLoading(false); return; } catch { /* fallthrough */ }
    }
    loadPolicies().finally(() => setLoading(false));
  }, [loadPolicies]);

  async function handleSync() {
    setSyncing(true);
    await loadPolicies();
    setSyncing(false);
  }

  const filtered = policies.filter((c) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.adminEmail.toLowerCase().includes(search.toLowerCase()) ||
    c.schemeCode.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const card = { background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };

  // Page number buttons: show up to 5 around current page
  const pageButtons = () => {
    const pages: (number | '…')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('…');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('…');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>

      {/* TOP BAR */}
      <header style={{ background: '#fff', borderBottom: '1px solid #F0F1F5', height: 58, display: 'flex', alignItems: 'center', padding: '0 36px', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Corporates</h1>
          <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>Manage client schemes · Provision access</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#131C4E,#3A4382)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff' }}>{initials}</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{staffName.split(' ')[0]}</span>
        </div>
      </header>

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* TOOLBAR */}
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em' }}>
                Provision Corporates{' '}
                <span style={{ color: '#F56B22' }}>
                  ({loading ? '…' : filtered.length.toLocaleString()})
                </span>
              </p>
            </div>
            <div style={{ flex: 1 }} />
            {/* Search */}
            <div style={{ position: 'relative', width: 280 }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#C4C9D9' }} />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, email or scheme..."
                style={{ width: '100%', height: 40, paddingLeft: 38, paddingRight: 12, fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 12, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
            </div>
            {/* Download */}
            <button style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid #E5E7F1', background: '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowDownToLine style={{ width: 15, height: 15, color: '#6B7280' }} />
            </button>
            {/* Refresh / Sync */}
            <button onClick={handleSync} disabled={syncing}
              style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid #E5E7F1', background: syncing ? '#FFF5EF' : '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
              title="Sync with Prognosis">
              <RefreshCw style={{ width: 15, height: 15, color: syncing ? '#F56B22' : '#6B7280', animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div style={{ ...card, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 130px 200px 180px 100px', columnGap: 12, padding: '11px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
            {['Name', 'Date Provisioned', 'Admin Email', 'Contact', 'Status'].map((h) => (
              <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 4 }}>
                {h} {h !== 'Status' && <span style={{ color: '#D0D4E0', fontSize: 10 }}>↕</span>}
              </span>
            ))}
          </div>

          {/* Loading skeleton */}
          {loading && (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 130px 200px 180px 100px', columnGap: 12, alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F7F8FA' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0F1F5', flexShrink: 0 }} />
                  <div style={{ height: 12, width: `${120 + (i * 17) % 80}px`, background: '#F0F1F5', borderRadius: 4 }} />
                </div>
                <div style={{ height: 12, width: 80, background: '#F0F1F5', borderRadius: 4 }} />
                <div style={{ height: 12, width: 140, background: '#F0F1F5', borderRadius: 4 }} />
                <div style={{ height: 12, width: 110, background: '#F0F1F5', borderRadius: 4 }} />
                <div style={{ height: 22, width: 60, background: '#F0F1F5', borderRadius: 8 }} />
              </div>
            ))
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 600, marginBottom: 8 }}>{error}</p>
              <button onClick={handleSync} style={{ fontSize: 12, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Try again</button>
            </div>
          )}

          {/* Rows */}
          {!loading && !error && paged.map((c, idx) => {
            const st = statusStyle[c.status] ?? statusStyle['Inactive'];
            const sn = (safePage - 1) * PER_PAGE + idx + 1;
            return (
              <Link key={c.id} href={`/admin/corporates/${encodeURIComponent(c.groupId || c.id)}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 130px 200px 180px 100px', columnGap: 12, alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #F7F8FA', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0F1F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#9CA3B8', flexShrink: 0 }}>{sn}</div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', margin: 0 }}>{c.name}</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', margin: 0, marginTop: 1 }}>{c.schemeCode}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#9CA3B8' }}>{fmtDate(c.dateProvisioned)}</span>
                  <span style={{ fontSize: 12, color: '#9CA3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.adminEmail || '—'}</span>
                  <span style={{ fontSize: 12, color: '#9CA3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contactName || '—'}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: st.bg, color: st.text, width: 'fit-content' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot }} />{c.status}
                  </span>
                </div>
              </Link>
            );
          })}

          {!loading && !error && paged.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#131C4E' }}>No corporates found</p>
              <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 4 }}>Try adjusting your search</p>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid #F0F1F5' }}>
              <p style={{ fontSize: 12, color: '#9CA3B8' }}>
                Showing {((safePage - 1) * PER_PAGE + 1).toLocaleString()}–{Math.min(safePage * PER_PAGE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()} corporates
              </p>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                  style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7F1', borderRadius: 8, cursor: safePage === 1 ? 'default' : 'pointer', background: '#fff', opacity: safePage === 1 ? 0.4 : 1 }}>
                  <ChevronLeft style={{ width: 14, height: 14, color: '#6B7280' }} />
                </button>
                {pageButtons().map((p, i) => (
                  p === '…'
                    ? <span key={`e${i}`} style={{ width: 30, textAlign: 'center', fontSize: 12, color: '#B0B7C9' }}>…</span>
                    : <button key={p} onClick={() => setPage(p as number)}
                        style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: p === safePage ? 'none' : '1px solid #E5E7F1', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: p === safePage ? 700 : 500, background: p === safePage ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : '#fff', color: p === safePage ? '#fff' : '#6B7280', boxShadow: p === safePage ? '0 2px 6px rgba(245,107,34,0.28)' : 'none' }}>{p}</button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7F1', borderRadius: 8, cursor: safePage === totalPages ? 'default' : 'pointer', background: '#fff', opacity: safePage === totalPages ? 0.4 : 1 }}>
                  <ChevronRight style={{ width: 14, height: 14, color: '#6B7280' }} />
                </button>
              </div>
            </div>
          )}

          {!loading && !error && totalPages <= 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid #F0F1F5' }}>
              <p style={{ fontSize: 12, color: '#9CA3B8' }}>Showing {paged.length} of {filtered.length} corporates</p>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
