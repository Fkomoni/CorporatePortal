'use client';

import {
  Users, Activity, AlertCircle, CreditCard,
  TrendingUp, UserPlus, UserMinus, Clock,
  CheckCircle2, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { TopBar } from '@/components/layout/TopBar';

const monthlySpend = [
  { month: 'Jan', amount: 6.2 }, { month: 'Feb', amount: 7.8 }, { month: 'Mar', amount: 6.9 },
  { month: 'Apr', amount: 8.4 }, { month: 'May', amount: 9.1 }, { month: 'Jun', amount: 9.8 },
];

const topCostDrivers = [
  { name: 'Hypertension', amount: 8.2 }, { name: 'Diabetes', amount: 7.4 },
  { name: 'Maternity',    amount: 6.8 }, { name: 'Dialysis',  amount: 5.9 },
  { name: 'Cancer Care',  amount: 4.2 },
];

const topProviders = [
  { name: 'Reddington Hospital',     location: 'Victoria Island', visits: 204, spend: '₦6.8M' },
  { name: 'Lagos Island General',    location: 'Lagos Island',    visits: 312, spend: '₦4.2M' },
  { name: 'St. Nicholas Hospital',   location: 'Lagos Island',    visits: 189, spend: '₦3.1M' },
  { name: 'National Hospital Abuja', location: 'Abuja',           visits: 156, spend: '₦2.9M' },
  { name: 'Apex Dental Clinic',      location: 'Ikeja',           visits: 89,  spend: '₦0.8M' },
];

const openRequests = [
  { id: 'TK-0041', title: 'New staff enrolment – Batch 12', category: 'Member Addition', status: 'Open',        date: 'Jun 20' },
  { id: 'TK-0039', title: 'Claims query – Mrs Adeyemi',     category: 'Claims Query',    status: 'In Progress', date: 'Jun 19' },
  { id: 'TK-0038', title: 'E-card reprint – Oluwaseun',    category: 'E-Card Request',  status: 'Awaiting',    date: 'Jun 17' },
  { id: 'TK-0037', title: 'Maternity benefit query',        category: 'Benefit Query',   status: 'Open',        date: 'Jun 15' },
];

const utilizationData = [
  { name: 'Utilized', value: 487,  color: '#F56B22' },
  { name: 'Unused',   value: 1355, color: '#F0F1F5' },
];

const statusColors: Record<string, string> = {
  'Open':        'bg-red-50 text-red-600',
  'In Progress': 'bg-amber-50 text-amber-700',
  'Awaiting':    'bg-blue-50 text-blue-600',
};

function Sparkline({ color }: { color: string }) {
  return (
    <svg width="60" height="22" viewBox="0 0 60 22">
      <polyline points="0,18 10,14 22,16 34,10 46,8 56,6 60,4"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const maxCost = Math.max(...topCostDrivers.map((d) => d.amount));

  return (
    <div className="flex flex-col min-h-full bg-[#FAFBFC]">
      <TopBar title="Overview" subtitle="Dangote Industries Ltd · ACM-2026 · Last updated today 09:14" showQuickActions />

      <div className="p-6 flex flex-col gap-5">

        {/* GREETING + HEALTH SCORE */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold text-[#131C4E] leading-tight tracking-tight">
              Good morning, Amaka ☀️
            </h1>
            <p className="text-[13px] text-[#9CA3B8] mt-1">Monday, 23 June 2026  ·  1,842 active lives</p>
          </div>
          <div className="flex items-center gap-5 bg-white rounded-2xl px-5 py-3.5 shadow-sm border border-[#F0F1F5]">
            <div>
              <p className="text-[10px] font-semibold text-[#9CA3B8] uppercase tracking-widest mb-1">Scheme Health Score</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[32px] font-black text-[#131C4E] leading-none tracking-tight">82</span>
                <span className="text-[16px] font-semibold text-[#9CA3B8]">/100</span>
              </div>
              <p className="text-[12px] font-semibold text-emerald-500 mt-1">● Healthy</p>
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
        <div className="grid grid-cols-5 gap-4">
          {([
            { label: 'Active Lives',     value: '1,842',  sub: '+24 this month',         subColor: '#10B981', icon: Users,       iconBg: '#EEF2FF', iconColor: '#3A4382', spark: '#3A4382' },
            { label: 'Utilization Rate', value: '26.4%',  sub: '487 members utilized',   subColor: '#3B82F6', icon: Activity,    iconBg: '#EFF6FF', iconColor: '#3B82F6', spark: '#3B82F6' },
            { label: 'Loss Ratio',       value: '77%',    sub: '▲ +6% vs last quarter', subColor: '#D97706', icon: TrendingUp,  iconBg: '#FFFBEB', iconColor: '#D97706', spark: '#D97706', valColor: '#D97706' },
            { label: 'Open Issues',      value: '4',      sub: 'Requires attention',      subColor: '#F56B22', icon: AlertCircle, iconBg: '#FFF1E6', iconColor: '#F56B22', spark: '#F56B22' },
            { label: 'Outstanding',      value: '₦10.5M', sub: 'Due in 7 days',          subColor: '#EF4444', icon: CreditCard,  iconBg: '#FEF2F2', iconColor: '#EF4444', spark: '#EF4444', valColor: '#EF4444', sm: true },
          ] as const).map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.iconBg }}>
                    <Icon className="w-4 h-4" style={{ color: k.iconColor }} strokeWidth={1.75} />
                  </div>
                  <Sparkline color={k.spark} />
                </div>
                <div className={`font-black tracking-tight leading-none mb-1 ${'sm' in k && k.sm ? 'text-[22px]' : 'text-[30px]'}`}
                  style={{ color: ('valColor' in k ? k.valColor : undefined) ?? '#131C4E' }}>
                  {k.value}
                </div>
                <div className="text-[11px] text-[#9CA3B8] font-medium mb-2">{k.label}</div>
                <div className="text-[11px] font-semibold" style={{ color: k.subColor }}>{k.sub}</div>
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
              { color: '#EF4444', bg: '#FEF9F9', iconBg: '#FEE2E2', Icon: UserPlus,     text: '12 Employees Awaiting Enrolment',   cta: 'Review' },
              { color: '#D97706', bg: '#FFFCF5', iconBg: '#FEF3C7', Icon: UserMinus,    text: '3 Terminations Pending Approval',   cta: 'Approve' },
              { color: '#D97706', bg: '#FFFCF5', iconBg: '#FEF3C7', Icon: CreditCard,   text: 'Invoice Due In 7 Days — ₦10.5M',   cta: 'View' },
              { color: '#10B981', bg: '#F6FDF9', iconBg: '#D1FAE5', Icon: CheckCircle2, text: 'No Benefit Escalations',           cta: 'All clear' },
              { color: '#EF4444', bg: '#FEF9F9', iconBg: '#FEE2E2', Icon: AlertCircle,  text: '2 High-Cost Claims Require Review', cta: 'Review' },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: item.bg, borderLeft: `3px solid ${item.color}` }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3" style={{ background: item.iconBg }}>
                  <item.Icon className="w-3.5 h-3.5" style={{ color: item.color }} strokeWidth={2} />
                </div>
                <p className="text-[12px] font-semibold text-[#131C4E] leading-snug mb-2">{item.text}</p>
                <button className="text-[11px] font-bold" style={{ color: item.color }}>{item.cta} →</button>
              </div>
            ))}
          </div>
        </div>

        {/* LOSS RATIO + MEMBERSHIP + UTILIZATION */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#F0F1F5]">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-[11px] font-semibold text-[#9CA3B8] uppercase tracking-widest">Loss Ratio</p>
                <p className="text-[11px] text-[#9CA3B8]">Policy Year 2026</p>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-[11px] font-bold text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Amber
              </span>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[72px] font-black text-amber-600 leading-none tracking-tighter">77</span>
              <span className="text-[32px] font-black text-amber-500">%</span>
            </div>
            <div className="flex gap-6 mb-4">
              <div><p className="text-[10px] text-[#9CA3B8] font-medium">Claims Paid</p><p className="text-[16px] font-bold text-[#131C4E]">₦48.2M</p></div>
              <div><p className="text-[10px] text-[#9CA3B8] font-medium">Premium</p><p className="text-[16px] font-bold text-[#131C4E]">₦62.5M</p></div>
            </div>
            <p className="text-[11px] font-semibold text-red-500 mb-3">▲ +6% from last quarter · Projected 84% by year-end</p>
            <div className="h-2 bg-[#F0F1F5] rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full" style={{ width: '77%', background: 'linear-gradient(90deg,#10B981 0%,#F59E0B 55%,#EF4444 85%)' }} />
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {[
                { name: 'Green',   range: '< 70%',  cls: 'text-emerald-600 bg-emerald-50' },
                { name: 'Amber ✓', range: '70–90%', cls: 'text-amber-700 bg-amber-50 border border-amber-200' },
                { name: 'Red',     range: '> 90%',  cls: 'text-red-500 bg-red-50' },
              ].map((l) => (
                <div key={l.name} className={`text-center py-2 rounded-lg text-[10px] font-bold ${l.cls}`}>
                  <p>{l.name}</p>
                  <p className="text-[9px] font-normal text-[#9CA3B8] mt-0.5">{l.range}</p>
                </div>
              ))}
            </div>
            <button className="text-[12px] font-semibold text-[#F56B22]">View Utilization Report →</button>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
            <p className="text-[11px] font-semibold text-[#9CA3B8] uppercase tracking-widest mb-1">Membership Movement</p>
            <p className="text-[11px] text-[#9CA3B8] mb-5">This month · June 2026</p>
            <div className="space-y-4">
              {[
                { label: 'New Additions',     value: '+24', color: '#10B981', bg: '#F0FDF4', Icon: UserPlus },
                { label: 'Terminations',      value: '−3',  color: '#EF4444', bg: '#FEF2F2', Icon: UserMinus },
                { label: 'Net Growth',        value: '+21', color: '#10B981', bg: '#F0FDF4', Icon: TrendingUp },
                { label: 'Pending Additions', value: '12',  color: '#D97706', bg: '#FFFBEB', Icon: Clock },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: row.bg }}>
                      <row.Icon className="w-3.5 h-3.5" style={{ color: row.color }} strokeWidth={2} />
                    </div>
                    <span className="text-[13px] text-[#3A4382] font-medium">{row.label}</span>
                  </div>
                  <span className="text-[18px] font-extrabold tracking-tight" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
            <p className="text-[11px] font-semibold text-[#9CA3B8] uppercase tracking-widest mb-1">Utilization Snapshot</p>
            <p className="text-[11px] text-[#9CA3B8] mb-3">Are employees using the scheme?</p>
            <div className="flex justify-center mb-3">
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie data={utilizationData} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
                    startAngle={90} endAngle={-270} paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {utilizationData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Eligible Members', value: '1,842', color: '#9CA3B8' },
                { label: 'Used Benefits',    value: '487',   color: '#F56B22' },
                { label: 'Utilization Rate', value: '26.4%', color: '#F56B22' },
                { label: 'Unused Members',   value: '1,355', color: '#9CA3B8' },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-[12px] text-[#6B7280]">{r.label}</span>
                  <span className="text-[13px] font-bold" style={{ color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CLAIMS TREND + COST DRIVERS */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[14px] font-bold text-[#131C4E]">Claims Spend Trend</h2>
                <p className="text-[11px] text-[#9CA3B8] mt-0.5">Monthly · Jan–Jun 2026</p>
              </div>
              <div className="flex gap-5 text-right">
                {[
                  { label: 'Total Paid YTD',  val: '₦48.2M' },
                  { label: 'Unique Visits',   val: '1,204' },
                  { label: 'Members Utilized',val: '487' },
                  { label: 'Avg Cost / Visit',val: '₦40,033' },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-[10px] text-[#9CA3B8] font-medium">{s.label}</p>
                    <p className="text-[16px] font-extrabold text-[#131C4E]">{s.val}</p>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={monthlySpend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F56B22" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#F56B22" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${v}M`} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`₦${v}M`, 'Claims']} />
                <Area type="monotone" dataKey="amount" stroke="#F56B22" strokeWidth={2} fill="url(#grad)"
                  dot={{ fill: '#F56B22', strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: '#F56B22' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
            <h2 className="text-[14px] font-bold text-[#131C4E] mb-1">Top Cost Drivers</h2>
            <p className="text-[11px] text-[#9CA3B8] mb-4">By claims spend · 2026</p>
            <div className="space-y-3.5">
              {topCostDrivers.map((item, i) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#9CA3B8] w-3.5">{i + 1}</span>
                      <span className="text-[12px] font-semibold text-[#131C4E]">{item.name}</span>
                    </div>
                    <span className="text-[12px] font-bold text-[#131C4E]">₦{item.amount}M</span>
                  </div>
                  <div className="h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(item.amount / maxCost) * 100}%`, background: i === 0 ? 'linear-gradient(90deg,#EF4444,#F87171)' : 'linear-gradient(90deg,#F56B22,#FFB54B)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PROVIDERS + REQUESTS */}
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-[14px] font-bold text-[#131C4E]">Top Provider Utilization</h2><p className="text-[11px] text-[#9CA3B8] mt-0.5">By spend &amp; visits · 2026</p></div>
              <button className="text-[12px] font-semibold text-[#F56B22]">View all →</button>
            </div>
            {topProviders.map((p, i) => (
              <div key={p.name} className="flex items-center py-2.5 border-b border-[#F7F8FA] last:border-0">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 mr-3"
                  style={{ background: i === 0 ? 'linear-gradient(135deg,#F56B22,#FFB54B)' : 'linear-gradient(135deg,#131C4E,#3A4382)' }}>
                  {p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#131C4E] truncate">{p.name}</p>
                  <p className="text-[11px] text-[#9CA3B8]">{p.location}</p>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-[13px] font-bold text-[#131C4E]">{p.spend}</p>
                  <p className="text-[11px] text-[#9CA3B8]">{p.visits} visits</p>
                </div>
              </div>
            ))}
          </div>

          <div className="col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-[14px] font-bold text-[#131C4E]">Open Requests</h2><p className="text-[11px] text-[#9CA3B8] mt-0.5">Awaiting action</p></div>
              <button className="text-[12px] font-semibold text-[#F56B22]">View all →</button>
            </div>
            {openRequests.map((r) => (
              <div key={r.id} className="flex items-start py-2.5 border-b border-[#F7F8FA] last:border-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 mr-3"
                  style={{ background: r.status === 'Open' ? '#EF4444' : r.status === 'In Progress' ? '#D97706' : '#3B82F6' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#131C4E] leading-snug">{r.title}</p>
                  <p className="text-[10px] text-[#9CA3B8] mt-0.5">{r.id} · {r.date} · {r.category}</p>
                </div>
                <span className={`ml-2 flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-md ${statusColors[r.status] ?? 'bg-gray-50 text-gray-500'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* HEALTH INSIGHTS */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#F56B22]" strokeWidth={2} />
            <h2 className="text-[14px] font-bold text-[#131C4E]">Health Insights</h2>
            <span className="text-[10px] font-semibold text-[#9CA3B8] bg-[#F7F8FA] border border-[#F0F1F5] px-2 py-0.5 rounded-full">AI-generated from claims data</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { text: '72% of spend is driven by just 15% of your members',          dot: '#F56B22' },
              { text: 'Hypertension claims increased 18% this quarter',               dot: '#EF4444' },
              { text: 'Victoria Island providers account for 41% of utilization',     dot: '#3B82F6' },
              { text: 'Loss ratio projected to reach 84% by year end if trend holds', dot: '#D97706' },
            ].map((ins, i) => (
              <div key={i} className="bg-[#FAFBFC] border border-[#F0F1F5] rounded-xl p-4">
                <div className="w-1.5 h-1.5 rounded-full mb-3" style={{ background: ins.dot }} />
                <p className="text-[12px] text-[#3A4382] leading-relaxed">{ins.text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
