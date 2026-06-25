'use client';

import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, ShieldCheck, CreditCard, FileText,
  Lightbulb, MessageSquare, Eye, EyeOff, CheckCircle,
  BarChart2, DollarSign, Download, SlidersHorizontal, List,
  Activity, Building2, Heart, Receipt, TrendingUp, Clock,
  BarChart, Stethoscope, AlertTriangle, UserPlus, Lock, Unlock,
} from 'lucide-react';
import {
  DEFAULTS, getVis, saveVis, ModuleKey,
  DashboardVis, ClaimsVis, FinanceVis, BenefitsVis,
  PeopleVis, ReportsVis, ServiceDeskVis,
} from '@/lib/module-visibility';

// ── Section definitions per module ──────────────────────────────────────────

type Section<T> = { key: keyof T; label: string; desc: string; Icon: React.ElementType; color: string; bg: string };

const DASHBOARD_SECTIONS: Section<DashboardVis>[] = [
  { key: 'showKpiCards',       label: 'KPI Cards',           desc: 'Active Lives, Utilization Rate, Loss Ratio, Outstanding Premium', Icon: BarChart2,    color: '#2563EB', bg: '#EFF6FF' },
  { key: 'showAmounts',        label: 'Financial Amounts (₦)', desc: 'Monetary values across all dashboard widgets',                  Icon: DollarSign,   color: '#059669', bg: '#ECFDF5' },
  { key: 'showActionCentre',   label: 'Action Centre',        desc: 'Pending items requiring HR attention today',                     Icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' },
  { key: 'showLossRatio',      label: 'Loss Ratio Widget',    desc: 'Large loss ratio % block with traffic-light indicator',          Icon: Activity,     color: '#EF4444', bg: '#FEF2F2' },
  { key: 'showSpendChart',     label: 'Monthly Spend Chart',  desc: 'Area chart of monthly claims spend trend',                       Icon: TrendingUp,   color: '#8B5CF6', bg: '#F5F3FF' },
  { key: 'showTopProviders',   label: 'Top Providers',        desc: 'Provider utilization and spend leaderboard',                     Icon: Building2,    color: '#0891B2', bg: '#ECFEFF' },
  { key: 'showTopConditions',  label: 'Top Conditions',       desc: 'Leading diagnoses by visit count',                               Icon: Stethoscope,  color: '#BE123C', bg: '#FFF1F2' },
  { key: 'showHealthInsights', label: 'Health Insights',      desc: 'AI-generated insight cards from claims data',                    Icon: Lightbulb,    color: '#D97706', bg: '#FFFBEB' },
];

const CLAIMS_SECTIONS: Section<ClaimsVis>[] = [
  { key: 'showSummaryCards', label: 'Summary Statistics',     desc: '4 stat cards — Total Paid, Processing, Queried, Rejected',    Icon: BarChart2,         color: '#2563EB', bg: '#EFF6FF' },
  { key: 'showAmounts',      label: 'Financial Amounts (₦)', desc: 'Monetary values in stat cards and Amount column of table',     Icon: DollarSign,        color: '#059669', bg: '#ECFDF5' },
  { key: 'showExports',      label: 'Export Buttons',         desc: 'Allow HR to download the claims register (XLS / PDF)',        Icon: Download,          color: '#D97706', bg: '#FFFBEB' },
  { key: 'showFilters',      label: 'Filter & Search Toolbar', desc: 'Category, Status, Plan filters and search box',              Icon: SlidersHorizontal, color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'showTable',        label: 'Claims Register Table',  desc: 'The full list of individual claim records',                   Icon: List,              color: '#131C4E', bg: '#F1F5F9' },
];

const FINANCE_SECTIONS: Section<FinanceVis>[] = [
  { key: 'showSummaryCards',    label: 'Summary Cards',          desc: 'Current Month Premium, Avg Cost Per Life, Outstanding Balance', Icon: BarChart2,  color: '#2563EB', bg: '#EFF6FF' },
  { key: 'showAmounts',         label: 'Financial Amounts (₦)', desc: 'All monetary values across the Finance module',                  Icon: DollarSign, color: '#059669', bg: '#ECFDF5' },
  { key: 'showPaymentTimeline', label: 'Payment Timeline',       desc: 'Invoice payment progress steps widget',                         Icon: Clock,      color: '#D97706', bg: '#FFFBEB' },
  { key: 'showInvoiceTable',    label: 'Invoice Table',          desc: 'Full invoice register in the Invoices tab',                     Icon: List,       color: '#131C4E', bg: '#F1F5F9' },
  { key: 'showDownloads',       label: 'Invoice Downloads',      desc: 'Per-row XLS and PDF download buttons',                          Icon: Download,   color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'showReceiptsTab',     label: 'Receipts Tab',           desc: 'The Receipts section tab',                                      Icon: Receipt,    color: '#0891B2', bg: '#ECFEFF' },
  { key: 'showStatementTab',    label: 'Statement Tab',          desc: 'The Statement of Account section tab',                          Icon: FileText,   color: '#BE123C', bg: '#FFF1F2' },
];

const BENEFITS_SECTIONS: Section<BenefitsVis>[] = [
  { key: 'showBenefitPlans',   label: 'Benefit Plans',    desc: 'Plan details, coverage limits, inclusions and exclusions per plan', Icon: ShieldCheck, color: '#059669', bg: '#ECFDF5' },
  { key: 'showProviderSearch', label: 'Provider Search',  desc: 'Provider network search with plan tier and state filters',          Icon: Building2,  color: '#2563EB', bg: '#EFF6FF' },
];

const PEOPLE_SECTIONS: Section<PeopleVis>[] = [
  { key: 'showSummaryCards',    label: 'Summary Cards',        desc: 'Active Members, New This Month, Pending Additions',               Icon: BarChart2, color: '#2563EB', bg: '#EFF6FF' },
  { key: 'showAddMember',       label: 'Add Member Button',    desc: 'Button to enrol new members (individual, bulk, self-enrolment)', Icon: UserPlus,  color: '#059669', bg: '#ECFDF5' },
  { key: 'showBeneficiaryView', label: 'Beneficiaries View',   desc: 'Toggle to see all beneficiaries including dependants',            Icon: Users,     color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'showEnroleeIds',      label: 'Enrolee IDs',          desc: 'Enrolee ID column in the members table',                          Icon: List,      color: '#D97706', bg: '#FFFBEB' },
  { key: 'showTerminateAction', label: 'Terminate Member',     desc: 'Terminate button in the Member 360 drawer',                       Icon: Lock,      color: '#EF4444', bg: '#FEF2F2' },
];

const REPORTS_SECTIONS: Section<ReportsVis>[] = [
  { key: 'showMembershipReport',    label: 'Membership Report',    desc: 'Active lives, additions, removals',               Icon: Users,     color: '#2563EB', bg: '#EFF6FF' },
  { key: 'showUtilizationReport',   label: 'Utilization Report',   desc: 'Claims count, amount, visits',                    Icon: Activity,  color: '#059669', bg: '#ECFDF5' },
  { key: 'showClaimsAnalysis',      label: 'Claims Analysis',      desc: 'Top diagnoses, providers, categories',            Icon: BarChart,  color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'showProviderUtilization', label: 'Provider Utilization', desc: 'Visits by provider, spend by provider',           Icon: Building2, color: '#0891B2', bg: '#ECFEFF' },
  { key: 'showFinancialReport',     label: 'Financial Report',     desc: 'Invoices, payments, outstanding balances',        Icon: CreditCard,color: '#D97706', bg: '#FFFBEB' },
  { key: 'showExports',             label: 'Export Buttons',       desc: 'XLS and PDF download buttons on each report row', Icon: Download,  color: '#131C4E', bg: '#F1F5F9' },
];

const SERVICEDESK_SECTIONS: Section<ServiceDeskVis>[] = [
  { key: 'showSummaryCards', label: 'Summary Cards',     desc: 'Open, In Progress, Awaiting, Closed ticket counts', Icon: BarChart2,       color: '#2563EB', bg: '#EFF6FF' },
  { key: 'showTicketTable',  label: 'Ticket Table',      desc: 'Full list of service requests',                    Icon: List,            color: '#131C4E', bg: '#F1F5F9' },
  { key: 'showNewRequest',   label: 'New Request Button', desc: 'Allow HR to submit new support requests',         Icon: MessageSquare,   color: '#059669', bg: '#ECFDF5' },
  { key: 'showSlaColumn',    label: 'SLA Column',        desc: 'SLA status column (Within SLA, Near SLA, Breached)', Icon: Clock,         color: '#D97706', bg: '#FFFBEB' },
];

// ── Module registry ──────────────────────────────────────────────────────────

const MODULES = [
  { key: 'dashboard'   as ModuleKey, label: 'Dashboard',        Icon: LayoutDashboard, sections: DASHBOARD_SECTIONS    },
  { key: 'people'      as ModuleKey, label: 'People',           Icon: Users,           sections: PEOPLE_SECTIONS       },
  { key: 'benefits'    as ModuleKey, label: 'Benefits',         Icon: ShieldCheck,     sections: BENEFITS_SECTIONS     },
  { key: 'finance'     as ModuleKey, label: 'Finance',          Icon: CreditCard,      sections: FINANCE_SECTIONS      },
  { key: 'claims'      as ModuleKey, label: 'Claims',           Icon: FileText,        sections: CLAIMS_SECTIONS       },
  { key: 'reports'     as ModuleKey, label: 'Insights & Reports', Icon: Lightbulb,    sections: REPORTS_SECTIONS      },
  { key: 'serviceDesk' as ModuleKey, label: 'Service Desk',     Icon: MessageSquare,   sections: SERVICEDESK_SECTIONS  },
] as const;

// ── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', padding: 3,
        background: on ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : '#E5E7F1',
        transition: 'background 0.2s', display: 'flex', alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start', flexShrink: 0,
        boxShadow: on ? '0 2px 8px rgba(245,107,34,0.35)' : 'none' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)', display: 'block', transition: 'all 0.2s' }} />
    </button>
  );
}

// ── Companies list ───────────────────────────────────────────────────────────

const COMPANIES = [
  { id: 'corp-001', name: 'Dangote Industries Ltd',              status: 'Active'  },
  { id: 'corp-002', name: 'SME - Herconomy',                     status: 'Pending' },
  { id: 'corp-003', name: 'Edves Nigeria Limited',               status: 'Pending' },
  { id: 'corp-004', name: 'Jackson, Etti And Edu (JEE Africa)',  status: 'Pending' },
  { id: 'corp-005', name: 'Flour Mills of Nigeria Plc',          status: 'Active'  },
  { id: 'corp-006', name: 'Baker Hughes Nigeria Ltd',            status: 'Active'  },
  { id: 'corp-007', name: 'NLNG – Nigeria LNG Limited',          status: 'Active'  },
  { id: 'corp-008', name: 'Zenith Bank Plc',                     status: 'Active'  },
  { id: 'corp-009', name: 'Primus Pharmacare Ltd',               status: 'Pending' },
  { id: 'corp-010', name: 'Okomu Oil Palm Company Plc',          status: 'Active'  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PortalSettingsPage() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [allVis, setAllVis] = useState<Record<ModuleKey, Record<string, boolean>>>({} as never);
  const [saved, setSaved] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(COMPANIES[0].id);

  useEffect(() => {
    const loaded = {} as Record<ModuleKey, Record<string, boolean>>;
    MODULES.forEach((m) => { loaded[m.key] = getVis(m.key, selectedCompanyId) as Record<string, boolean>; });
    setAllVis(loaded);
  }, [selectedCompanyId]);

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  function toggle(moduleKey: ModuleKey, sectionKey: string) {
    setAllVis((prev) => {
      const next = { ...prev, [moduleKey]: { ...prev[moduleKey], [sectionKey]: !prev[moduleKey][sectionKey] } };
      saveVis(moduleKey, next[moduleKey] as never, selectedCompanyId);
      return next;
    });
    flash();
  }

  function setAll(moduleKey: ModuleKey, value: boolean) {
    setAllVis((prev) => {
      const next = { ...prev };
      const updated = {} as Record<string, boolean>;
      Object.keys(prev[moduleKey] ?? {}).forEach((k) => { updated[k] = value; });
      next[moduleKey] = updated;
      saveVis(moduleKey, updated as never, selectedCompanyId);
      return next;
    });
    flash();
  }

  function setAllModules(value: boolean) {
    setAllVis((prev) => {
      const next = { ...prev };
      MODULES.forEach((m) => {
        const updated = {} as Record<string, boolean>;
        Object.keys(prev[m.key] ?? {}).forEach((k) => { updated[k] = value; });
        next[m.key] = updated;
        saveVis(m.key, updated as never, selectedCompanyId);
      });
      return next;
    });
    flash();
  }

  const mod = MODULES.find((m) => m.key === activeModule)!;
  const currentVis = allVis[activeModule] ?? {};
  const sections = mod.sections as Section<Record<string, boolean>>[];

  const allOnForModule  = sections.every((s) => currentVis[s.key as string]);
  const allOffForModule = sections.every((s) => !currentVis[s.key as string]);

  const globalOn  = MODULES.every((m) => (mod.sections as Section<Record<string, boolean>>[]).every((s) => (allVis[m.key] ?? {})[s.key as string]));

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #F0F1F5', height: 68, display: 'flex', alignItems: 'center', padding: '0 36px', gap: 16, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Portal Settings</h1>
          <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2, fontWeight: 500 }}>HR visibility controls · Per company</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saved && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}>
              <CheckCircle style={{ width: 14, height: 14 }} /> Saved
            </span>
          )}
          <button onClick={() => setAllModules(true)}
            style={{ height: 36, padding: '0 16px', fontSize: 12, fontWeight: 700, color: '#059669', border: '1.5px solid #A7F3D0', borderRadius: 10, background: '#ECFDF5', cursor: 'pointer' }}>
            <Unlock style={{ width: 12, height: 12, display: 'inline', marginRight: 5 }} />Show All Modules
          </button>
          <button onClick={() => setAllModules(false)}
            style={{ height: 36, padding: '0 16px', fontSize: 12, fontWeight: 700, color: '#DC2626', border: '1.5px solid #FECACA', borderRadius: 10, background: '#FEF2F2', cursor: 'pointer' }}>
            <Lock style={{ width: 12, height: 12, display: 'inline', marginRight: 5 }} />Hide All Modules
          </button>
        </div>
      </header>

      {/* Company selector bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F0F1F5', padding: '0 36px', display: 'flex', alignItems: 'center', gap: 16, height: 54 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#9CA3B8', flexShrink: 0 }}>Configuring for</p>
        <select
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          style={{ height: 36, padding: '0 36px 0 14px', fontSize: 13, fontWeight: 600, color: '#131C4E', border: '1.5px solid #E5E7F1', borderRadius: 12, background: '#fff', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; }}
        >
          {COMPANIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(() => {
          const co = COMPANIES.find((c) => c.id === selectedCompanyId);
          return co ? (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: co.status === 'Active' ? '#ECFDF5' : '#FFFBEB', color: co.status === 'Active' ? '#059669' : '#D97706', border: `1px solid ${co.status === 'Active' ? '#A7F3D0' : '#FDE68A'}` }}>
              {co.status}
            </span>
          ) : null;
        })()}
        <div style={{ flex: 1 }} />
        <p style={{ fontSize: 11, color: '#C4C9D9' }}>Changes apply only to this company&apos;s HR portal</p>
      </div>

      <div style={{ padding: '32px 36px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Left: module nav */}
        <div style={{ width: 210, flexShrink: 0, background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F1F5' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Modules</p>
          </div>
          {MODULES.map((m) => {
            const Icon = m.Icon;
            const mv = allVis[m.key] ?? {};
            const secs = m.sections as Section<Record<string, boolean>>[];
            const onCount  = secs.filter((s) => mv[s.key as string]).length;
            const allOn    = onCount === secs.length;
            const someOn   = onCount > 0 && !allOn;
            const isActive = activeModule === m.key;
            return (
              <button key={m.key} onClick={() => setActiveModule(m.key)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 'none', borderLeft: `3px solid ${isActive ? '#F56B22' : 'transparent'}`, background: isActive ? '#FFF5EF' : 'transparent', cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left', borderBottom: '1px solid #F7F8FA' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: isActive ? '#FFF3E8' : '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 15, height: 15, color: isActive ? '#F56B22' : '#9CA3B8' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#F56B22' : '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</p>
                  <p style={{ fontSize: 10, color: allOn ? '#059669' : someOn ? '#D97706' : '#EF4444', fontWeight: 600, marginTop: 1 }}>
                    {onCount}/{secs.length} visible
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: toggles for selected module */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Module header */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <mod.Icon style={{ width: 22, height: 22, color: '#F56B22' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E' }}>{mod.label}</p>
              <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>
                <strong>{COMPANIES.find((c) => c.id === selectedCompanyId)?.name ?? '—'}</strong> · {mod.label} page visibility
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAll(activeModule, true)}
                disabled={allOnForModule}
                style={{ height: 34, padding: '0 14px', fontSize: 12, fontWeight: 700, color: '#059669', border: '1.5px solid #A7F3D0', borderRadius: 10, background: '#ECFDF5', cursor: allOnForModule ? 'not-allowed' : 'pointer', opacity: allOnForModule ? 0.4 : 1 }}>
                Show All
              </button>
              <button onClick={() => setAll(activeModule, false)}
                disabled={allOffForModule}
                style={{ height: 34, padding: '0 14px', fontSize: 12, fontWeight: 700, color: '#DC2626', border: '1.5px solid #FECACA', borderRadius: 10, background: '#FEF2F2', cursor: allOffForModule ? 'not-allowed' : 'pointer', opacity: allOffForModule ? 0.4 : 1 }}>
                Hide All
              </button>
            </div>
          </div>

          {/* Section toggles */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', overflow: 'hidden' }}>
            {sections.map((s, i) => {
              const on = currentVis[s.key as string] ?? true;
              const Icon = s.Icon;
              return (
                <div key={s.key as string} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '18px 28px', borderBottom: i < sections.length - 1 ? '1px solid #F7F8FA' : 'none', background: on ? '#fff' : '#FAFBFC', transition: 'background 0.1s' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: on ? s.bg : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}>
                    <Icon style={{ width: 20, height: 20, color: on ? s.color : '#9CA3B8', transition: 'color 0.2s' }} strokeWidth={1.75} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: on ? '#131C4E' : '#9CA3B8', transition: 'color 0.2s' }}>{s.label}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: on ? '#ECFDF5' : '#F3F4F6', color: on ? '#059669' : '#9CA3B8', border: `1px solid ${on ? '#A7F3D0' : '#E5E7EB'}` }}>
                        {on ? 'VISIBLE' : 'HIDDEN'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#9CA3B8', lineHeight: 1.5 }}>{s.desc}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {on ? <Eye style={{ width: 14, height: 14, color: '#10B981' }} /> : <EyeOff style={{ width: 14, height: 14, color: '#D1D5DB' }} />}
                    <Toggle on={on} onChange={() => toggle(activeModule, s.key as string)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
