'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BenefitsVis, DEFAULTS, getVis } from '@/lib/module-visibility';
import { Search, MapPin, Phone, CheckCircle, XCircle, Activity, Building2, Heart, Smile, Eye, FlaskConical, AlertTriangle, FileText, Syringe, Sparkles, Stethoscope } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import type { PolicyScheme } from '@/app/api/hr/benefits/schemes/route';
import type { BenefitCategory } from '@/app/api/hr/benefits/scheme-benefits/route';
import type { Provider } from '@/app/api/hr/benefits/providers/route';

// Scheme button accent colours (cycles by index)
const SCHEME_COLORS = [
  { accent: '#C2410C', bg: '#FFEDD5', border: '#C2410C' },
  { accent: '#475569', bg: '#E2E8F0', border: '#475569' },
  { accent: '#D97706', bg: '#FEF3C7', border: '#D97706' },
  { accent: '#2563EB', bg: '#DBEAFE', border: '#2563EB' },
  { accent: '#6D28D9', bg: '#EDE9FE', border: '#6D28D9' },
  { accent: '#059669', bg: '#D1FAE5', border: '#059669' },
  { accent: '#BE123C', bg: '#FFE4E6', border: '#BE123C' },
];

const categoryMeta: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
  Outpatient:                  { Icon: Activity,      color: '#10B981', bg: '#ECFDF5' },
  Inpatient:                   { Icon: Building2,     color: '#3B82F6', bg: '#EFF6FF' },
  Maternity:                   { Icon: Heart,         color: '#EC4899', bg: '#FDF2F8' },
  Dental:                      { Icon: Smile,         color: '#F59E0B', bg: '#FFFBEB' },
  Dentistry:                   { Icon: Smile,         color: '#F59E0B', bg: '#FFFBEB' },
  Optical:                     { Icon: Eye,           color: '#8B5CF6', bg: '#F5F3FF' },
  'Lens and Frames':           { Icon: Eye,           color: '#8B5CF6', bg: '#F5F3FF' },
  Specialist:                  { Icon: FlaskConical,  color: '#0891B2', bg: '#ECFEFF' },
  'Advanced Investigations':   { Icon: FlaskConical,  color: '#0891B2', bg: '#ECFEFF' },
  Surgery:                     { Icon: Stethoscope,   color: '#DC2626', bg: '#FEF2F2' },
  Emergency:                   { Icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2' },
  'Major Disease Benefit':     { Icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2' },
  'Additional Benefits':       { Icon: Activity,      color: '#6D28D9', bg: '#F5F3FF' },
  Gym:                         { Icon: Activity,      color: '#059669', bg: '#ECFDF5' },
  'Health Checks':             { Icon: Activity,      color: '#D97706', bg: '#FFFBEB' },
  'Health Check Basic':        { Icon: Activity,      color: '#D97706', bg: '#FFFBEB' },
  'Immunization Vaccines':     { Icon: Syringe,       color: '#0891B2', bg: '#ECFEFF' },
  'SPA Treatment (Voucher PA )': { Icon: Sparkles,    color: '#7C3AED', bg: '#F5F3FF' },
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  Hospital:   { bg: '#EFF6FF', color: '#2563EB' },
  Optical:    { bg: '#F5F3FF', color: '#7C3AED' },
  Dental:     { bg: '#FFFBEB', color: '#D97706' },
  'Spa/Gym':  { bg: '#ECFDF5', color: '#059669' },
};

export default function BenefitsPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'providers'>('plans');
  const [vis, setBenVis] = useState<BenefitsVis>(DEFAULTS.benefits);
  useEffect(() => { setBenVis(getVis('benefits')); }, []);

  // Schemes (shared between plans + providers tabs)
  const [schemes, setSchemes]               = useState<PolicyScheme[]>([]);
  const [schemesLoading, setSchemesLoading] = useState(true);
  const [schemesError, setSchemesError]     = useState('');
  const [activeSchemeId, setActiveSchemeId] = useState<string>('');

  // Benefit categories
  const [categories, setCategories] = useState<BenefitCategory[]>([]);
  const [bensLoading, setBensLoading] = useState(false);
  const [bensError, setBensError]     = useState('');

  // Providers
  const [providers, setProviders]         = useState<Provider[]>([]);
  const [provLoading, setProvLoading]     = useState(false);
  const [provError, setProvError]         = useState('');
  const [provCounts, setProvCounts]       = useState<{ hospitals: number; eyeClinics: number; dentalClinics: number; spaGyms: number } | null>(null);

  useEffect(() => {
    fetch('/api/hr/benefits/schemes')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setSchemesError(d.error); return; }
        const list: PolicyScheme[] = d.schemes ?? [];
        setSchemes(list);
        if (list.length > 0) setActiveSchemeId(list[0].schemeId);
      })
      .catch(() => setSchemesError('Failed to load schemes'))
      .finally(() => setSchemesLoading(false));
  }, []);

  const loadBenefits = useCallback((schemeId: string) => {
    if (!schemeId) return;
    setBensLoading(true); setBensError('');
    fetch(`/api/hr/benefits/scheme-benefits?schemeId=${encodeURIComponent(schemeId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setBensError(d.error); return; }
        setCategories(d.categories ?? []);
      })
      .catch(() => setBensError('Failed to load benefits'))
      .finally(() => setBensLoading(false));
  }, []);

  const [provRefreshing, setProvRefreshing] = useState(false);

  const loadProviders = useCallback((schemeId: string, fresh = false) => {
    if (!schemeId) return;
    if (fresh) setProvRefreshing(true); else setProvLoading(true);
    setProvError('');
    fetch(`/api/hr/benefits/providers?schemeId=${encodeURIComponent(schemeId)}${fresh ? '&fresh=1' : ''}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setProvError(d.error); return; }
        setProviders(d.providers ?? []);
        setProvCounts(d.counts ?? null);
      })
      .catch(() => setProvError('Failed to load providers'))
      .finally(() => { setProvLoading(false); setProvRefreshing(false); });
  }, []);

  useEffect(() => {
    if (activeSchemeId) {
      loadBenefits(activeSchemeId);
      loadProviders(activeSchemeId);
    }
  }, [activeSchemeId, loadBenefits, loadProviders]);

  // Provider filters
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [stateFilter, setStateFilter] = useState('');

  const allStates = Array.from(new Set(providers.map((p) => p.state).filter(Boolean))).sort();

  const filteredProviders = providers.filter((p) => {
    const q = search.toLowerCase();
    const matchText  = !q || p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.state.toLowerCase().includes(q) || p.address.toLowerCase().includes(q);
    const matchType  = !typeFilter  || p.type  === typeFilter;
    const matchState = !stateFilter || p.state === stateFilter;
    return matchText && matchType && matchState;
  });

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Benefits" subtitle="Plans · Provider Network" />
      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Main tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 4, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {(['plans', 'providers'] as const).filter((t) => t === 'plans' ? vis.showBenefitPlans : vis.showProviderSearch).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: activeTab === tab ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : 'transparent',
                  color: activeTab === tab ? '#fff' : '#6B7280',
                  boxShadow: activeTab === tab ? '0 2px 8px rgba(245,107,34,0.28)' : 'none',
                }}>
                {tab === 'plans' ? 'Benefit Plans' : 'Provider Search'}
              </button>
            ))}
          </div>
        </div>

        {/* Scheme selector — shared by both tabs */}
        {schemesLoading && (
          <div style={{ display: 'flex', gap: 10 }}>
            {[1,2,3].map((i) => (
              <div key={i} style={{ height: 42, width: 120, borderRadius: 12, background: '#F0F1F5', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}
        {schemesError && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13 }}>{schemesError}</div>
        )}
        {!schemesLoading && !schemesError && schemes.length === 0 && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 13 }}>
            No schemes found for this company.
          </div>
        )}
        {!schemesLoading && schemes.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {schemes.map((scheme, idx) => {
              const isActive = activeSchemeId === scheme.schemeId;
              const c = SCHEME_COLORS[idx % SCHEME_COLORS.length];
              return (
                <button key={scheme.schemeId} onClick={() => setActiveSchemeId(scheme.schemeId)}
                  style={{
                    padding: '10px 24px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    border: `1.5px solid ${isActive ? c.accent : '#E5E7F1'}`,
                    background: isActive ? c.bg : '#fff',
                    color: isActive ? c.accent : '#6B7280',
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  {scheme.schemeName}
                </button>
              );
            })}
          </div>
        )}

        {/* ── PLANS TAB ── */}
        {activeTab === 'plans' && (
          <>
            {bensLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
                {[1,2,3,4].map((i) => (
                  <div key={i} style={{ height: 200, borderRadius: 20, background: '#F7F8FC', border: '1px solid #EDEEF2', animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            )}
            {bensError && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13 }}>{bensError}</div>
            )}
            {!bensLoading && !bensError && categories.length === 0 && activeSchemeId && (
              <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #EDEEF2', padding: '48px 40px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <FileText style={{ width: 26, height: 26, color: '#D97706' }} strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E', marginBottom: 8 }}>Benefit details not yet available</p>
                <p style={{ fontSize: 13, color: '#9CA3B8', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
                  The Prognosis API hasn&apos;t returned benefit data for this scheme yet. This is usually because the plan&apos;s benefit schedule hasn&apos;t been configured on the insurer&apos;s system.
                </p>
                <p style={{ fontSize: 12, color: '#B0B7C9', marginTop: 16 }}>
                  Contact Leadway Health to request that benefits be set up for <strong style={{ color: '#131C4E' }}>{schemes.find((s) => s.schemeId === activeSchemeId)?.schemeName ?? activeSchemeId}</strong>.
                </p>
              </div>
            )}
            {!bensLoading && categories.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {categories.map((b) => {
                  const meta = categoryMeta[b.category] ?? { Icon: FileText, color: '#6B7280', bg: '#F1F5F9' };
                  const Icon = meta.Icon;
                  const totalItems = b.covered.length + b.excluded.length;
                  return (
                    <div key={b.category} style={{ background: '#fff', borderRadius: 20, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 28px', borderBottom: '1px solid #F0F1F5' }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon style={{ width: 24, height: 24, color: meta.color }} strokeWidth={1.75} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.01em' }}>{b.category}</p>
                          <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>
                            {totalItems > 0 ? <>{totalItems} benefit{totalItems !== 1 ? 's' : ''} covered</> : <>Covered</>}
                            {b.limit ? <> · Limit: <span style={{ fontWeight: 600, color: '#131C4E' }}>{b.limit}</span></> : null}
                          </p>
                        </div>
                        {b.waitingPeriod && (
                          <span style={{ fontSize: 11, fontWeight: 600, background: '#FFFBEB', color: '#D97706', padding: '4px 12px', borderRadius: 99, border: '1px solid #FDE68A', flexShrink: 0 }}>
                            {b.waitingPeriod} waiting period
                          </span>
                        )}
                      </div>
                      {b.covered.length > 0 && (
                        <div style={{ padding: '0 28px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px', borderLeft: '3px solid #F56B22', paddingLeft: 12, marginLeft: -12 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#131C4E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>What&apos;s Covered</span>
                            <span style={{ fontSize: 10, fontWeight: 700, background: '#ECFDF5', color: '#059669', padding: '3px 10px', borderRadius: 99 }}>{b.covered.length} COVERED</span>
                          </div>
                          {b.covered.map((inc, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #F7F8FA' }}>
                              <CheckCircle style={{ width: 16, height: 16, color: '#10B981', flexShrink: 0 }} strokeWidth={2.5} />
                              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{inc}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {b.excluded.length > 0 && (
                        <div style={{ padding: '0 28px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px', borderTop: b.covered.length > 0 ? '1px solid #F0F1F5' : 'none', borderLeft: '3px solid #EF4444', paddingLeft: 12, marginLeft: -12 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#131C4E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Not Covered</span>
                            <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF2F2', color: '#DC2626', padding: '3px 10px', borderRadius: 99 }}>{b.excluded.length} EXCLUDED</span>
                          </div>
                          {b.excluded.map((exc, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #F7F8FA' }}>
                              <XCircle style={{ width: 16, height: 16, color: '#EF4444', flexShrink: 0 }} strokeWidth={2.5} />
                              <span style={{ fontSize: 13, color: '#9CA3B8', fontWeight: 500 }}>{exc}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ height: 8 }} />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── PROVIDERS TAB ── */}
        {activeTab === 'providers' && (
          <>
            {/* Summary chips */}
            {provCounts && !provLoading && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Hospitals',     count: provCounts.hospitals,    bg: '#EFF6FF', color: '#2563EB' },
                  { label: 'Eye Clinics',   count: provCounts.eyeClinics,   bg: '#F5F3FF', color: '#7C3AED' },
                  { label: 'Dental Clinics',count: provCounts.dentalClinics, bg: '#FFFBEB', color: '#D97706' },
                  ...(provCounts.spaGyms > 0 ? [{ label: 'Spa & Gym', count: provCounts.spaGyms, bg: '#ECFDF5', color: '#059669' }] : []),
                ].map((c) => (
                  <div key={c.label} style={{ padding: '8px 18px', borderRadius: 12, background: c.bg, border: `1px solid ${c.color}22` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.count.toLocaleString()}</span>
                    <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 6 }}>{c.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Search + filters */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 480 }}>
                <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#C4C9D9' }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, city or state…"
                  style={{ width: '100%', height: 42, paddingLeft: 42, paddingRight: 16, fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
              </div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                style={{ height: 42, padding: '0 32px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                <option value="">All Types</option>
                <option value="Hospital">Hospital</option>
                <option value="Optical">Optical / Eye</option>
                <option value="Dental">Dental</option>
                <option value="Spa/Gym">Spa &amp; Gym</option>
              </select>
              <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
                style={{ height: 42, padding: '0 32px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                <option value="">All States</option>
                {allStates.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button onClick={() => loadProviders(activeSchemeId, true)} disabled={provRefreshing || !activeSchemeId}
                title="Refresh provider list (pulls latest data from Prognosis)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px', fontSize: 13, fontWeight: 500, color: provRefreshing ? '#9CA3B8' : '#059669', border: `1px solid ${provRefreshing ? '#E5E7F1' : '#BBF7D0'}`, borderRadius: 14, background: provRefreshing ? '#F9FAFB' : '#F0FDF4', cursor: provRefreshing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: provRefreshing ? 'spin 1s linear infinite' : 'none' }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                {provRefreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {/* Provider list */}
            {provLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3,4,5].map((i) => (
                  <div key={i} style={{ height: 80, borderRadius: 14, background: '#F7F8FC', border: '1px solid #EDEEF2', animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            )}
            {provError && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13 }}>{provError}</div>
            )}
            {!provLoading && !provError && providers.length === 0 && activeSchemeId && (
              <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #EDEEF2', padding: '48px 40px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <MapPin style={{ width: 26, height: 26, color: '#D97706' }} strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E', marginBottom: 8 }}>No providers found</p>
                <p style={{ fontSize: 13, color: '#9CA3B8' }}>No provider network data is available for this scheme yet.</p>
              </div>
            )}
            {!provLoading && filteredProviders.length === 0 && providers.length > 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3B8', fontSize: 14 }}>No providers match your filters.</div>
            )}
            {!provLoading && filteredProviders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredProviders.map((p, idx) => {
                  const tc = TYPE_COLORS[p.type] ?? { bg: '#F1F5F9', color: '#475569' };
                  return (
                    <div key={`${p.id}-${idx}`} style={{ background: '#fff', borderRadius: 14, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MapPin style={{ width: 20, height: 20, color: '#F56B22' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>{p.name}</p>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0, background: p.status === 'Active' ? '#ECFDF5' : '#FEF2F2', color: p.status === 'Active' ? '#059669' : '#DC2626' }}>{p.status}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 99, flexShrink: 0, background: tc.bg, color: tc.color }}>{p.type}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                          {(p.city || p.state) && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#9CA3B8' }}>
                              <MapPin style={{ width: 12, height: 12, flexShrink: 0 }} />
                              {[p.address, p.city, p.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                          {p.phone && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#F56B22', fontWeight: 500 }}>
                              <Phone style={{ width: 12, height: 12, flexShrink: 0 }} />{p.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      {p.specialties.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0, maxWidth: 240, justifyContent: 'flex-end' }}>
                          {p.specialties.map((sp) => (
                            <span key={sp} style={{ fontSize: 10, fontWeight: 600, background: '#EEF2FF', color: '#3730A3', padding: '3px 8px', borderRadius: 6 }}>{sp}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
