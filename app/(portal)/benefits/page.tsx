'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BenefitsVis, DEFAULTS, getVis } from '@/lib/module-visibility';
import { Search, MapPin, Phone, CheckCircle, XCircle, Activity, Building2, Heart, Smile, Eye, FlaskConical, AlertTriangle, FileText, Syringe, Sparkles } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import type { PolicyScheme } from '@/app/api/hr/benefits/schemes/route';
import type { BenefitCategory } from '@/app/api/hr/benefits/scheme-benefits/route';

/* ── Plan tier hierarchy (lowest → highest) — still used for provider search ── */
const PLAN_TIERS = [
  { key: 'Plus Mini',   level: 0, label: 'All Plans',          color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  { key: 'Plus',        level: 1, label: 'Plus and above',     color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  { key: 'Pro',         level: 2, label: 'Pro and above',      color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
  { key: 'Max',         level: 3, label: 'Max and above',      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { key: 'Promax',      level: 4, label: 'Promax and above',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'Magnum',      level: 5, label: 'Magnum and above',   color: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE' },
  { key: 'Magnum Plus', level: 6, label: 'Magnum Plus only',   color: '#0F172A', bg: '#E2E8F0', border: '#94A3B8' },
] as const;

type PlanTierKey = typeof PLAN_TIERS[number]['key'];

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
  Outpatient:                { Icon: Activity,      color: '#10B981', bg: '#ECFDF5' },
  Inpatient:                 { Icon: Building2,     color: '#3B82F6', bg: '#EFF6FF' },
  Maternity:                 { Icon: Heart,         color: '#EC4899', bg: '#FDF2F8' },
  Dental:                    { Icon: Smile,         color: '#F59E0B', bg: '#FFFBEB' },
  Dentistry:                 { Icon: Smile,         color: '#F59E0B', bg: '#FFFBEB' },
  Optical:                   { Icon: Eye,           color: '#8B5CF6', bg: '#F5F3FF' },
  'Lens and Frames':         { Icon: Eye,           color: '#8B5CF6', bg: '#F5F3FF' },
  Specialist:                { Icon: FlaskConical,  color: '#0891B2', bg: '#ECFEFF' },
  'Advanced Investigations': { Icon: FlaskConical,  color: '#0891B2', bg: '#ECFEFF' },
  Emergency:                 { Icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2' },
  'Major Disease Benefit':   { Icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2' },
  'Additional Benefits':       { Icon: Activity,      color: '#6D28D9', bg: '#F5F3FF' },
  Gym:                         { Icon: Activity,      color: '#059669', bg: '#ECFDF5' },
  'Health Checks':             { Icon: Activity,      color: '#D97706', bg: '#FFFBEB' },
  'Health Check Basic':        { Icon: Activity,      color: '#D97706', bg: '#FFFBEB' },
  'Immunization Vaccines':     { Icon: Syringe,       color: '#0891B2', bg: '#ECFEFF' },
  'SPA Treatment (Voucher PA )': { Icon: Sparkles,   color: '#7C3AED', bg: '#F5F3FF' },
};

const providers: { name: string; city: string; state: string; phone: string; specialties: string[]; type: string; status: string; minPlan: PlanTierKey }[] = [
  { name: 'Lagos Island General Hospital', city: 'Lagos Island', state: 'Lagos',  phone: '01-291-6000', specialties: ['General Practice', 'Specialist'], type: 'Hospital',   status: 'Active',    minPlan: 'Plus Mini'   },
  { name: 'Reddington Hospital',           city: 'Victoria Island', state: 'Lagos', phone: '01-470-4940', specialties: ['Cardiology', 'Surgery'],           type: 'Hospital',   status: 'Active',    minPlan: 'Promax'      },
  { name: 'St. Nicholas Hospital',         city: 'Lagos Island', state: 'Lagos',  phone: '01-291-5700', specialties: ['Paediatrics', 'Obs/Gynae'],         type: 'Hospital',   status: 'Active',    minPlan: 'Pro'         },
  { name: 'National Hospital Abuja',       city: 'CBD',          state: 'FCT',    phone: '09-523-4600', specialties: ['Multi-specialty'],                  type: 'Hospital',   status: 'Active',    minPlan: 'Plus'        },
  { name: 'Apex Dental Clinic',            city: 'Ikeja',        state: 'Lagos',  phone: '01-804-0012', specialties: ['Dentistry'],                        type: 'Dental',     status: 'Active',    minPlan: 'Plus Mini'   },
  { name: 'Clear Vision Eye Centre',       city: 'Lekki Phase 1', state: 'Lagos', phone: '01-734-5500', specialties: ['Ophthalmology'],                    type: 'Optical',    status: 'Suspended', minPlan: 'Max'         },
  { name: 'MedPlus Diagnostic Centre',     city: 'Surulere',     state: 'Lagos',  phone: '01-555-2200', specialties: ['Diagnostics', 'Imaging'],           type: 'Diagnostic', status: 'Active',    minPlan: 'Plus'        },
  { name: 'Ultima Pharmacy',               city: 'Victoria Island', state: 'Lagos', phone: '01-461-3300', specialties: ['Pharmacy'],                       type: 'Pharmacy',   status: 'Active',    minPlan: 'Plus Mini'   },
  { name: 'Memfys Hospital',               city: 'Independence Layout', state: 'Enugu', phone: '042-252-200', specialties: ['Neurosurgery', 'Oncology'],   type: 'Hospital',   status: 'Active',    minPlan: 'Magnum'      },
  { name: 'Cedarcrest Hospitals',          city: 'Wuse 2',       state: 'FCT',    phone: '09-123-4560', specialties: ['Surgery', 'Obs/Gynae'],             type: 'Hospital',   status: 'Active',    minPlan: 'Pro'         },
  { name: 'Total Health Trust Pharmacy',   city: 'GRA',          state: 'Enugu',  phone: '042-770-100', specialties: ['Pharmacy'],                        type: 'Pharmacy',   status: 'Active',    minPlan: 'Plus Mini'   },
  { name: 'Prime Eye Specialist Clinic',   city: 'GRA',          state: 'Oyo',    phone: '022-345-678', specialties: ['Ophthalmology', 'Optometry'],       type: 'Optical',    status: 'Active',    minPlan: 'Plus'        },
];

export default function BenefitsPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'providers'>('plans');
  const [vis, setBenVis] = useState<BenefitsVis>(DEFAULTS.benefits);
  useEffect(() => { setBenVis(getVis('benefits')); }, []);

  // Dynamic schemes + benefits
  const [schemes, setSchemes]               = useState<PolicyScheme[]>([]);
  const [schemesLoading, setSchemesLoading] = useState(true);
  const [schemesError, setSchemesError]     = useState('');
  const [activeSchemeId, setActiveSchemeId] = useState<string>('');
  const [categories, setCategories]         = useState<BenefitCategory[]>([]);
  const [bensLoading, setBensLoading]       = useState(false);
  const [bensError, setBensError]           = useState('');

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

  useEffect(() => {
    if (activeSchemeId) loadBenefits(activeSchemeId);
  }, [activeSchemeId, loadBenefits]);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanTierKey | ''>('');
  const [stateFilter, setStateFilter] = useState('');

  const allStates = Array.from(new Set(providers.map((p) => p.state))).sort();

  const filteredProviders = providers.filter((p) => {
    const q = search.toLowerCase();
    const matchText = !q || p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.state.toLowerCase().includes(q);
    const matchType  = !typeFilter  || p.type  === typeFilter;
    const matchState = !stateFilter || p.state === stateFilter;
    let matchPlan = true;
    if (planFilter) {
      const selectedLevel  = PLAN_TIERS.find((t) => t.key === planFilter)?.level ?? 0;
      const providerLevel  = PLAN_TIERS.find((t) => t.key === p.minPlan)?.level ?? 0;
      matchPlan = providerLevel <= selectedLevel;
    }
    return matchText && matchType && matchState && matchPlan;
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
                  padding: '9px 22px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: activeTab === tab ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : 'transparent',
                  color: activeTab === tab ? '#fff' : '#6B7280',
                  boxShadow: activeTab === tab ? '0 2px 8px rgba(245,107,34,0.28)' : 'none',
                }}>
                {tab === 'plans' ? 'Benefit Plans' : 'Provider Search'}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'plans' && (
          <>
            {/* Scheme selector — loaded from GetPolicySchemes */}
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
                No schemes found for this company. Visit <a href="/api/hr/benefits/debug" target="_blank" style={{ color: '#F56B22', fontWeight: 600 }}>/api/hr/benefits/debug</a> to inspect the raw API response.
              </div>
            )}
            {!schemesLoading && schemes.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {schemes.map((scheme, idx) => {
                  const isActive = activeSchemeId === scheme.schemeId;
                  const c = SCHEME_COLORS[idx % SCHEME_COLORS.length];
                  return (
                    <button key={scheme.schemeId}
                      onClick={() => setActiveSchemeId(scheme.schemeId)}
                      style={{
                        padding: '10px 24px',
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: 700,
                        border: `1.5px solid ${isActive ? c.accent : '#E5E7F1'}`,
                        background: isActive ? c.bg : '#fff',
                        color: isActive ? c.accent : '#6B7280',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                      }}>
                      {scheme.schemeName}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Benefit cards — loaded from GetSchemeBenefits */}
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
                  The Prognosis API hasn&apos;t returned benefit data for this scheme yet. This is usually because the plan&apos;s benefit schedule hasn&apos;t been configured on the insurer&apos;s system, or access hasn&apos;t been granted to the service account.
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
                      {/* Card header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 28px', borderBottom: '1px solid #F0F1F5' }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon style={{ width: 24, height: 24, color: meta.color }} strokeWidth={1.75} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.01em' }}>{b.category}</p>
                          <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>
                            {totalItems} benefit{totalItems !== 1 ? 's' : ''} covered
                            {b.limit ? <> · Limit: <span style={{ fontWeight: 600, color: '#131C4E' }}>{b.limit}</span></> : null}
                          </p>
                        </div>
                        {b.waitingPeriod && (
                          <span style={{ fontSize: 11, fontWeight: 600, background: '#FFFBEB', color: '#D97706', padding: '4px 12px', borderRadius: 99, border: '1px solid #FDE68A', flexShrink: 0 }}>
                            {b.waitingPeriod} waiting period
                          </span>
                        )}
                      </div>

                      {/* Covered */}
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

                      {/* Excluded */}
                      {b.excluded.length > 0 && (
                        <div style={{ padding: '0 28px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px', borderTop: b.covered.length > 0 ? '1px solid #F0F1F5' : 'none', marginTop: b.covered.length > 0 ? 4 : 0, borderLeft: '3px solid #EF4444', paddingLeft: 12, marginLeft: -12 }}>
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
        {activeTab === 'providers' && (
          <>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Row 1: search + type + state */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 520 }}>
                  <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#C4C9D9' }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search provider name, city or state..."
                    style={{ width: '100%', height: 42, paddingLeft: 42, paddingRight: 16, fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                </div>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ height: 42, padding: '0 32px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                  <option value="">All Types</option>
                  <option>Hospital</option><option>Dental</option><option>Optical</option><option>Diagnostic</option><option>Pharmacy</option>
                </select>
                <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
                  style={{ height: 42, padding: '0 32px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                  <option value="">All States</option>
                  {allStates.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              {/* Row 2: plan filter pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3B8', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plan:</span>
                <button onClick={() => setPlanFilter('')}
                  style={{ height: 30, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 99, border: `1.5px solid ${planFilter === '' ? '#131C4E' : '#E5E7F1'}`, background: planFilter === '' ? '#131C4E' : '#fff', color: planFilter === '' ? '#fff' : '#6B7280', cursor: 'pointer' }}>
                  All Providers
                </button>
                {PLAN_TIERS.map((tier) => {
                  const active = planFilter === tier.key;
                  return (
                    <button key={tier.key} onClick={() => setPlanFilter(tier.key)}
                      style={{ height: 30, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 99, border: `1.5px solid ${active ? tier.color : '#E5E7F1'}`, background: active ? tier.bg : '#fff', color: active ? tier.color : '#6B7280', cursor: 'pointer', transition: 'all 0.12s' }}>
                      {tier.key}
                    </button>
                  );
                })}
              </div>
              {planFilter && (
                <p style={{ fontSize: 12, color: '#6B7280', marginTop: -4 }}>
                  Showing providers accessible to <span style={{ fontWeight: 700, color: PLAN_TIERS.find((t) => t.key === planFilter)?.color }}>{planFilter}</span> plan members and above
                </p>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredProviders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3B8', fontSize: 14 }}>No providers match your filters.</div>
              )}
              {filteredProviders.map((p) => {
                const tierMeta = PLAN_TIERS.find((t) => t.key === p.minPlan)!;
                return (
                  <div key={p.name} style={{ background: '#fff', borderRadius: 14, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <MapPin style={{ width: 20, height: 20, color: '#F56B22' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>{p.name}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0, background: p.status === 'Active' ? '#ECFDF5' : '#FEF2F2', color: p.status === 'Active' ? '#059669' : '#DC2626' }}>{p.status}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 99, flexShrink: 0, background: tierMeta.bg, color: tierMeta.color, border: `1px solid ${tierMeta.border}` }}>{tierMeta.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#9CA3B8' }}>
                          <MapPin style={{ width: 12, height: 12, flexShrink: 0 }} />{p.city}, {p.state}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#F56B22', fontWeight: 500 }}>
                          <Phone style={{ width: 12, height: 12, flexShrink: 0 }} />{p.phone}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0, maxWidth: 280, justifyContent: 'flex-end' }}>
                      {p.specialties.map((s) => (
                        <span key={s} style={{ fontSize: 10, fontWeight: 600, background: '#EEF2FF', color: '#3730A3', padding: '3px 8px', borderRadius: 6 }}>{s}</span>
                      ))}
                      <span style={{ fontSize: 10, fontWeight: 600, background: '#F1F2F8', color: '#6B7280', padding: '3px 8px', borderRadius: 6 }}>{p.type}</span>
                    </div>
                    <button style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', fontSize: 12, fontWeight: 600, color: '#F56B22', border: '1.5px solid #FFD8C0', borderRadius: 10, background: '#FFF5EF', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <MapPin style={{ width: 13, height: 13 }} /> Directions
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
