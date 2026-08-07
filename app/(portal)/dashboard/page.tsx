'use client';

import {
  UserPlus, Users, FileText, Gauge, Wallet,
  Upload, CreditCard, MessageSquare, Building2, CheckCircle2, ChevronRight,
  Thermometer, Heart, Droplet, Baby, Pill, Eye, Stethoscope, Bell,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { DashboardVis, DEFAULTS, getVis } from '@/lib/module-visibility';

// recharts is heavy and the chart sits below the fold, so it loads after
// hydration instead of blocking the dashboard's first paint.
const SpendAreaChart = dynamic(
  () => import('@/components/ui/SpendAreaChart').then((m) => m.SpendAreaChart),
  { ssr: false, loading: () => <div style={{ height: 158 }} /> },
);
import { TopBar } from '@/components/layout/TopBar';
import { StatCard } from '@/components/ui/StatCard';
import { LoadErrorBanner } from '@/components/LoadErrorBanner';
import { friendlyError } from '@/lib/user-facing-error';

const PROVIDER_GRADS = [
  'linear-gradient(135deg,#131C4E,#3A4382)',
  'linear-gradient(135deg,#F56B22,#FFB54B)',
  'linear-gradient(135deg,#10B981,#059669)',
  'linear-gradient(135deg,#8B5CF6,#6366F1)',
  'linear-gradient(135deg,#3B82F6,#1D4ED8)',
];

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid #EDEEF2',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

function getGreeting(firstName: string): string {
  const hour = new Date().getHours();
  const name = firstName || 'there';
  if (hour < 12) return `Good morning, ${name} ☀️`;
  if (hour < 17) return `Good afternoon, ${name} 👋`;
  return `Good evening, ${name} 🌙`;
}

interface DashboardStats {
  activeLives: number | null;
  principalLives: number | null;
  dependantLives: number | null;
  newThisMonth: number | null;
  newThisMonthLabel: string | null;
  totalPremium: number | null;
  earnedPremium: number | null;
  elapsedDays: number | null;
  totalPolicyDays: number | null;
  claimsPaid: number | null;
  outstandingClaims: number | null;
  estimatedIBNR: number | null;
  ibnrMethod: string | null;
  totalIncurredClaims: number | null;
  amtClaimed: number | null;
  uniqueClaimsCount: number | null;
  membersUtilized: number | null;
  utilizationRatePct: number | null;
  lossRatioPct: number | null;
  lossRatioExact: number | null;
  cor: number | null;
  brokerage: number | null;
  nhiaFee: number | null;
  adminFee: number | null;
  riskStatus: string | null;
  schemeHealthScore: number | null;
  schemeHealthLabel: string | null;
  schemeHealthTrend: number | null;
  schemeHealthTrendLabel: string | null;
  topProviders: { name: string; location: string; visits: number; amtPaid: number }[];
  allProviders: { name: string; location: string; visits: number; amtPaid: number }[];
  topServices: { service: string; visits: number; amtPaid: number }[];
  topConditions: { name: string; visits: number; amtPaid?: number }[];
  monthlySpend: { month: string; amount: number }[];
  undatedPaidCount?: number;
  undatedPaidAmount?: number;
  claimsPaidPrevYtd: number | null;
  claimsYoYPct: number | null;
  memberMonthly: { month: string; count: number }[];
  lossRatioMonthly: { month: string; pct: number }[];
  invoiceOutstanding: number | null;
  invoiceHasOutstanding: boolean;
  invoiceNextDue: string | null;
  invoiceReceiptNumber: string | null;
  policyPeriod: string | null;
  policyYear: number | null;
  policyFromDate: string | null;
  policyToDate: string | null;
}

// NextDue arrives as either ISO (yyyy-mm-dd…) or dd/mm/yyyy; both are day-precision.
function parseDueDate(raw: string | null): Date | null {
  if (!raw) return null;
  const t = raw.trim().slice(0, 10);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  return null;
}

function dueLabel(nextDue: string | null): string {
  const due = parseDueDate(nextDue);
  if (!due) return 'Payment due';
  const today = new Date();
  const days = Math.round((due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (days > 1) return `Due in ${days} days`;
  if (days === 1) return 'Due tomorrow';
  if (days === 0) return 'Due today';
  return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
}

function fmtNaira(amount: number | null): string {
  if (amount === null) return '—';
  if (amount >= 1_000_000_000) return `₦${(Math.floor(amount / 100_000_000) / 10).toFixed(1)}B`;
  if (amount >= 1_000_000) return `₦${(Math.floor(amount / 100_000) / 10).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(Math.floor(amount / 1_000)).toFixed(0)}K`;
  return `₦${amount.toLocaleString()}`;
}

function fmtLives(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString();
}

export default function DashboardPage() {
  const router = useRouter();
  const [vis, setVis] = useState<DashboardVis>(DEFAULTS.dashboard);
  useEffect(() => { setVis(getVis('dashboard')); }, []);
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const companyName: string = user?.companyName ?? '';
  const fullName: string = session?.user?.name ?? '';
  const firstName = fullName.split(' ')[0];

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [spendRange, setSpendRange] = useState<'ytd' | '3m'>('ytd');
  const [pendingEnrolmentCount, setPendingEnrolmentCount] = useState<number | null>(null);
  // Without this the dashboard renders zeros on a failed load, which reads as
  // "no members" rather than "we couldn't reach Prognosis".
  const [loadError, setLoadError] = useState('');

  const loadStats = useCallback(() => {
    setLoadError('');
    fetch('/api/hr/dashboard-stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setLoadError(friendlyError(d.error)); return; }
        if (d.stats) setStats(d.stats);
      })
      .catch(() => setLoadError(friendlyError(null)));
  }, []);

  // Loading on mount unavoidably sets state from an effect; the rule is about
  // avoiding cascading renders, which a single fetch-on-mount does not cause.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    fetch('/api/hr/members/pending')
      .then((r) => r.json())
      .then((d) => { if (typeof d.totalBeneficiaries === 'number') setPendingEnrolmentCount(d.totalBeneficiaries); })
      .catch(() => {});
  }, []);

  // Recent Service Desk requests + the staff-published system notice.
  const [recentRequests, setRecentRequests] = useState<
    { id: string; ticketId: string; subject: string; status: string; lastUpdated: string }[] | null
  >(null);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/hr/service-requests?limit=4')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRecentRequests(Array.isArray(d.requests) ? d.requests : []); })
      .catch(() => { if (!cancelled) setRecentRequests([]); });
    fetch('/api/hr/system-notice')
      .then((r) => r.json())
      .then((d) => { if (!cancelled && typeof d.notice === 'string' && d.notice.trim()) setSystemNotice(d.notice.trim()); })
      .catch(() => { /* no bar */ });
    return () => { cancelled = true; };
  }, []);

  const activeLives        = stats?.activeLives        ?? null;
  const principalLives     = stats?.principalLives     ?? null;
  const dependantLives     = stats?.dependantLives     ?? null;
  const newThisMonth       = stats?.newThisMonth       ?? null;
  const claimsPaid         = stats?.claimsPaid         ?? null;
  const lossRatioPct       = stats?.lossRatioPct       ?? null;
  const riskStatus         = stats?.riskStatus         ?? null;
  const liveTopProviders      = stats?.topProviders         ?? null;
  const liveMonthlySpend      = stats?.monthlySpend         ?? [];
  const liveAllProviders      = stats?.allProviders         ?? [];
  const claimsYoYPct          = stats?.claimsYoYPct         ?? null;
  const memberMonthly         = stats?.memberMonthly        ?? [];
  const lossRatioMonthly      = stats?.lossRatioMonthly     ?? [];
  const invoiceOutstanding    = stats?.invoiceOutstanding   ?? null;
  const invoiceHasOutstanding = stats?.invoiceHasOutstanding ?? false;
  const invoiceNextDue        = stats?.invoiceNextDue       ?? null;
  const invoiceReceiptNumber  = stats?.invoiceReceiptNumber ?? null;

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      {/* No page title — the greeting below is the heading, as in the design. */}
      <TopBar notificationCount={pendingEnrolmentCount ?? undefined} />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {loadError && <LoadErrorBanner message={loadError} onRetry={loadStats} />}

        {/* ── ROW 1: GREETING ── */}
        {/* The Scheme Health Score card that used to sit here lives on
            Insights & Reports now — the design keeps this row to the greeting. */}
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {getGreeting(firstName)}
          </h1>
          <p style={{ fontSize: 13, color: '#9CA3B8', marginTop: 6 }}>
            Here&rsquo;s everything happening with {companyName || 'your scheme'} today.
          </p>
        </div>

        {/* ── ROW 2: 4 KPI CARDS ── */}
        {vis.showKpiCards && (() => {
          const lrColor = riskStatus === 'Healthy' ? '#10B981' : riskStatus === 'Watchlist' ? '#D97706' : riskStatus ? '#EF4444' : '#6B7480';
          const cards = [
            {
              value: fmtLives(activeLives),
              label: 'Active Members',
              sub: newThisMonth !== null && newThisMonth > 0
                ? `▲ ${newThisMonth} this month`
                : principalLives !== null && dependantLives !== null
                  ? `${principalLives.toLocaleString()} staff · ${dependantLives.toLocaleString()} dependants`
                  : 'Covered lives',
              subColor: newThisMonth !== null && newThisMonth > 0 ? '#10B981' : undefined,
              icon: Users, color: '#10B981', tint: '#ECFDF5',
              trend: memberMonthly.map((m) => m.count),
              footer: { label: 'View members', onClick: () => router.push('/members') },
            },
            {
              value: vis.showAmounts && claimsPaid !== null ? fmtNaira(claimsPaid) : '—',
              label: 'Claims Paid (YTD)',
              sub: claimsYoYPct !== null
                ? `${claimsYoYPct >= 0 ? '▲' : '▼'} ${Math.abs(claimsYoYPct)}% vs last year`
                : 'Policy year to date',
              subColor: claimsYoYPct !== null ? '#10B981' : undefined,
              icon: FileText, color: '#3B82F6', tint: '#EFF6FF',
              trend: liveMonthlySpend.map((m) => m.amount),
              footer: { label: 'View claims report', onClick: () => router.push('/claims') },
            },
            {
              value: lossRatioPct !== null ? `${lossRatioPct}%` : '—',
              label: 'Loss Ratio',
              sub: riskStatus ? `● ${riskStatus}` : 'Risk status pending',
              subColor: riskStatus ? lrColor : undefined,
              icon: Gauge,
              color: lrColor,
              tint: riskStatus === 'Healthy' ? '#ECFDF5' : riskStatus === 'Watchlist' ? '#FFFBEB' : riskStatus ? '#FEF2F2' : '#F3F4F8',
              trend: lossRatioMonthly.map((m) => m.pct),
              footer: { label: 'View loss ratio report', onClick: () => router.push('/reports') },
            },
            {
              value: vis.showAmounts && invoiceOutstanding !== null ? fmtNaira(invoiceOutstanding) : '—',
              label: 'Outstanding Invoice',
              sub: invoiceOutstanding === null ? 'No invoice data'
                : invoiceHasOutstanding ? dueLabel(invoiceNextDue)
                : 'All clear',
              subColor: invoiceOutstanding === null ? undefined : invoiceHasOutstanding ? '#EF4444' : '#10B981',
              icon: Wallet,
              color: invoiceHasOutstanding ? '#EF4444' : '#F56B22',
              tint: invoiceHasOutstanding ? '#FEF2F2' : '#FFF5EF',
              footer: { label: 'View invoices', onClick: () => router.push('/finance') },
            },
          ];
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
              {cards.map((k) => (
                <StatCard
                  key={k.label}
                  label={k.label}
                  sub={k.sub}
                  subColor={k.subColor}
                  value={k.value}
                  icon={k.icon}
                  color={k.color}
                  tint={k.tint}
                  trend={'trend' in k ? k.trend : undefined}
                  footer={k.footer}
                  loading={stats === null && !loadError}
                />
              ))}
            </div>
          );
        })()}

        {/* ── ROW 3: QUICK ACTIONS + NOTIFICATIONS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>

          {/* Quick actions — every tile lands on a real, existing flow. */}
          <div style={{ ...card, padding: '24px 26px' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E', marginBottom: 18 }}>Quick actions</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 10 }}>
              {[
                // Each tile lands on the action itself, not the page that
                // contains it. Download E-card is the one that cannot open
                // cold — a card belongs to a specific member — so it carries
                // an intent that People uses to prompt for one and then opens
                // the card straight away.
                { label: 'Add member',      icon: UserPlus,      color: '#F56B22', onClick: () => router.push('/members?action=add') },
                { label: 'Upload Excel',    icon: Upload,        color: '#10B981', onClick: () => router.push('/members?action=upload') },
                { label: 'Download E-card', icon: CreditCard,    color: '#3B82F6', onClick: () => router.push('/members?action=ecard') },
                { label: 'Raise request',   icon: MessageSquare, color: '#8B5CF6', onClick: () => router.push('/service-desk?new=1') },
                { label: 'Find provider',   icon: Building2,     color: '#F56B22', onClick: () => router.push('/benefits?tab=providers') },
              ].map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 10, padding: '18px 6px', background: '#fff',
                      border: '1px solid #EDEEF2', borderRadius: 12, cursor: 'pointer',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(19,28,78,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#EDEEF2'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <Icon style={{ width: 21, height: 21, color: a.color }} strokeWidth={1.9} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#131C4E', lineHeight: 1.3, textAlign: 'center' }}>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notifications — derived from live signals rather than an event log,
              so there are no fabricated timestamps; each row navigates to where
              the work is done. */}
          {(() => {
            const rows: { key: string; icon: React.ElementType; color: string; tint: string; title: string; sub?: string; href: string }[] = [];
            if (pendingEnrolmentCount !== null && pendingEnrolmentCount > 0) {
              rows.push({
                key: 'pending', icon: UserPlus, color: '#EF4444', tint: '#FEF2F2',
                title: `${pendingEnrolmentCount} enrolment${pendingEnrolmentCount === 1 ? '' : 's'} awaiting approval`,
                sub: 'Beneficiaries need your review',
                href: '/pending-enrolees',
              });
            }
            if (invoiceHasOutstanding && invoiceOutstanding !== null) {
              const due = dueLabel(invoiceNextDue);
              rows.push({
                key: 'invoice', icon: FileText, color: '#D97706', tint: '#FFFBEB',
                title: invoiceReceiptNumber
                  ? `Invoice ${invoiceReceiptNumber} — ${due}`
                  : `Invoice ${due.charAt(0).toLowerCase()}${due.slice(1)}`,
                sub: vis.showAmounts ? `Amount: ₦${invoiceOutstanding.toLocaleString()}` : undefined,
                href: '/finance',
              });
            }
            if (newThisMonth !== null && newThisMonth > 0) {
              rows.push({
                key: 'new-members', icon: CheckCircle2, color: '#10B981', tint: '#ECFDF5',
                title: `${newThisMonth} member${newThisMonth === 1 ? '' : 's'} added this month`,
                sub: 'View the full list of new members',
                href: '/members',
              });
            }
            return (
              <div style={{ ...card, padding: '24px 26px' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E', marginBottom: 14 }}>Notifications</p>
                {rows.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0' }}>
                    <CheckCircle2 style={{ width: 18, height: 18, color: '#10B981', flexShrink: 0 }} />
                    <p style={{ fontSize: 12.5, color: '#9CA3B8' }}>
                      {stats === null && !loadError ? 'Checking for updates…' : 'You’re all caught up.'}
                    </p>
                  </div>
                ) : rows.map((n, i) => {
                  const Icon = n.icon;
                  return (
                    <div
                      key={n.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(n.href)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(n.href); } }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 4px',
                        borderBottom: i < rows.length - 1 ? '1px solid #F5F6FA' : 'none',
                        cursor: 'pointer', borderRadius: 8,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#FAFBFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', background: n.tint, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon style={{ width: 16, height: 16, color: n.color }} strokeWidth={1.9} />
                      </div>
                      <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: '#131C4E', lineHeight: 1.35 }}>{n.title}</p>
                        {n.sub && <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>{n.sub}</p>}
                      </div>
                      <ChevronRight style={{ width: 15, height: 15, color: '#C4C9D9', flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── ROW 4: ANALYTICS ── */}
        {(() => {
          const columns: React.ReactNode[] = [];
          const colCard: React.CSSProperties = { ...card, padding: '22px 22px 14px', display: 'flex', flexDirection: 'column', minWidth: 0 };
          const colTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#131C4E' };
          const colSub: React.CSSProperties = { fontSize: 11.5, color: '#9CA3B8', marginTop: 2 };
          const footerBtn: React.CSSProperties = {
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto',
            padding: '12px 2px 2px', fontSize: 12, fontWeight: 700, color: '#F56B22',
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          };
          const headerLink: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 };

          if (vis.showSpendChart) {
            const spend = spendRange === '3m' ? liveMonthlySpend.slice(-3) : liveMonthlySpend;
            columns.push(
              <div key="spend" style={colCard}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <p style={colTitle}>Claims Spend Trend</p>
                    <p style={colSub}>Monthly</p>
                  </div>
                  <select
                    value={spendRange}
                    onChange={(e) => setSpendRange(e.target.value as 'ytd' | '3m')}
                    style={{ fontSize: 11.5, fontWeight: 600, color: '#131C4E', border: '1px solid #EDEEF2', borderRadius: 8, padding: '4px 8px', background: '#fff', cursor: 'pointer' }}
                  >
                    <option value="ytd">YTD</option>
                    <option value="3m">3M</option>
                  </select>
                </div>
                {spend.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#B0B7C9', padding: '30px 0', textAlign: 'center', lineHeight: 1.6 }}>
                    {stats === null && !loadError
                      ? 'Loading claims data…'
                      // "No claims data yet" was wrong whenever claims had been
                      // paid but none could be placed on a month — which read as
                      // a broken chart sitting under a non-zero Paid Claims KPI.
                      : (stats?.undatedPaidCount ?? 0) > 0
                        ? `${stats!.undatedPaidCount} paid claim${stats!.undatedPaidCount === 1 ? '' : 's'} carry no treatment or payment date, so they cannot be placed on a month. They are included in Claims Paid.`
                        : (stats?.claimsPaid ?? 0) > 0
                          ? 'Claims have been paid, but none fall inside the current policy year.'
                          : 'No claims paid yet this policy year.'}
                  </p>
                ) : (
                  <>
                    <SpendAreaChart data={spend} />
                    {(stats?.undatedPaidCount ?? 0) > 0 && (
                      <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 6, lineHeight: 1.5 }}>
                        Excludes {stats!.undatedPaidCount} paid claim{stats!.undatedPaidCount === 1 ? '' : 's'} with no treatment or payment date.
                      </p>
                    )}
                  </>
                )}
                <button style={footerBtn} onClick={() => router.push('/claims')}>View full report <span aria-hidden="true">→</span></button>
              </div>
            );
          }

          if (vis.showTopProviders) {
            const providers = (liveTopProviders ?? []).slice(0, 5);
            const totalPaid = (liveAllProviders.length > 0 ? liveAllProviders : providers)
              .reduce((s, p) => s + (p.amtPaid || 0), 0);
            columns.push(
              <div key="providers" style={colCard}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <p style={colTitle}>Top Providers</p>
                    <p style={colSub}>By amount paid (YTD)</p>
                  </div>
                  <button onClick={() => setShowAllProviders(true)} style={headerLink}>View all →</button>
                </div>
                {providers.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#B0B7C9', padding: '30px 0', textAlign: 'center' }}>
                    {stats === null && !loadError ? 'Loading provider data…' : 'No provider activity yet.'}
                  </p>
                ) : providers.map((p, i) => {
                  const pct = totalPaid > 0 && p.amtPaid > 0 ? Math.round((p.amtPaid / totalPaid) * 1000) / 10 : null;
                  return (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < providers.length - 1 ? '1px solid #F5F6FA' : 'none' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: PROVIDER_GRADS[i % PROVIDER_GRADS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 10.5, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <p style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#131C4E' }}>{vis.showAmounts ? fmtNaira(p.amtPaid) : `${p.visits} visits`}</p>
                        {pct !== null && <p style={{ fontSize: 10.5, color: '#9CA3B8', marginTop: 1 }}>{pct}%</p>}
                      </div>
                    </div>
                  );
                })}
                <button style={footerBtn} onClick={() => router.push('/reports')}>View provider report <span aria-hidden="true">→</span></button>
              </div>
            );
          }

          if (vis.showTopConditions) {
            const conditions = (stats?.topConditions ?? []).slice(0, 5);
            const condTotal = conditions.reduce((s, c) => s + (c.amtPaid ?? c.visits), 0);
            const CONDITION_TINTS = [
              { color: '#EF4444', tint: '#FEF2F2' },
              { color: '#D97706', tint: '#FFFBEB' },
              { color: '#8B5CF6', tint: '#F5F3FF' },
              { color: '#3B82F6', tint: '#EFF6FF' },
              { color: '#10B981', tint: '#ECFDF5' },
            ];
            const iconFor = (name: string): React.ElementType => {
              if (/malaria|typhoid/i.test(name)) return Thermometer;
              if (/hypertension|anaemia/i.test(name)) return Heart;
              if (/diabetes|urinary/i.test(name)) return Droplet;
              if (/pregnan/i.test(name)) return Baby;
              if (/pharmacy|pain/i.test(name)) return Pill;
              if (/eye/i.test(name)) return Eye;
              return Stethoscope;
            };
            columns.push(
              <div key="conditions" style={colCard}>
                <div style={{ marginBottom: 12 }}>
                  <p style={colTitle}>Top Conditions</p>
                  <p style={colSub}>By claims spend (YTD)</p>
                </div>
                {conditions.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#B0B7C9', padding: '30px 0', textAlign: 'center' }}>
                    {stats === null && !loadError ? 'Loading condition data…' : 'No condition data yet.'}
                  </p>
                ) : conditions.map((c, i) => {
                  const CIcon = iconFor(c.name);
                  const t = CONDITION_TINTS[i % CONDITION_TINTS.length];
                  const amt = c.amtPaid ?? c.visits;
                  const pct = condTotal > 0 ? Math.round((amt / condTotal) * 1000) / 10 : null;
                  return (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < conditions.length - 1 ? '1px solid #F5F6FA' : 'none' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: t.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CIcon style={{ width: 13, height: 13, color: t.color }} strokeWidth={2} />
                      </div>
                      <p style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#131C4E' }}>
                          {c.amtPaid != null ? (vis.showAmounts ? fmtNaira(c.amtPaid) : '—') : `${c.visits} visits`}
                        </p>
                        {pct !== null && <p style={{ fontSize: 10.5, color: '#9CA3B8', marginTop: 1 }}>{pct}%</p>}
                      </div>
                    </div>
                  );
                })}
                <button style={footerBtn} onClick={() => router.push('/reports')}>View full report <span aria-hidden="true">→</span></button>
              </div>
            );
          }

          {
            // Recent Requests — live from the Service Desk's request store.
            const REQ_STATUS: Record<string, { bg: string; text: string }> = {
              'Open':             { bg: '#FEF2F2', text: '#DC2626' },
              'In Progress':      { bg: '#FFFBEB', text: '#D97706' },
              'Awaiting Client':  { bg: '#EFF6FF', text: '#2563EB' },
              'Awaiting Leadway': { bg: '#F5F3FF', text: '#7C3AED' },
              'Closed':           { bg: '#F1F5F9', text: '#475569' },
            };
            const requests = recentRequests ?? [];
            columns.push(
              <div key="requests" style={colCard}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <p style={colTitle}>Recent Requests</p>
                    <p style={colSub}>Latest from the Service Desk</p>
                  </div>
                  <button onClick={() => router.push('/service-desk')} style={headerLink}>View all →</button>
                </div>
                {requests.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#B0B7C9', padding: '30px 0', textAlign: 'center' }}>
                    {recentRequests === null ? 'Loading requests…' : 'No requests yet — raise one from Quick actions.'}
                  </p>
                ) : requests.map((t, i) => {
                  const chip = REQ_STATUS[t.status] ?? REQ_STATUS['Closed'];
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < requests.length - 1 ? '1px solid #F5F6FA' : 'none' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#F3F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MessageSquare style={{ width: 13, height: 13, color: '#6B7480' }} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</p>
                        <p style={{ fontSize: 10.5, color: '#9CA3B8', marginTop: 1 }}>{t.ticketId} · {t.lastUpdated}</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: chip.bg, color: chip.text, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {t.status}
                      </span>
                    </div>
                  );
                })}
                <button style={footerBtn} onClick={() => router.push('/service-desk')}>View all requests <span aria-hidden="true">→</span></button>
              </div>
            );
          }

          if (columns.length === 0) return null;
          // minmax(0,…) on every track: a bare `1fr` cannot shrink below its
          // content, so long provider names pushed this row — and with it the
          // whole page — into horizontal overflow.
          const template = columns.length === 4
            ? 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.15fr)'
            : `repeat(${columns.length},minmax(0,1fr))`;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: template, gap: 16, alignItems: 'stretch' }}>
              {columns}
            </div>
          );
        })()}

        {/* ── SYSTEM NOTICE ── set per corporate by Leadway staff. */}
        {systemNotice && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px',
            background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 14,
          }}>
            <Bell style={{ width: 16, height: 16, color: '#F56B22', flexShrink: 0 }} strokeWidth={2} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#F56B22', flexShrink: 0 }}>System notice</span>
            <span style={{ width: 1, alignSelf: 'stretch', background: '#FED7AA', flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: '#7C4A12', flex: 1, minWidth: 0 }}>{systemNotice}</p>
          </div>
        )}

      </div>

      {/* ── ALL PROVIDERS MODAL ── */}
      {showAllProviders && (
      <div
        onClick={() => setShowAllProviders(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(19,28,78,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: 480, height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
        >
          <div style={{ padding: '28px 28px 16px', borderBottom: '1px solid #EDEEF2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#131C4E' }}>All Provider Utilization</p>
              <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 3 }}>{liveAllProviders.length} providers · By visits &amp; spend</p>
            </div>
            <button onClick={() => setShowAllProviders(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9CA3B8', lineHeight: 1, padding: 4 }}>✕</button>
          </div>
          <div style={{ padding: '12px 28px 28px' }}>
            {liveAllProviders.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: i < liveAllProviders.length - 1 ? '1px solid #F5F6FA' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: PROVIDER_GRADS[i % PROVIDER_GRADS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0, marginRight: 14 }}>
                  {p.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>{p.location || '—'}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>{vis.showAmounts ? fmtNaira(p.amtPaid) : '—'}</p>
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>{p.visits} visits</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
