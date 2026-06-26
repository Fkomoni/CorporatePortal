'use client';

import { TrendingDown, UserPlus, Receipt } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardVis, DEFAULTS, getVis } from '@/lib/module-visibility';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TopBar } from '@/components/layout/TopBar';

const monthlySpend = [
  { month: 'Jan', amount: 6.2 },
  { month: 'Feb', amount: 7.8 },
  { month: 'Mar', amount: 6.9 },
  { month: 'Apr', amount: 8.4 },
  { month: 'May', amount: 9.1 },
  { month: 'Jun', amount: 9.8 },
];

const topConditions = [
  { name: 'Malaria',           visits: 284 },
  { name: 'Hypertension',      visits: 198 },
  { name: 'URTI',              visits: 167 },
  { name: 'Pregnancy Related', visits: 143 },
  { name: 'Diabetes',          visits: 89  },
];

const topProviders = [
  { name: 'Lagos Island General',    sub: 'General Practice · Lagos Island',  visits: 312, spend: '₦4.2M', grad: 'linear-gradient(135deg,#131C4E,#3A4382)' },
  { name: 'Reddington Hospital',     sub: 'Multi-specialty · Victoria Island', visits: 204, spend: '₦6.8M', grad: 'linear-gradient(135deg,#F56B22,#FFB54B)' },
  { name: 'St. Nicholas Hospital',   sub: 'Paediatrics · Obs/Gynae · Lagos',  visits: 189, spend: '₦3.1M', grad: 'linear-gradient(135deg,#10B981,#059669)' },
  { name: 'National Hospital Abuja', sub: 'Multi-specialty · Abuja',           visits: 156, spend: '₦2.9M', grad: 'linear-gradient(135deg,#8B5CF6,#6366F1)' },
  { name: 'Apex Dental Clinic',      sub: 'Dentistry · Ikeja',                 visits: 89,  spend: '₦0.8M', grad: 'linear-gradient(135deg,#3B82F6,#1D4ED8)' },
];

const openRequests = [
  { id: 'TK-0041', title: 'New staff enrolment – Batch 12',  sub: 'TK-0041 · Jun 20 · Member Addition', dot: '#EF4444', pill: 'Open',        pillBg: '#FEF2F2', pillColor: '#DC2626' },
  { id: 'TK-0039', title: 'Claims query – Mrs Adeyemi',       sub: 'TK-0039 · Jun 19 · Claims Query',   dot: '#D97706', pill: 'In Progress',  pillBg: '#FFFBEB', pillColor: '#D97706' },
  { id: 'TK-0038', title: 'E-card reprint – Oluwaseun Bello', sub: 'TK-0038 · Jun 17 · E-Card Request', dot: '#C4C9D9', pill: 'Awaiting',     pillBg: '#F5F6FA', pillColor: '#6B7280' },
  { id: 'TK-0037', title: 'Maternity benefit query',           sub: 'TK-0037 · Jun 15 · Benefit Query',  dot: '#EF4444', pill: 'Open',         pillBg: '#FEF2F2', pillColor: '#DC2626' },
];

const insights = [
  { dot: '#F59E0B', text: '72% of spend is driven by just 15% of your members. Consider targeted wellness interventions for high-utilizers.' },
  { dot: '#EF4444', text: 'Hypertension claims increased 18% this quarter. Screening programmes could reduce long-term costs significantly.' },
  { dot: '#10B981', text: 'VI providers account for 41% of total utilization despite covering only 22% of enrolled staff.' },
  { dot: '#EF4444', text: 'At current trajectory, loss ratio is projected to reach 84% by year-end. Renewal pricing may need review.' },
];

const maxConditions = topConditions[0].visits;

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

export default function DashboardPage() {
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
              {companyName ? `${companyName}  ·  Policy year Jan – Dec 2026` : 'Policy year Jan – Dec 2026'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, ...card, padding: '14px 22px', flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Scheme Health Score</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: '#131C4E', letterSpacing: '-0.03em', lineHeight: 1 }}>82</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#C4C9D9' }}>/100</span>
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#10B981', marginTop: 4 }}>● Healthy</p>
            </div>
            <div style={{ width: 1, height: 44, background: '#EDEEF2' }} />
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Score Trend</p>
              <div style={{ width: 88, height: 5, background: '#EDEEF2', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: '82%', height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#F56B22,#FFB54B)' }} />
              </div>
              <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 5 }}>▲ +3 from last quarter</p>
            </div>
          </div>
        </div>

        {/* ── ACTION CENTRE ── */}
        {vis.showActionCentre && (
        <div style={{ ...card, padding: '28px 32px' }}>
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Action Centre</p>
            <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 3 }}>Items requiring your attention today</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            {[
              { Icon: UserPlus,  border: '#EF4444', urgency: 'Urgent',   title: '12 Employees Awaiting Enrolment', action: 'Review →',       actionColor: '#EF4444' },
              { Icon: Receipt,   border: '#10B981', urgency: 'Due soon', title: 'Invoice Due In 7 Days — ₦10.5M',  action: 'View Invoice →', actionColor: '#10B981' },
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
                  <button style={{ fontSize: 13, fontWeight: 600, color: item.actionColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
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
          {[
            { value: '1,842',  label: 'Active Lives',        sub: '▲ 24 added this month', subColor: '#10B981', rail: '#10B981' },
            { value: '26.4%',  label: 'Utilization Rate',   sub: '487 members utilized',   subColor: '#9CA3B8', rail: '#3B82F6' },
            { value: '77%',    label: 'Loss Ratio',         sub: '⬤ Amber · +6% QoQ',     subColor: '#D97706', rail: '#D97706' },
            { value: '₦10.5M', label: 'Outstanding Premium',sub: 'Due in 7 days',          subColor: '#EF4444', rail: '#EF4444', sm: true },
          ].map((k) => (
            <div key={k.label} style={{ ...card, padding: '22px 22px 22px 20px', borderLeft: `3px solid ${k.rail}` }}>
              <p style={{ fontSize: 12, color: '#9CA3B8', fontWeight: 500, marginBottom: 12, letterSpacing: '0.01em' }}>{k.label}</p>
              <p style={{ fontSize: k.sm ? 28 : 36, fontWeight: 900, color: '#131C4E', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 12 }}>{k.label === 'Outstanding Premium' ? (vis.showAmounts ? k.value : '—') : k.value}</p>
              <p style={{ fontSize: 12, fontWeight: 500, color: k.subColor }}>{k.sub}</p>
            </div>
          ))}
        </div>
        )}

        {/* ── ROW 3: LOSS RATIO (large, full-width) ── */}
        {vis.showLossRatio && (
        <div style={{ ...card, padding: '32px 36px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <p style={{ fontSize: 12, color: '#9CA3B8', fontWeight: 500, marginBottom: 8 }}>Current Loss Ratio · Policy Year 2026</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: 88, fontWeight: 900, color: '#D97706', letterSpacing: '-0.05em', lineHeight: 1 }}>77</span>
                <span style={{ fontSize: 42, fontWeight: 900, color: '#D97706' }}>%</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#D97706' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#D97706', display: 'inline-block' }} />
                Amber Status
              </span>
              <div style={{ display: 'flex', gap: 32 }}>
                {[{ label: 'Claims Paid', value: '₦48.2M' }, { label: 'Premium', value: '₦62.5M' }].map((m) => (
                  <div key={m.label}>
                    <p style={{ fontSize: 11, color: '#9CA3B8', marginBottom: 3 }}>{m.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em' }}>{vis.showAmounts ? m.value : '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ height: 8, background: '#EDEEF2', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: '77%', height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#10B981 0%,#F59E0B 55%,#EF4444 85%)' }} />
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
              +6% from last quarter · Projected to reach 84% by year-end
            </div>
          </div>
        </div>
        )}

        {/* ── ROW 4: CHARTS ── */}
        {(vis.showSpendChart || vis.showTopConditions) && (
        <div style={{ display: 'grid', gridTemplateColumns: vis.showSpendChart && vis.showTopConditions ? '3fr 2fr' : '1fr', gap: 16 }}>

          {vis.showSpendChart && <div style={{ ...card, padding: '26px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>Claims Spend Trend</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>Monthly · Jan–Jun 2026</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F56B22' }}>{vis.showAmounts ? '₦48.2M' : '—'} YTD</span>
            </div>
            <ResponsiveContainer width="100%" height={148}>
              <AreaChart data={monthlySpend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
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
              <span style={{ fontSize: 11, color: '#9CA3B8' }}>Jan <strong style={{ color: '#131C4E' }}>₦6.2M</strong></span>
              <span style={{ fontSize: 11, color: '#9CA3B8' }}>Jun <strong style={{ color: '#131C4E' }}>₦9.8M</strong></span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#EF4444' }}>▲ +58% growth YTD</span>
            </div>
          </div>}

          {vis.showTopConditions && <div style={{ ...card, padding: '26px 28px' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 4 }}>Top Conditions</p>
            <p style={{ fontSize: 12, color: '#9CA3B8', marginBottom: 24 }}>By number of visits · 2026</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {topConditions.map((item) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#6B7480', fontWeight: 500, width: 126, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  <div style={{ flex: 1, height: 5, background: '#EDEEF2', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${(item.visits / maxConditions) * 100}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#F56B22,#FFB54B)' }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#9CA3B8', fontWeight: 500, width: 30, textAlign: 'right', flexShrink: 0 }}>{item.visits}</span>
                </div>
              ))}
            </div>
          </div>}
        </div>
        )}

        {/* ── ROW 5: PROVIDERS + OPEN REQUESTS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: vis.showTopProviders ? '1.2fr 1fr' : '1fr', gap: 16 }}>

          {vis.showTopProviders && <div style={{ ...card, padding: '26px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>Top Provider Utilization</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>By visits &amp; spend · 2026</p>
              </div>
              <button style={{ fontSize: 12, fontWeight: 600, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View all →</button>
            </div>
            {topProviders.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', padding: '11px 0', borderBottom: i < topProviders.length - 1 ? '1px solid #F5F6FA' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: p.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0, marginRight: 12 }}>
                  {p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>{p.sub}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>{p.spend}</p>
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>{p.visits} visits</p>
                </div>
              </div>
            ))}
          </div>}

          <div style={{ ...card, padding: '26px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>Open Requests</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>4 awaiting action</p>
              </div>
              <button style={{ fontSize: 12, fontWeight: 600, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View all →</button>
            </div>
            {openRequests.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', padding: '11px 0', borderBottom: i < openRequests.length - 1 ? '1px solid #F5F6FA' : 'none' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.dot, flexShrink: 0, marginRight: 12, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>{r.sub}</p>
                </div>
                <span style={{ flexShrink: 0, marginLeft: 10, display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: r.pillBg, color: r.pillColor }}>
                  {r.pill}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── ROW 6: HEALTH INSIGHTS (full width, light) ── */}
        {vis.showHealthInsights && (
        <div style={{ ...card, padding: '28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>Health Insights</p>
              <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>AI-generated from your claims data · Updated today</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#F56B22', background: '#FFF1E6', padding: '4px 10px', borderRadius: 6 }}>
              4 insights
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ padding: '18px 20px', background: '#F7F8FC', border: '1px solid #EDEEF2', borderRadius: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ins.dot, marginBottom: 12 }} />
                <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.65, fontWeight: 400 }}>{ins.text}</p>
              </div>
            ))}
          </div>
        </div>
        )}

      </div>
    </div>
  );
}
