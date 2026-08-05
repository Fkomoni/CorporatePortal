'use client';

import {
  TrendingDown, UserPlus, Users, FileText, Gauge, Wallet,
  Upload, CreditCard, MessageSquare, Building2, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DashboardVis, DEFAULTS, getVis } from '@/lib/module-visibility';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
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

  const activeLives        = stats?.activeLives        ?? null;
  const principalLives     = stats?.principalLives     ?? null;
  const dependantLives     = stats?.dependantLives     ?? null;
  const newThisMonth       = stats?.newThisMonth       ?? null;
  const totalPremium       = stats?.totalPremium       ?? null;
  const earnedPremium      = stats?.earnedPremium      ?? null;
  const claimsPaid         = stats?.claimsPaid         ?? null;
  const outstandingClaims  = stats?.outstandingClaims  ?? null;
  const estimatedIBNR      = stats?.estimatedIBNR      ?? null;
  const totalIncurredClaims = stats?.totalIncurredClaims ?? null;
  const lossRatioPct       = stats?.lossRatioPct       ?? null;
  const cor                = stats?.cor                ?? null;
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

        {/* ── ACTION CENTRE ── */}
        {vis.showActionCentre && (
        <div style={{ ...card, padding: '28px 32px' }}>
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Action Centre</p>
            <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 3 }}>Items requiring your attention today</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            {[
              {
                Icon: UserPlus, border: '#EF4444', urgency: 'Urgent',
                title: pendingEnrolmentCount === null
                  ? 'Checking for pending enrolments…'
                  : pendingEnrolmentCount === 0
                    ? 'No Beneficiaries Awaiting Approval'
                    : `${pendingEnrolmentCount} Beneficiar${pendingEnrolmentCount === 1 ? 'y' : 'ies'} Enrolment Awaiting Approval`,
                action: 'View List →', actionColor: '#EF4444', onClick: () => router.push('/pending-enrolees'),
              },
            ].map((item) => {
              const Icon = item.Icon;
              return (
                <div
                  key={item.title}
                  style={{ padding: 18, background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', borderLeft: `4px solid ${item.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: '#F7F8FC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 17, height: 17, color: '#6B7480' }} strokeWidth={1.75} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: item.actionColor, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{item.urgency}</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#131C4E', lineHeight: 1.4, marginBottom: 12 }}>{item.title}</p>
                  <button onClick={item.onClick} style={{ fontSize: 13, fontWeight: 600, color: item.actionColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {item.action}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        )}

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Quick actions — every tile lands on a real, existing flow. */}
          <div style={{ ...card, padding: '24px 26px' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E', marginBottom: 18 }}>Quick actions</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
              {[
                { label: 'Add member',      icon: UserPlus,      color: '#F56B22', onClick: () => router.push('/members?action=add') },
                { label: 'Upload Excel',    icon: Upload,        color: '#10B981', onClick: () => router.push('/members?action=upload') },
                { label: 'Download E-card', icon: CreditCard,    color: '#3B82F6', onClick: () => router.push('/members') },
                { label: 'Raise request',   icon: MessageSquare, color: '#8B5CF6', onClick: () => router.push('/service-desk?new=1') },
                { label: 'Find provider',   icon: Building2,     color: '#F56B22', onClick: () => setShowAllProviders(true) },
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

        {/* ── ROW 3: LOSS RATIO (large, full-width) ── */}
        {vis.showLossRatio && (
        <div style={{ ...card, padding: '32px 36px' }}>
          {(() => {
            const rs = riskStatus ?? (lossRatioPct !== null ? (lossRatioPct <= 60 ? 'Healthy' : lossRatioPct <= 80 ? 'Watchlist' : lossRatioPct <= 100 ? 'High Risk' : 'Critical') : 'Unknown');
            const lrColor  = rs === 'Healthy' ? '#10B981' : rs === 'Watchlist' ? '#D97706' : '#EF4444';
            const lrBg     = rs === 'Healthy' ? '#ECFDF5' : rs === 'Watchlist' ? '#FFFBEB' : '#FEF2F2';
            const lrBorder = rs === 'Healthy' ? '#A7F3D0' : rs === 'Watchlist' ? '#FDE68A' : '#FECACA';
            return (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 40 }}>
              <div>
                <p style={{ fontSize: 12, color: '#9CA3B8', fontWeight: 500, marginBottom: 8 }}>Loss Ratio (LR)</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: lrColor, letterSpacing: '-0.03em', lineHeight: 1 }}>{lossRatioPct ?? '—'}</span>
                  {lossRatioPct !== null && <span style={{ fontSize: 22, fontWeight: 700, color: lrColor }}>%</span>}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, color: '#9CA3B8', fontWeight: 500, marginBottom: 8 }}>Combined Operating Ratio (COR)</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: cor !== null ? lrColor : '#C4C9D9', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {cor !== null ? cor : '—'}
                  </span>
                  {cor !== null && <span style={{ fontSize: 22, fontWeight: 700, color: lrColor }}>%</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: lrBg, border: `1px solid ${lrBorder}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: lrColor }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: lrColor, display: 'inline-block' }} />
                {rs}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '16px 24px', maxWidth: 420 }}>
                {([
                  { label: 'Claims Paid',        value: fmtNaira(claimsPaid) },
                  { label: 'Outstanding Claims', value: fmtNaira(outstandingClaims) },
                  { label: 'Estimated IBNR',     value: fmtNaira(estimatedIBNR) },
                  { label: 'Total Incurred',     value: fmtNaira(totalIncurredClaims) },
                  { label: 'Earned Premium',     value: fmtNaira(earnedPremium ?? totalPremium) },
                ] as { label: string; value: string }[]).map((m) => (
                  <div key={m.label} style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: '#9CA3B8', marginBottom: 3 }}>{m.label}</p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em' }}>{vis.showAmounts ? m.value : '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
            );
          })()}
          <div style={{ height: 8, background: '#EDEEF2', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${Math.min(lossRatioPct ?? 77, 100)}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#10B981 0%,#F59E0B 55%,#EF4444 85%)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Green', range: '<70%', color: '#059669' },
                { label: '⬤ Amber', range: '70–90%', color: '#D97706' },
                { label: 'Red', range: '>90%', color: '#DC2626' },
              ].map((l) => (
                <span key={l.label} style={{ fontSize: 11, fontWeight: 600, color: l.color }}>
                  {l.label} <span style={{ fontWeight: 400, color: '#B0B7C9' }}>{l.range}</span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#9CA3B8' }}>
              <TrendingDown className="w-3.5 h-3.5" strokeWidth={2} />
              {lossRatioPct !== null ? `${lossRatioPct}% current (${riskStatus ?? '—'}) · COR ${cor !== null ? `${cor}%` : '—'}` : 'Loss ratio data loading…'}
            </div>
          </div>
        </div>
        )}

        {/* ── ROW 4: CHARTS ── */}
        {(vis.showSpendChart || vis.showTopConditions) && (
        <div style={{ display: 'grid', gridTemplateColumns: vis.showSpendChart && vis.showTopConditions ? '3fr 2fr' : '1fr', gap: 16 }}>

          {vis.showSpendChart && (() => {
            const spend = liveMonthlySpend;
            const first = spend[0];
            const last = spend[spend.length - 1];
            const ytdTotal = spend.reduce((s, m) => s + m.amount, 0);
            const growthPct = first && first.amount > 0 && last
              ? Math.round(((last.amount - first.amount) / first.amount) * 100)
              : null;
            const rangeLabel = first && last
              ? (first.month === last.month ? first.month : `${first.month}–${last.month}`)
              : null;
            return (
            <div style={{ ...card, padding: '26px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>Claims Spend Trend</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>{rangeLabel ? `Monthly · ${rangeLabel}` : 'Monthly'}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F56B22' }}>{vis.showAmounts && spend.length > 0 ? `₦${ytdTotal.toFixed(1)}M` : '—'} YTD</span>
            </div>
            {spend.length === 0 ? (
              <p style={{ fontSize: 12, color: '#B0B7C9', padding: '24px 0', textAlign: 'center' }}>No claims data yet.</p>
            ) : (
            <>
            <ResponsiveContainer width="100%" height={148}>
              <AreaChart data={spend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F56B22" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="#F56B22" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#B0B7C9' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#B0B7C9' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${v}M`} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #EDEEF2', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                  formatter={(v) => [`₦${v}M`, 'Claims']}
                />
                <Area type="monotone" dataKey="amount" stroke="#F56B22" strokeWidth={2}
                  fill="url(#spendGrad)" dot={{ fill: '#F56B22', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: '#F56B22' }} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
              {first && <span style={{ fontSize: 11, color: '#9CA3B8' }}>{first.month} <strong style={{ color: '#131C4E' }}>₦{first.amount.toFixed(1)}M</strong></span>}
              {last && last !== first && <span style={{ fontSize: 11, color: '#9CA3B8' }}>{last.month} <strong style={{ color: '#131C4E' }}>₦{last.amount.toFixed(1)}M</strong></span>}
              {growthPct !== null && (
                <span style={{ fontSize: 11, fontWeight: 600, color: growthPct >= 0 ? '#EF4444' : '#10B981' }}>
                  {growthPct >= 0 ? '▲' : '▼'} {growthPct >= 0 ? '+' : ''}{growthPct}% growth
                </span>
              )}
            </div>
            </>
            )}
            </div>
            );
          })()}

          {vis.showTopConditions && <div style={{ ...card, padding: '26px 28px' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 4 }}>Top Conditions</p>
            <p style={{ fontSize: 12, color: '#9CA3B8', marginBottom: 24 }}>By claims spend · {stats?.policyYear ?? new Date().getFullYear()}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {(stats?.topConditions && stats.topConditions.length > 0 ? stats.topConditions : []).map((item, i, arr) => {
                const maxSpend = arr[0]?.amtPaid ?? arr[0]?.visits ?? 1;
                const itemSpend = item.amtPaid ?? item.visits;
                const barPct = (itemSpend / (maxSpend || 1)) * 100;
                const fmt = (v: number) => v >= 1_000_000 ? `₦${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `₦${(v / 1_000).toFixed(0)}K` : `₦${v}`;
                return (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#6B7480', fontWeight: 500, width: 140, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  <div style={{ flex: 1, height: 5, background: '#EDEEF2', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#F56B22,#FFB54B)' }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#9CA3B8', fontWeight: 500, width: 48, textAlign: 'right', flexShrink: 0 }}>{item.amtPaid != null ? fmt(item.amtPaid) : item.visits}</span>
                </div>
                );
              })}
              {(!stats?.topConditions || stats.topConditions.length === 0) && (
                <p style={{ fontSize: 12, color: '#9CA3B8', textAlign: 'center', padding: '12px 0' }}>Loading condition data...</p>
              )}
            </div>
          </div>}
        </div>
        )}

        {/* ── ROW 5: TOP PROVIDERS ── */}
        {vis.showTopProviders && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

          <div style={{ ...card, padding: '26px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>Top Provider Utilization</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>By amount paid · 2026</p>
              </div>
              <button onClick={() => setShowAllProviders(true)} style={{ fontSize: 12, fontWeight: 600, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View all →</button>
            </div>
            {(liveTopProviders ?? []).map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', padding: '11px 0', borderBottom: i < (liveTopProviders ?? []).length - 1 ? '1px solid #F5F6FA' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: PROVIDER_GRADS[i % PROVIDER_GRADS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0, marginRight: 12 }}>
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
            {(!liveTopProviders || liveTopProviders.length === 0) && (
              <p style={{ fontSize: 13, color: '#B0B7C9', textAlign: 'center', padding: '20px 0' }}>Loading provider data…</p>
            )}
          </div>
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
