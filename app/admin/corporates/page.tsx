'use client';

import { useState } from 'react';
import { Search, RefreshCw, ArrowDownToLine } from 'lucide-react';
import Link from 'next/link';

const mockCorporates = [
  { id: 'corp-001', name: 'Dangote Industries Ltd',            template: 'Default template', dateProvisioned: '2024-01-15', adminEmail: 'f.komoni@dangote.com',         status: 'Active'  },
  { id: 'corp-002', name: 'SME - Herconomy',                   template: 'Default template', dateProvisioned: '2026-06-24', adminEmail: 'osaze.tom@cubecover.ai',       status: 'Pending' },
  { id: 'corp-003', name: 'Edves Nigeria Limited',             template: 'Default template', dateProvisioned: '2026-06-24', adminEmail: 'hr@edves.net',                  status: 'Pending' },
  { id: 'corp-004', name: 'Jackson, Etti And Edu (JEE Africa)',template: 'Default template', dateProvisioned: '2026-06-24', adminEmail: 'noemail@gmail.com',             status: 'Pending' },
  { id: 'corp-005', name: 'Flour Mills of Nigeria Plc',        template: 'Default template', dateProvisioned: '2025-03-10', adminEmail: 'hr.admin@fmnplc.com',          status: 'Active'  },
  { id: 'corp-006', name: 'Baker Hughes Nigeria Ltd',          template: 'Custom template',  dateProvisioned: '2023-08-22', adminEmail: 'c.eze@bakerhughes.com',        status: 'Active'  },
  { id: 'corp-007', name: 'NLNG – Nigeria LNG Limited',        template: 'Default template', dateProvisioned: '2024-06-01', adminEmail: 'hr@nlng.com.ng',               status: 'Active'  },
  { id: 'corp-008', name: 'Zenith Bank Plc',                   template: 'Premium template', dateProvisioned: '2024-09-15', adminEmail: 'corp.health@zenithbank.com',   status: 'Active'  },
  { id: 'corp-009', name: 'Primus Pharmacare Ltd',             template: 'Default template', dateProvisioned: '2025-11-02', adminEmail: 'hr@primusng.com',              status: 'Pending' },
  { id: 'corp-010', name: 'Okomu Oil Palm Company Plc',        template: 'Default template', dateProvisioned: '2025-07-18', adminEmail: 'admin@okomuoil.com',           status: 'Active'  },
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });

const statusStyle: Record<string, { bg: string; text: string; dot: string }> = {
  Active:  { bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
  Pending: { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
};

export default function CorporatesPage() {
  const [search, setSearch]     = useState('');
  const [syncing, setSyncing]   = useState(false);

  const filtered = mockCorporates.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.adminEmail.toLowerCase().includes(search.toLowerCase())
  );

  function handleSync() {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1800);
  }

  const card = { background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>

      {/* TOP BAR */}
      <header style={{ background: '#fff', borderBottom: '1px solid #F0F1F5', height: 58, display: 'flex', alignItems: 'center', padding: '0 36px', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Corporates</h1>
          <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>Manage client schemes · Provision access</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#131C4E,#3A4382)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff' }}>G</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>Gideon</span>
        </div>
      </header>

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* TOOLBAR */}
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em' }}>
                Provision Corporates <span style={{ color: '#F56B22' }}>({mockCorporates.length.toLocaleString()})</span>
              </p>
            </div>
            <div style={{ flex: 1 }} />
            {/* Search */}
            <div style={{ position: 'relative', width: 280 }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#C4C9D9' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                style={{ width: '100%', height: 40, paddingLeft: 38, paddingRight: 12, fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 12, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
            </div>
            {/* Download */}
            <button style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid #E5E7F1', background: '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowDownToLine style={{ width: 15, height: 15, color: '#6B7280' }} />
            </button>
            {/* Refresh / Sync */}
            <button onClick={handleSync}
              style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid #E5E7F1', background: syncing ? '#FFF5EF' : '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
              title="Sync with Prognosis">
              <RefreshCw style={{ width: 15, height: 15, color: syncing ? '#F56B22' : '#6B7280', animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div style={{ ...card, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 150px 220px 100px', columnGap: 12, padding: '11px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
            {['Name', 'Template', 'Date Provisioned', 'Admin', 'Status'].map((h) => (
              <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 4 }}>
                {h} {h !== 'Status' && <span style={{ color: '#D0D4E0', fontSize: 10 }}>↕</span>}
              </span>
            ))}
          </div>

          {filtered.map((c) => {
            const st = statusStyle[c.status] ?? statusStyle['Pending'];
            const initials = c.name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
            return (
              <Link key={c.id} href={`/admin/corporates/${c.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 150px 220px 100px', columnGap: 12, alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F7F8FA', cursor: 'pointer', transition: 'background 0.12s' }}
                  className="last:border-0 hover:bg-[#FAFBFC]">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{initials}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{c.name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#9CA3B8' }}>{c.template}</span>
                  <span style={{ fontSize: 12, color: '#9CA3B8' }}>{fmtDate(c.dateProvisioned)}</span>
                  <span style={{ fontSize: 12, color: '#9CA3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.adminEmail}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: st.bg, color: st.text, width: 'fit-content' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot }} />{c.status}
                  </span>
                </div>
              </Link>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#131C4E' }}>No corporates found</p>
              <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 4 }}>Try adjusting your search</p>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid #F0F1F5' }}>
            <p style={{ fontSize: 12, color: '#9CA3B8' }}>Showing {filtered.length} of {mockCorporates.length} corporates</p>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['‹', '1', '2', '3', '›'] as const).map((p) => (
                <button key={p} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: p === '1' ? 'none' : '1px solid #E5E7F1', borderRadius: 8, cursor: 'pointer', fontSize: p === '‹' || p === '›' ? 14 : 12, fontWeight: p === '1' ? 700 : 500, background: p === '1' ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : '#fff', color: p === '1' ? '#fff' : '#6B7280', boxShadow: p === '1' ? '0 2px 6px rgba(245,107,34,0.28)' : 'none' }}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
