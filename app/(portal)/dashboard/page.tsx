'use client';

import {
  Users, Activity, AlertCircle, CreditCard,
  TrendingUp, UserPlus, UserMinus,
  CheckCircle2, TrendingDown,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
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
  { name: 'Malaria',            visits: 284 },
  { name: 'Hypertension',       visits: 198 },
  { name: 'URTI',               visits: 167 },
  { name: 'Pregnancy Related',  visits: 143 },
  { name: 'Diabetes',           visits: 89  },
];

const topProviders = [
  { name: 'Lagos Island General',    sub: 'General Practice · Lagos Island',        visits: 312, spend: '₦4.2M', grad: 'linear-gradient(135deg,#131C4E,#3A4382)' },
  { name: 'Reddington Hospital',     sub: 'Multi-specialty · Victoria Island',       visits: 204, spend: '₦6.8M', grad: 'linear-gradient(135deg,#F56B22,#FFB54B)' },
  { name: 'St. Nicholas Hospital',   sub: 'Paediatrics · Obs/Gynae · Lagos',         visits: 189, spend: '₦3.1M', grad: 'linear-gradient(135deg,#10B981,#059669)' },
  { name: 'National Hospital Abuja', sub: 'Multi-specialty · Abuja',                 visits: 156, spend: '₦2.9M', grad: 'linear-gradient(135deg,#8B5CF6,#6366F1)' },
  { name: 'Apex Dental Clinic',      sub: 'Dentistry · Ikeja',                       visits: 89,  spend: '₦0.8M', grad: 'linear-gradient(135deg,#3B82F6,#1D4ED8)' },
];

const openRequests = [
  { id: 'TK-0041', title: 'New staff enrolment – Batch 12',  sub: 'TK-0041 · Jun 20 · Member Addition', dot: '#EF4444', pill: 'Open',        pillCls: 'bg-red-50 text-red-600' },
  { id: 'TK-0039', title: 'Claims query – Mrs Adeyemi',       sub: 'TK-0039 · Jun 19 · Claims Query',    dot: '#D97706', pill: 'In Progress',  pillCls: 'bg-amber-50 text-amber-700' },
  { id: 'TK-0038', title: 'E-card reprint – Oluwaseun Bello', sub: 'TK-0038 · Jun 17 · E-Card Request',  dot: '#D97706', pill: 'Awaiting',     pillCls: 'bg-amber-50 text-amber-700' },
  { id: 'TK-0037', title: 'Maternity benefit query',           sub: 'TK-0037 · Jun 15 · Benefit Query',   dot: '#EF4444', pill: 'Open',         pillCls: 'bg-red-50 text-red-600' },
];

const insights = [
  { text: '72% of spend is driven by just 15% of your members',          dot: '#FFB54B' },
  { text: 'Hypertension claims increased 18% this quarter',               dot: '#EF4444' },
  { text: 'VI providers account for 41% of total utilization',            dot: '#10B981' },
  { text: 'Loss ratio projected to reach 84% by year end if trend holds', dot: '#EF4444' },
];

function Sparkline({ color, flat }: { color: string; flat?: boolean }) {
  const pts = flat
    ? '0,12 10,12 22,12 34,12 46,12 58,12 64,12'
    : '0,20 10,18 22,16 34,10 46,8 58,6 64,4';
  return (
    <svg width="64" height="24" viewBox="0 0 64 24">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={flat ? '4 2' : undefined} />
    </svg>
  );
}

const maxConditions = topConditions[0].visits;

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-full bg-[#FAFBFC]">
      <TopBar
        title="Overview"
        subtitle="Dangote Industries Ltd · ACM-2026 · Last updated today 09:14"
        showQuickActions
      />

      <div className="p-6 flex flex-col gap-4">

        {/* GREETING + HEALTH SCORE */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[24px] font-extrabold text-[#131C4E] leading-tight tracking-tight">
              Good morning, Amaka ☀️
            </h1>
            <p className="text-[13px] text-[#9CA3B8] mt-1">
              Dangote Industries Ltd &nbsp;·&nbsp; 1,842 active lives &nbsp;·&nbsp; Policy year Jan – Dec 2026
            </p>
          </div>
          <div className="flex items-center gap-6 bg-white rounded-2xl px-5 py-3.5 shadow-sm border border-[#F0F1F5]">
            <div>
              <p className="text-[10px] font-semibold text-[#9CA3B8] uppercase tracking-widest mb-1">Scheme Health Score</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-black text-[#131C4E] leading-none tracking-tight">82</span>
                <span className="text-[14px] font-semibold text-[#9CA3B8]">/100</span>
              </div>
              <p className="text-[11px] font-semibold text-emerald-500 mt-1">● Healthy</p>
            </div>
            <div className="w-px h-10 bg-[#F0F1F5]" />
            <div>
              <p className="text-[10px] font-semibold text-[#9CA3B8] uppercase tracking-widest mb-2">Score Trend</p>
              <div className="w-20 h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: '82%', background: 'linear-gradient(90deg,#F56B22,#FFB54B)' }} />
              </div>
              <p className="text-[11px] text-[#9CA3B8] mt-1.5">▲ +3 from last quarter</p>
            </div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-5 gap-3.5">
          {([
            { label: 'Active Lives',         value: '1,842',  icon: Users,       iconBg: '#FFF1E6', iconColor: '#F56B22', spark: '#F56B22',  trend: '▲ +24 this month',      trendCls: 'bg-emerald-50 text-emerald-700' },
            { label: 'Utilization Rate',     value: '26.4%',  icon: Activity,    iconBg: '#EEF2FF', iconColor: '#3A4382', spark: '#3A4382',  trend: '487 members utilized',   trendCls: 'bg-emerald-50 text-emerald-700' },
            { label: 'Loss Ratio',           value: '77%',    icon: TrendingUp,  iconBg: '#FFFBEB', iconColor: '#D97706', spark: '#D97706',  trend: '● Amber · ▲ +6% QoQ',  trendCls: 'bg-amber-50 text-amber-700',   valColor: '#D97706' },
            { label: 'Open Issues',          value: '4',      icon: AlertCircle, iconBg: '#FFF1E6', iconColor: '#F56B22', spark: '#F56B22',  trend: 'Requires attention',     trendCls: 'bg-orange-50 text-orange-600' },
            { label: 'Outstanding Premium',  value: '₦10.5M', icon: CreditCard,  iconBg: '#FEF2F2', iconColor: '#DC2626', spark: '#DC2626',  trend: 'Due in 7 days',          trendCls: 'bg-red-50 text-red-600',       valColor: '#DC2626', flat: true, sm: true },
          ] as const).map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.iconBg }}>
                    <Icon className="w-4 h-4" style={{ color: k.iconColor }} strokeWidth={1.75} />
                  </div>
                  <Sparkline color={k.spark} flat={'flat' in k && k.flat} />
                </div>
                <div
                  className={`font-black tracking-tight leading-none mb-1 ${'sm' in k && k.sm ? 'text-[20px]' : 'text-[28px]'}`}
                  style={{ color: ('valColor' in k ? k.valColor : undefined) ?? '#131C4E' }}
                >
                  {k.value}
                </div>
                <div className="text-[11px] text-[#9CA3B8] font-medium mb-2.5">{k.label}</div>
                <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold ${k.trendCls}`}>{k.trend}</span>
              </div>
            );
          })}
        </div>

        {/* ACTION CENTRE */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
          <div className="mb-4">
            <h2 className="text-[14px] font-bold text-[#131C4E]">Action Centre</h2>
            <p className="text-[11px] text-[#9CA3B8] mt-0.5">Items requiring your attention today</p>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[
              { cls: 'bg-[#FEF9F9]', border: '#EF4444', iconBg: '#FEE2E2', Icon: UserPlus,     iconColor: '#EF4444', text: '12 Employees Awaiting Enrolment',   cta: 'Review →',      ctaColor: '#EF4444' },
              { cls: 'bg-[#FFFCF5]', border: '#F59E0B', iconBg: '#FEF3C7', Icon: UserMinus,    iconColor: '#F59E0B', text: '3 Terminations Pending Approval',   cta: 'Approve →',    ctaColor: '#D97706' },
              { cls: 'bg-[#FFFCF5]', border: '#F59E0B', iconBg: '#FEF3C7', Icon: CreditCard,   iconColor: '#F59E0B', text: 'Invoice Due In 7 Days — ₦10.5M',   cta: 'View Invoice →', ctaColor: '#D97706' },
              { cls: 'bg-[#F6FDF9]', border: '#10B981', iconBg: '#D1FAE5', Icon: CheckCircle2, iconColor: '#10B981', text: 'No Benefit Escalations',           cta: 'All clear',     ctaColor: '#10B981' },
              { cls: 'bg-[#FEF9F9]', border: '#EF4444', iconBg: '#FEE2E2', Icon: AlertCircle,  iconColor: '#EF4444', text: '2 High-Cost Claims Require Review', cta: 'Review →',      ctaColor: '#EF4444' },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl p-4 ${item.cls}`} style={{ borderLeft: `3px solid ${item.border}` }}>
                <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center mb-3" style={{ background: item.iconBg }}>
                  <item.Icon className="w-3.5 h-3.5" style={{ color: item.iconColor }} strokeWidth={2} />
                </div>
                <p className="text-[12px] font-semibold text-[#131C4E] leading-snug mb-2">{item.text}</p>
                <button className="text-[11px] font-semibold" style={{ color: item.ctaColor }}>{item.cta}</button>
              </div>
            ))}
          </div>
        </div>

        {/* LOSS RATIO HERO + DARK INSIGHTS PANEL */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: '2fr 1fr' }}>

          {/* Loss Ratio */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#F0F1F5]">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[72px] font-black text-amber-600 leading-none tracking-tighter">77</span>
                  <span className="text-[30px] font-black text-amber-500">%</span>
                </div>
                <p className="text-[13px] text-[#9CA3B8] mt-1">Current Loss Ratio · Policy Year 2026</p>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-[12px] font-bold text-amber-700 flex-shrink-0">
                <span className="w-2 h-2 rounded-full bg-amber-500" />Amber Status
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              {[{ label: 'Claims Paid', value: '₦48.2M' }, { label: 'Premium', value: '₦62.5M' }].map((m) => (
                <div key={m.label}>
                  <p className="text-[11px] text-[#9CA3B8] font-medium mb-1">{m.label}</p>
                  <p className="text-[18px] font-extrabold text-[#131C4E] tracking-tight">{m.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-red-500 mb-4">
              <TrendingDown className="w-3.5 h-3.5" strokeWidth={2.5} />
              +6% from last quarter · Projected to reach 84% by year-end
            </div>
            <div className="h-2.5 bg-[#F0F1F5] rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full" style={{ width: '77%', background: 'linear-gradient(90deg,#10B981 0%,#F59E0B 55%,#EF4444 85%)' }} />
            </div>
            <div className="flex gap-2 mb-4">
              {[
                { label: 'Green',    range: '<70%',    cls: 'bg-emerald-50 text-emerald-700 border-transparent' },
                { label: '● Amber', range: '70–90%', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                { label: 'Red',      range: '>90%',    cls: 'bg-red-50 text-red-600 border-transparent' },
              ].map((l) => (
                <div key={l.label} className={`flex-1 text-center py-2 rounded-lg text-[10px] font-bold border ${l.cls}`}>
                  <p>{l.label}</p>
                  <p className="text-[9px] font-normal text-[#9CA3B8] mt-0.5">{l.range}</p>
                </div>
              ))}
            </div>
            <button className="text-[12px] font-semibold text-[#F56B22]">View Utilization Report →</button>
          </div>

          {/* Dark Health Insights */}
          <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#131C4E' }}>
            <p className="text-[13px] font-bold text-white mb-1">Health Insights</p>
            <p className="text-[11px] mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>AI-generated from your claims data</p>
            <div className="flex flex-col gap-2.5 flex-1">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: ins.dot }} />
                  <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CHARTS ROW: Spend Trend + Top Conditions */}
        <div className="grid grid-cols-2 gap-3.5">

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[14px] font-bold text-[#131C4E]">Claims Spend Trend</h2>
                <p className="text-[11px] text-[#9CA3B8] mt-0.5">Monthly · Jan–Jun 2026</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FFF1E6] text-[#F56B22]">₦48.2M YTD</span>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={monthlySpend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F56B22" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#F56B22" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${v}M`} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`₦${v}M`, 'Claims']}
                />
                <Area type="monotone" dataKey="amount" stroke="#F56B22" strokeWidth={2}
                  fill="url(#grad)" dot={{ fill: '#F56B22', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: '#F56B22' }} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-5 mt-2">
              <span className="text-[11px] text-[#9CA3B8]">Jan <strong className="text-[#131C4E]">₦6.2M</strong></span>
              <span className="text-[11px] text-[#9CA3B8]">Jun <strong className="text-[#131C4E]">₦9.8M</strong></span>
              <span className="text-[11px] font-semibold text-red-500">▲ +58% growth YTD</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
            <div className="mb-4">
              <h2 className="text-[14px] font-bold text-[#131C4E]">Top Conditions</h2>
              <p className="text-[11px] text-[#9CA3B8] mt-0.5">By number of visits · 2026</p>
            </div>
            <div className="flex flex-col gap-3.5">
              {topConditions.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-[12px] text-[#131C4E] font-medium w-[130px] flex-shrink-0 truncate">{item.name}</span>
                  <div className="flex-1 h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(item.visits / maxConditions) * 100}%`, background: 'linear-gradient(90deg,#F56B22,#FFB54B)' }}
                    />
                  </div>
                  <span className="text-[11px] text-[#9CA3B8] font-semibold w-8 text-right flex-shrink-0">{item.visits}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PROVIDERS + OPEN REQUESTS */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: '1.2fr 1fr' }}>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-[14px] font-bold text-[#131C4E]">Top Provider Utilization</h2>
                <p className="text-[11px] text-[#9CA3B8] mt-0.5">By visits &amp; spend · 2026</p>
              </div>
              <button className="text-[12px] font-semibold text-[#F56B22]">View all →</button>
            </div>
            {topProviders.map((p) => (
              <div key={p.name} className="flex items-center py-3 border-b border-[#F7F8FA] last:border-0">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 mr-3"
                  style={{ background: p.grad }}
                >
                  {p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#131C4E] truncate">{p.name}</p>
                  <p className="text-[11px] text-[#9CA3B8]">{p.sub}</p>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-[13px] font-bold text-[#131C4E]">{p.spend}</p>
                  <p className="text-[11px] text-[#9CA3B8]">{p.visits} visits</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-[14px] font-bold text-[#131C4E]">Open Requests</h2>
                <p className="text-[11px] text-[#9CA3B8] mt-0.5">Awaiting action</p>
              </div>
              <button className="text-[12px] font-semibold text-[#F56B22]">View all →</button>
            </div>
            {openRequests.map((r) => (
              <div key={r.id} className="flex items-start py-3 border-b border-[#F7F8FA] last:border-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 mr-3" style={{ background: r.dot }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#131C4E] leading-snug truncate">{r.title}</p>
                  <p className="text-[11px] text-[#9CA3B8] mt-0.5">{r.sub}</p>
                </div>
                <span className={`ml-2 flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${r.pillCls}`}>{r.pill}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
