'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Activity, Search, Building2, CreditCard, FileSpreadsheet, FileText,
  ChevronRight, CalendarDays, SlidersHorizontal, RotateCcw, FolderOpen, Check, X,
} from 'lucide-react';
import { exportToXls } from '@/lib/exportXls';
import { exportToPdf } from '@/lib/exportPdf';
import { TopBar } from '@/components/layout/TopBar';
import { useToast } from '@/components/ui/Toast';
import { friendlyError } from '@/lib/user-facing-error';
import { ReportsVis, DEFAULTS, getVis } from '@/lib/module-visibility';

type Row = Record<string, unknown>;
type SourceKey = 'members' | 'claims';

const ALL_REPORTS = [
  { id: 1, visKey: 'showMembershipReport',    title: 'Membership Report',    desc: 'Active lives · Additions · Removals',        icon: Users,      color: '#F56B22', tint: '#FFF3E8', source: 'members' as SourceKey },
  { id: 2, visKey: 'showUtilizationReport',   title: 'Utilization Report',   desc: 'Claims count · Amount · Visits',             icon: Activity,   color: '#10B981', tint: '#ECFDF5', source: 'claims'  as SourceKey },
  { id: 3, visKey: 'showClaimsAnalysis',      title: 'Claims Analysis',      desc: 'Top diagnoses · Providers · Categories',     icon: Search,     color: '#7C3AED', tint: '#F5F3FF', source: 'claims'  as SourceKey },
  { id: 4, visKey: 'showProviderUtilization', title: 'Provider Utilization', desc: 'Visits by provider · Spend by provider',     icon: Building2,  color: '#D97706', tint: '#FFFBEB', source: 'claims'  as SourceKey },
  { id: 5, visKey: 'showFinancialReport',     title: 'Financial Report',     desc: 'Invoices · Payments · Outstanding balances', icon: CreditCard, color: '#2563EB', tint: '#EFF6FF', source: 'claims'  as SourceKey },
] as const;

// Column sets per source. These double as the custom-report builder's field
// list, so a report's shape and what HR can pick from never drift apart.
const FIELDS: Record<SourceKey, { key: string; label: string; from: (r: Row) => unknown }[]> = {
  members: [
    { key: 'enroleeId', label: 'Enrolee ID',  from: (r) => r.employeeId },
    { key: 'staffId',   label: 'Staff ID',    from: (r) => r.staffId ?? '' },
    { key: 'firstName', label: 'First Name',  from: (r) => r.firstName },
    { key: 'lastName',  label: 'Last Name',   from: (r) => r.lastName },
    { key: 'gender',    label: 'Gender',      from: (r) => r.gender },
    { key: 'dob',       label: 'Date of Birth', from: (r) => r.dateOfBirth },
    { key: 'phone',     label: 'Phone',       from: (r) => r.phone },
    { key: 'email',     label: 'Email',       from: (r) => r.email },
    { key: 'plan',      label: 'Plan',        from: (r) => r.plan },
    { key: 'type',      label: 'Type',        from: (r) => r.type },
    { key: 'status',    label: 'Status',      from: (r) => r.status },
    { key: 'location',  label: 'Location',    from: (r) => r.location },
    { key: 'enrolled',  label: 'Enrolled On', from: (r) => r.enrollmentDate },
  ],
  claims: [
    { key: 'claimRef',   label: 'Claim ID',    from: (r) => r.claimRef },
    { key: 'member',     label: 'Member',      from: (r) => r.memberName },
    { key: 'enroleeId',  label: 'Enrolee ID',  from: (r) => r.employeeId },
    { key: 'diagnosis',  label: 'Diagnosis',   from: (r) => r.icdDescription },
    { key: 'provider',   label: 'Provider',    from: (r) => r.provider },
    { key: 'state',      label: 'State',       from: (r) => r.providerState },
    { key: 'category',   label: 'Category',    from: (r) => r.category },
    { key: 'amtClaimed', label: 'Amt Claimed', from: (r) => r.amtClaimed },
    { key: 'amtPaid',    label: 'Amt Paid',    from: (r) => r.amount },
    { key: 'status',     label: 'Status',      from: (r) => r.status },
    { key: 'date',       label: 'Date',        from: (r) => r.submittedDate },
  ],
};

// Which field carries the date each source is filtered on, and which the plan.
const FILTER_KEYS: Record<SourceKey, { date: string; plan?: string }> = {
  members: { date: 'enrollmentDate', plan: 'plan' },
  claims:  { date: 'submittedDate' },
};

const LAST_RUN_KEY = 'reports:lastRun';

/** Accepts ISO, dd/mm/yyyy and "12 Jun 2026" — all appear across our sources. */
function toTime(value: unknown): number | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])).getTime();
  const t = new Date(s).getTime();
  return isNaN(t) ? null : t;
}

export default function ReportsPage() {
  const today = new Date();
  const jan1 = `${today.getFullYear()}-01-01`;
  const [from, setFrom] = useState(jan1);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [plan, setPlan] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ from: jan1, to: today.toISOString().slice(0, 10), plan: '' });
  const [vis, setVis] = useState<ReportsVis>(DEFAULTS.reports);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [plans, setPlans] = useState<string[]>([]);
  const [lastRun, setLastRun] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Custom report builder
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderSource, setBuilderSource] = useState<SourceKey>('members');
  const [builderName, setBuilderName] = useState('Custom report');
  const [builderCols, setBuilderCols] = useState<string[]>(FIELDS.members.slice(0, 6).map((f) => f.key));
  const [builderBusy, setBuilderBusy] = useState(false);

  useEffect(() => { setVis(getVis('reports')); }, []);

  // Scheme Health Score — relocated here from the dashboard when the KPI row
  // was redesigned. dashboard-stats is served from a short server-side cache,
  // so this costs no extra upstream calls.
  const [health, setHealth] = useState<{ score: number; label: string; trendLabel: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/hr/dashboard-stats')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.stats || typeof d.stats.schemeHealthScore !== 'number') return;
        setHealth({
          score: d.stats.schemeHealthScore,
          label: d.stats.schemeHealthLabel ?? '',
          trendLabel: d.stats.schemeHealthTrendLabel ?? null,
        });
      })
      .catch(() => { /* the card simply doesn't render */ });
    return () => { cancelled = true; };
  }, []);

  // "Updated" reflects when this browser last generated each report. Previously
  // these were hardcoded dates, which claimed a freshness nobody had produced.
  // Reading persisted state / loading a filter list on mount: a single
  // fetch-on-mount doesn't cause the cascading renders this rule guards against.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_RUN_KEY);
      if (raw) setLastRun(JSON.parse(raw));
    } catch { /* absent or unreadable is fine */ }
  }, []);

  // Plan list for the filter, taken from the members actually on the scheme.
  // Reading persisted state / loading a filter list on mount: a single
  // fetch-on-mount doesn't cause the cascading renders this rule guards against.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetch('/api/hr/members?skipClaims=1')
      .then((r) => r.json())
      .then((d) => {
        const names = [...new Set(((d.members ?? []) as Row[]).map((m) => String(m.plan ?? '')).filter(Boolean))].sort();
        setPlans(names);
      })
      .catch(() => { /* the filter just shows All Plans */ });
  }, []);

  const visibleReports = useMemo(() => ALL_REPORTS.filter((r) => vis[r.visKey]), [vis]);

  const markRun = useCallback((id: number | string) => {
    const stamp = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    setLastRun((prev) => {
      const next = { ...prev, [String(id)]: stamp };
      try { localStorage.setItem(LAST_RUN_KEY, JSON.stringify(next)); } catch { /* non-fatal */ }
      return next;
    });
  }, []);

  /** Fetches a source and applies the *applied* filters — the ones behind the
   *  Apply Filters button, not whatever is mid-edit in the inputs. */
  const loadRows = useCallback(async (source: SourceKey): Promise<Row[] | null> => {
    const url = source === 'members' ? '/api/hr/members?skipClaims=1' : '/api/hr/claims';
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) { toast(friendlyError(body.error), 'error'); return null; }
    const raw: Row[] = (source === 'members' ? body.members : body.claims) ?? [];

    const keys = FILTER_KEYS[source];
    const fromT = appliedFilters.from ? new Date(appliedFilters.from).getTime() : null;
    const toT = appliedFilters.to ? new Date(appliedFilters.to).getTime() + 86_399_999 : null;

    return raw.filter((r) => {
      // Rows with no usable date are kept rather than silently dropped — losing
      // them would understate the report without saying so.
      const t = toTime(r[keys.date]);
      if (t != null) {
        if (fromT != null && t < fromT) return false;
        if (toT != null && t > toT) return false;
      }
      if (appliedFilters.plan && keys.plan && String(r[keys.plan] ?? '') !== appliedFilters.plan) return false;
      return true;
    });
  }, [appliedFilters, toast]);

  const project = (rows: Row[], source: SourceKey, cols?: string[]): Row[] => {
    const fields = FIELDS[source].filter((f) => !cols || cols.includes(f.key));
    return rows.map((r) => Object.fromEntries(fields.map((f) => [f.label, f.from(r)])));
  };

  const filterMeta = () => {
    const m = [`Period: ${appliedFilters.from || '—'} to ${appliedFilters.to || '—'}`];
    if (appliedFilters.plan) m.push(`Plan: ${appliedFilters.plan}`);
    return m;
  };

  const runReport = useCallback(async (id: number, format: 'xls' | 'pdf') => {
    const def = ALL_REPORTS.find((r) => r.id === id);
    if (!def) return;
    setBusyId(id);
    try {
      const rows = await loadRows(def.source);
      if (!rows) return;
      if (rows.length === 0) {
        toast('No rows matched the selected period and plan — adjust the filters and try again.', 'info');
        return;
      }
      const out = project(rows, def.source);
      const slug = def.title.replace(/\s+/g, '-').toLowerCase();
      if (format === 'xls') {
        exportToXls(out, slug);
        toast(`${def.title} exported (${rows.length.toLocaleString()} rows).`, 'success');
      } else {
        const ok = exportToPdf(out, slug, { title: def.title, subtitle: def.desc, meta: filterMeta() });
        if (!ok) { toast('Your browser blocked the PDF window. Allow pop-ups for this site and try again.', 'error'); return; }
        toast(`${def.title} ready to save as PDF.`, 'success');
      }
      markRun(id);
    } catch {
      toast('Could not build this report. Please try again.', 'error');
    } finally {
      setBusyId(null);
    }
  }, [loadRows, markRun, toast]);

  const runCustom = useCallback(async (format: 'xls' | 'pdf') => {
    if (builderCols.length === 0) { toast('Pick at least one column for your report.', 'error'); return; }
    setBuilderBusy(true);
    try {
      const rows = await loadRows(builderSource);
      if (!rows) return;
      if (rows.length === 0) {
        toast('No rows matched the selected period and plan — adjust the filters and try again.', 'info');
        return;
      }
      const out = project(rows, builderSource, builderCols);
      const slug = (builderName.trim() || 'custom-report').replace(/\s+/g, '-').toLowerCase();
      if (format === 'xls') {
        exportToXls(out, slug);
        toast(`${builderName.trim() || 'Custom report'} exported (${rows.length.toLocaleString()} rows).`, 'success');
      } else {
        const ok = exportToPdf(out, slug, {
          title: builderName.trim() || 'Custom report',
          subtitle: `${builderSource === 'members' ? 'Membership' : 'Claims'} · ${builderCols.length} columns`,
          meta: filterMeta(),
        });
        if (!ok) { toast('Your browser blocked the PDF window. Allow pop-ups for this site and try again.', 'error'); return; }
        toast('Custom report ready to save as PDF.', 'success');
      }
      markRun('custom');
    } catch {
      toast('Could not build your report. Please try again.', 'error');
    } finally {
      setBuilderBusy(false);
    }
  }, [builderCols, builderName, builderSource, loadRows, markRun, toast]);

  const inputStyle: React.CSSProperties = {
    height: 44, padding: '0 12px', fontSize: 13, border: '1px solid #EDEEF2',
    borderRadius: 12, background: '#fff', color: '#131C4E', outline: 'none',
    boxSizing: 'border-box', width: '100%',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#6B7480', marginBottom: 6, display: 'block' };
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2',
    boxShadow: '0 1px 3px rgba(19,28,78,0.04)',
  };

  const dirty = from !== appliedFilters.from || to !== appliedFilters.to || plan !== appliedFilters.plan;

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Insights & Reports" subtitle="Analytics · Exports · Trends" />

      <div style={{ padding: '8px 30px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Scheme Health Score — the composite loss-ratio/COR/utilization score */}
        {health && (() => {
          const hsColor = health.label === 'Excellent' || health.label === 'Healthy' ? '#10B981'
            : health.label === 'Watchlist' ? '#D97706'
            : health.label === 'At Risk' ? '#F56B22'
            : '#EF4444';
          return (
            <div style={{ ...card, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 24 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Scheme Health Score</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: '#131C4E', letterSpacing: '-0.03em', lineHeight: 1 }}>{health.score}</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#C4C9D9' }}>/100</span>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: hsColor, marginTop: 4 }}>● {health.label}</p>
              </div>
              <div style={{ width: 1, height: 44, background: '#EDEEF2' }} />
              <div style={{ flex: 1, maxWidth: 320 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Score Trend</p>
                <div style={{ height: 5, background: '#EDEEF2', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${health.score}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg,${hsColor === '#10B981' ? '#10B981,#34D399' : hsColor === '#D97706' ? '#F59E0B,#FCD34D' : '#F56B22,#FF8C4B'})` }} />
                </div>
                <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 5 }}>{health.trendLabel ?? 'Building trend data…'}</p>
              </div>
            </div>
          );
        })()}

        {/* Filters */}
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 170 }}>
              <label style={labelStyle}>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ minWidth: 170 }}>
              <label style={labelStyle}>To</label>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ minWidth: 190 }}>
              <label style={labelStyle}>Plan</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">All Plans</option>
                {plans.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => setAppliedFilters({ from, to, plan })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
                fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 12,
                background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', cursor: 'pointer',
                boxShadow: dirty ? '0 2px 10px rgba(245,107,34,0.32)' : 'none',
              }}>
              <SlidersHorizontal style={{ width: 15, height: 15 }} /> Apply Filters
            </button>
            <button
              onClick={() => {
                setFrom(jan1); setTo(today.toISOString().slice(0, 10)); setPlan('');
                setAppliedFilters({ from: jan1, to: today.toISOString().slice(0, 10), plan: '' });
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 18px',
                fontSize: 13, fontWeight: 700, color: '#6B7480', background: '#fff',
                border: '1px solid #EDEEF2', borderRadius: 12, cursor: 'pointer',
              }}>
              <RotateCcw style={{ width: 15, height: 15 }} /> Reset
            </button>
          </div>

          {dirty && (
            <p style={{ fontSize: 11.5, color: '#D97706', marginTop: 10 }}>
              Filters changed — press Apply Filters so exports use them.
            </p>
          )}
        </div>

        {/* Report list */}
        {visibleReports.map((r) => {
          const Icon = r.icon;
          const updated = lastRun[String(r.id)];
          const busy = busyId === r.id;
          return (
            <div key={r.id} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, background: r.tint, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon style={{ width: 22, height: 22, color: r.color }} strokeWidth={1.9} />
              </div>

              <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                <p style={{ fontSize: 15.5, fontWeight: 800, color: '#131C4E' }}>{r.title}</p>
                <p style={{ fontSize: 12.5, color: '#9CA3B8', marginTop: 3 }}>{r.desc}</p>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 12,
                background: '#F7F8FC', flexShrink: 0,
              }}>
                <CalendarDays style={{ width: 14, height: 14, color: '#9CA3B8' }} />
                <div>
                  <p style={{ fontSize: 10, color: '#9CA3B8', fontWeight: 600 }}>{updated ? 'Last exported' : 'Not yet exported'}</p>
                  {updated && <p style={{ fontSize: 12, fontWeight: 700, color: '#131C4E' }}>{updated}</p>}
                </div>
              </div>

              <button
                onClick={() => runReport(r.id, 'xls')}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px',
                  fontSize: 12.5, fontWeight: 700, color: '#15803D', background: '#F0FDF4',
                  border: '1px solid #BBF7D0', borderRadius: 12, cursor: busy ? 'wait' : 'pointer', flexShrink: 0,
                }}>
                <FileSpreadsheet style={{ width: 15, height: 15 }} /> Export XLS
              </button>
              <button
                onClick={() => runReport(r.id, 'pdf')}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 16px',
                  fontSize: 12.5, fontWeight: 700, color: '#DC2626', background: '#FEF2F2',
                  border: '1px solid #FECACA', borderRadius: 12, cursor: busy ? 'wait' : 'pointer', flexShrink: 0,
                }}>
                <FileText style={{ width: 15, height: 15 }} /> Export PDF
              </button>

              <ChevronRight style={{ width: 18, height: 18, color: '#C4C9D9', flexShrink: 0 }} />
            </div>
          );
        })}

        {/* Custom report builder */}
        <div style={{ ...card, padding: builderOpen ? '20px 22px' : '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, background: '#EEF2FF', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FolderOpen style={{ width: 21, height: 21, color: '#4F46E5' }} strokeWidth={1.9} />
            </div>
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#131C4E' }}>Need a custom report?</p>
              <p style={{ fontSize: 12.5, color: '#9CA3B8', marginTop: 3 }}>
                Choose the data and the columns you want, then export it as XLS or PDF.
              </p>
            </div>
            <button
              onClick={() => setBuilderOpen((v) => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px',
                fontSize: 13, fontWeight: 700, color: builderOpen ? '#6B7480' : '#fff',
                background: builderOpen ? '#fff' : 'linear-gradient(135deg,#F56B22,#FF8C4B)',
                border: builderOpen ? '1px solid #EDEEF2' : 'none',
                borderRadius: 12, cursor: 'pointer', flexShrink: 0,
              }}>
              {builderOpen ? <><X style={{ width: 15, height: 15 }} /> Close</> : <>Build custom report →</>}
            </button>
          </div>

          {builderOpen && (
            <div style={{ marginTop: 20, borderTop: '1px solid #F0F1F5', paddingTop: 20 }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
                <div style={{ minWidth: 230 }}>
                  <label style={labelStyle}>Report name</label>
                  <input value={builderName} onChange={(e) => setBuilderName(e.target.value)} placeholder="e.g. Q3 membership by plan" style={inputStyle} />
                </div>
                <div style={{ minWidth: 200 }}>
                  <label style={labelStyle}>Data</label>
                  <select
                    value={builderSource}
                    onChange={(e) => {
                      const next = e.target.value as SourceKey;
                      setBuilderSource(next);
                      // Columns belong to a source, so reset to that source's defaults.
                      setBuilderCols(FIELDS[next].slice(0, 6).map((f) => f.key));
                    }}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="members">Membership</option>
                    <option value="claims">Claims</option>
                  </select>
                </div>
              </div>

              <label style={labelStyle}>Columns ({builderCols.length} selected)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {FIELDS[builderSource].map((f) => {
                  const on = builderCols.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      onClick={() => setBuilderCols((prev) => on ? prev.filter((k) => k !== f.key) : [...prev, f.key])}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px',
                        fontSize: 12.5, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
                        color: on ? '#F56B22' : '#6B7480',
                        background: on ? '#FFF3E8' : '#fff',
                        border: `1px solid ${on ? '#FFD5B8' : '#EDEEF2'}`,
                      }}>
                      {on && <Check style={{ width: 13, height: 13 }} />}
                      {f.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                <button onClick={() => setBuilderCols(FIELDS[builderSource].map((f) => f.key))}
                  style={{ fontSize: 12, fontWeight: 700, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Select all
                </button>
                <button onClick={() => setBuilderCols([])}
                  style={{ fontSize: 12, fontWeight: 700, color: '#9CA3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Clear
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => runCustom('xls')}
                  disabled={builderBusy || builderCols.length === 0}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, height: 44, padding: '0 18px',
                    fontSize: 13, fontWeight: 700, color: '#15803D', background: '#F0FDF4',
                    border: '1px solid #BBF7D0', borderRadius: 12,
                    cursor: builderBusy || builderCols.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: builderCols.length === 0 ? 0.6 : 1,
                  }}>
                  <FileSpreadsheet style={{ width: 15, height: 15 }} /> {builderBusy ? 'Building…' : 'Export XLS'}
                </button>
                <button
                  onClick={() => runCustom('pdf')}
                  disabled={builderBusy || builderCols.length === 0}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, height: 44, padding: '0 18px',
                    fontSize: 13, fontWeight: 700, color: '#DC2626', background: '#FEF2F2',
                    border: '1px solid #FECACA', borderRadius: 12,
                    cursor: builderBusy || builderCols.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: builderCols.length === 0 ? 0.6 : 1,
                  }}>
                  <FileText style={{ width: 15, height: 15 }} /> {builderBusy ? 'Building…' : 'Export PDF'}
                </button>
                <p style={{ fontSize: 11.5, color: '#9CA3B8' }}>
                  Uses the period and plan applied above.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
