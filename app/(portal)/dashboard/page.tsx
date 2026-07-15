'use client';

import { TrendingDown, UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DashboardVis, DEFAULTS, getVis } from '@/lib/module-visibility';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TopBar } from '@/components/layout/TopBar';

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
  policyPeriod: string | null;
  policyYear: number | null;
  policyFromDate: string | null;
  policyToDate: string | null;
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
  const companyId: string = user?.companyId ?? '';
  const fullName: string = session?.user?.name ?? '';
  const firstName = fullName.split(' ')[0];
  const topBarSubtitle = [companyName, companyId].filter(Boolean).join(' · ');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [pendingEnrolmentCount, setPendingEnrolmentCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/hr/dashboard-stats')
      .then((r) => r.json())
      .then((d) => { if (d.stats) setStats(d.stats); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/hr/members/pending')
      .then((r) => r.json())
      .then((d) => { if (typeof d.totalBeneficiaries === 'number') setPendingEnrolmentCount(d.totalBeneficiaries); })
      .catch(() => {});
  }, []);

  // Policy period from GetAllPolicies, e.g. "1st April 2026 – 31st March 2027"
  const policyYearLabel = stats?.policyPeriod ?? null;

  const activeLives        = stats?.activeLives        ?? null;
  const principalLives     = stats?.principalLives     ?? null;
  const dependantLives     = stats?.dependantLives     ?? null;
  const newThisMonth       = stats?.newThisMonth       ?? null;
  const newThisMonthLabel  = stats?.newThisMonthLabel  ?? null;
  const totalPremium       = stats?.totalPremium       ?? null;
  const earnedPremium      = stats?.earnedPremium      ?? null;
  const claimsPaid         = stats?.claimsPaid         ?? null;
  const lossRatioPct       = stats?.lossRatioPct       ?? null;
  const cor                = stats?.cor                ?? null;
  const riskStatus         = stats?.riskStatus         ?? null;
  const utilizationRatePct = stats?.utilizationRatePct ?? null;
  const membersUtilized    = stats?.membersUtilized    ?? null;
  const liveTopProviders      = stats?.topProviders         ?? null;
  const liveMonthlySpend      = stats?.monthlySpend         ?? [];
  const liveAllProviders      = stats?.allProviders         ?? [];
  const schemeHealthScore     = stats?.schemeHealthScore    ?? null;
  const schemeHealthLabel     = stats?.schemeHealthLabel    ?? null;
  const schemeHealthTrendLabel = stats?.schemeHealthTrendLabel ?? null;

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Overview" subtitle={topBarSubtitle || undefined} showQuickActions />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── ROW 1: GREETING + HEALTH SCORE ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {getGreeting(firstName)}
            </h1>
            <p style={{ fontSize: 13, color: '#9CA3B8', marginTop: 6 }}>
              {[companyName, policyYearLabel ? `Policy year ${policyYearLabel}` : null].filter(Boolean).join('  ·  ') || 'Loading policy details…'}
            </p>
          </div>
          {schemeHealthScore !== null && (() => {
            const hsColor = schemeHealthLabel === 'Excellent' ? '#10B981'
              : schemeHealthLabel === 'Healthy' ? '#10B981'
              : schemeHealthLabel === 'Watchlist' ? '#D97706'
              : schemeHealthLabel === 'At Risk' ? '#F56B22'
              : '#EF4444';
            return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, ...card, padding: '14px 22px', flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Scheme Health Score</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: '#131C4E', letterSpacing: '-0.03em', lineHeight: 1 }}>{schemeHealthScore}</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#C4C9D9' }}>/100</span>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: hsColor, marginTop: 4 }}>● {schemeHealthLabel}</p>
              </div>
              <div style={{ width: 1, height: 44, background: '#EDEEF2' }} />
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Score Trend</p>
                <div style={{ width: 88, height: 5, background: '#EDEEF2', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${schemeHealthScore}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg,${hsColor === '#10B981' ? '#10B981,#34D399' : hsColor === '#D97706' ? '#F59E0B,#FCD34D' : '#F56B22,#FF8C4B'})` }} />
                </div>
                <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 5 }}>{schemeHealthTrendLabel ?? 'Building trend data…'}</p>
              </div>
            </div>
            );
          })()}
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
        {vis.showKpiCards && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {([
            {
              value: fmtLives(activeLives),
              label: 'Active Lives',
              sub: newThisMonth !== null && newThisMonth > 0
                ? `▲ ${newThisMonth} added in ${newThisMonthLabel ?? 'this month'}`
                : principalLives !== null && dependantLives !== null
                  ? `${principalLives.toLocaleString()} staff · ${dependantLives.toLocaleString()} dependants`
                  : '▲ Covered lives',
              subColor: '#10B981', rail: '#10B981',
            },
            {
              value: utilizationRatePct !== null ? `${utilizationRatePct}%` : '—',
              label: 'Utilization Rate',
              sub: membersUtilized !== null ? `${membersUtilized.toLocaleString()} members utilized` : '—',
              subColor: '#9CA3B8', rail: '#3B82F6',
            },
            {
              value: lossRatioPct !== null ? `${lossRatioPct}%` : '—',
              label: 'Loss Ratio',
              sub: riskStatus === 'Healthy' ? '⬤ Healthy' : riskStatus === 'Watchlist' ? '⬤ Watchlist' : riskStatus === 'High Risk' ? '⬤ High Risk' : riskStatus === 'Critical' ? '⬤ Critical' : '—',
              subColor: riskStatus === 'Healthy' ? '#10B981' : riskStatus === 'Watchlist' ? '#D97706' : riskStatus === 'High Risk' || riskStatus === 'Critical' ? '#EF4444' : '#9CA3B8',
              rail: riskStatus === 'Healthy' ? '#10B981' : riskStatus === 'Watchlist' ? '#D97706' : '#EF4444',
            },
            {
              value: totalPremium !== null ? fmtNaira(totalPremium) : '—',
              label: 'Annual Premium',
              sub: 'Total scheme premium',
              subColor: '#EF4444', rail: '#EF4444', sm: true,
            },
          ] as { value: string; label: string; sub: string; subColor: string; rail: string; sm?: boolean }[]).map((k) => (
            <div key={k.label} style={{ ...card, padding: '22px 22px 22px 20px', borderLeft: `3px solid ${k.rail}` }}>
              <p style={{ fontSize: 12, color: '#9CA3B8', fontWeight: 500, marginBottom: 12, letterSpacing: '0.01em' }}>{k.label}</p>
              <p style={{ fontSize: k.sm ? 28 : 36, fontWeight: 900, color: '#131C4E', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 12 }}>
                {(k.label.includes('Premium')) ? (vis.showAmounts ? k.value : '—') : k.value}
              </p>
              <p style={{ fontSize: 12, fontWeight: 500, color: k.subColor }}>{k.sub}</p>
            </div>
          ))}
        </div>
        )}

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
              <div style={{ display: 'flex', gap: 32 }}>
                {([
                  { label: 'Claims Paid',     value: fmtNaira(claimsPaid) },
                  { label: 'Earned Premium',  value: fmtNaira(earnedPremium ?? totalPremium) },
                ] as { label: string; value: string }[]).map((m) => (
                  <div key={m.label}>
                    <p style={{ fontSize: 11, color: '#9CA3B8', marginBottom: 3 }}>{m.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em' }}>{vis.showAmounts ? m.value : '—'}</p>
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
