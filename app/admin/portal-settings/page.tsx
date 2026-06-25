'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, BarChart2, DollarSign, Download, SlidersHorizontal, List, CheckCircle } from 'lucide-react';
import { ClaimsVisibility, DEFAULT_CLAIMS_VISIBILITY, getClaimsVisibility, saveClaimsVisibility } from '@/lib/claims-visibility';

const SECTIONS: {
  key: keyof ClaimsVisibility;
  label: string;
  desc: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  {
    key:   'showSummaryCards',
    label: 'Summary Statistics',
    desc:  'The 4 stat cards at the top — Total Paid YTD, Processing, Queried, Rejected',
    Icon:  BarChart2,
    color: '#2563EB',
    bg:    '#EFF6FF',
  },
  {
    key:   'showAmounts',
    label: 'Financial Amounts (₦)',
    desc:  'Monetary values in stat cards and the Amount column of the claims table',
    Icon:  DollarSign,
    color: '#059669',
    bg:    '#ECFDF5',
  },
  {
    key:   'showExports',
    label: 'Export Buttons (XLS / PDF)',
    desc:  'Allow HR administrators to download the claims register',
    Icon:  Download,
    color: '#D97706',
    bg:    '#FFFBEB',
  },
  {
    key:   'showFilters',
    label: 'Filter & Search Toolbar',
    desc:  'Category, Status, Plan filters and the search box above the table',
    Icon:  SlidersHorizontal,
    color: '#7C3AED',
    bg:    '#F5F3FF',
  },
  {
    key:   'showTable',
    label: 'Claims Register Table',
    desc:  'The full list of individual claim records',
    Icon:  List,
    color: '#131C4E',
    bg:    '#F1F5F9',
  },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 48,
        height: 26,
        borderRadius: 13,
        border: 'none',
        cursor: 'pointer',
        padding: 3,
        background: on ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : '#E5E7F1',
        transition: 'background 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        flexShrink: 0,
        boxShadow: on ? '0 2px 8px rgba(245,107,34,0.35)' : 'none',
      }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.18)', display: 'block', transition: 'all 0.2s' }} />
    </button>
  );
}

export default function PortalSettingsPage() {
  const [vis, setVis] = useState<ClaimsVisibility>(DEFAULT_CLAIMS_VISIBILITY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setVis(getClaimsVisibility());
  }, []);

  function toggle(key: keyof ClaimsVisibility) {
    setVis((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveClaimsVisibility(next);
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function resetAll() {
    setVis(DEFAULT_CLAIMS_VISIBILITY);
    saveClaimsVisibility(DEFAULT_CLAIMS_VISIBILITY);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const allOn  = SECTIONS.every((s) => vis[s.key]);
  const allOff = SECTIONS.every((s) => !vis[s.key]);

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #F0F1F5', height: 68, display: 'flex', alignItems: 'center', padding: '0 36px', gap: 16, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Portal Settings</h1>
          <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2, fontWeight: 500 }}>Visibility controls · Claims module</p>
        </div>
        {saved && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}>
            <CheckCircle style={{ width: 14, height: 14 }} /> Saved
          </div>
        )}
      </header>

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 780 }}>

        {/* Intro card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '22px 28px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Eye style={{ width: 20, height: 20, color: '#F56B22' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#131C4E', marginBottom: 4 }}>Claims Module — HR Visibility</p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
              Use the toggles below to control what HR administrators see on the <strong>Claims</strong> page of the corporate portal.
              Changes take effect immediately — no reload required on the HR side.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => { const all = { ...vis }; SECTIONS.forEach(s => (all[s.key] = true)); setVis(all); saveClaimsVisibility(all); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
              style={{ height: 34, padding: '0 16px', fontSize: 12, fontWeight: 700, color: '#059669', border: '1.5px solid #A7F3D0', borderRadius: 10, background: '#ECFDF5', cursor: 'pointer', opacity: allOn ? 0.4 : 1 }}>
              Show All
            </button>
            <button onClick={() => { const all = { ...vis }; SECTIONS.forEach(s => (all[s.key] = false)); setVis(all); saveClaimsVisibility(all); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
              style={{ height: 34, padding: '0 16px', fontSize: 12, fontWeight: 700, color: '#DC2626', border: '1.5px solid #FECACA', borderRadius: 10, background: '#FEF2F2', cursor: 'pointer', opacity: allOff ? 0.4 : 1 }}>
              Hide All
            </button>
          </div>
        </div>

        {/* Toggle list */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', overflow: 'hidden' }}>
          {SECTIONS.map((s, i) => {
            const on = vis[s.key];
            const Icon = s.Icon;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '20px 28px', borderBottom: i < SECTIONS.length - 1 ? '1px solid #F7F8FA' : 'none', transition: 'background 0.1s', background: on ? '#fff' : '#FAFBFC' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: on ? s.bg : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}>
                  <Icon style={{ width: 20, height: 20, color: on ? s.color : '#9CA3B8', transition: 'color 0.2s' }} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: on ? '#131C4E' : '#9CA3B8', transition: 'color 0.2s' }}>{s.label}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: on ? '#ECFDF5' : '#F3F4F6', color: on ? '#059669' : '#9CA3B8', border: `1px solid ${on ? '#A7F3D0' : '#E5E7EB'}`, transition: 'all 0.2s' }}>
                      {on ? 'VISIBLE' : 'HIDDEN'}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 3, lineHeight: 1.5 }}>{s.desc}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {on ? <Eye style={{ width: 14, height: 14, color: '#10B981' }} /> : <EyeOff style={{ width: 14, height: 14, color: '#D1D5DB' }} />}
                  <Toggle on={on} onChange={() => toggle(s.key)} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Reset */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={resetAll} style={{ height: 38, padding: '0 20px', fontSize: 13, fontWeight: 600, color: '#6B7280', border: '1px solid #E5E7F1', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
