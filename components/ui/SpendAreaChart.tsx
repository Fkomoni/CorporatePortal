'use client';

// The dashboard's claims-spend area chart, split into its own module so
// recharts can be code-split out of the dashboard's initial bundle. recharts
// is one of the heaviest dependencies in the app and the chart sits below the
// KPI row, so it does not need to block first paint — next/dynamic loads it
// after hydration (see the dashboard page).
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

export function SpendAreaChart({ data }: { data: { month: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={158}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F56B22" stopOpacity={0.14} />
            <stop offset="100%" stopColor="#F56B22" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fontSize: 10.5, fill: '#B0B7C9' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10.5, fill: '#B0B7C9' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${v}M`} width={52} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #EDEEF2', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          formatter={(v) => [`₦${v}M`, 'Claims']}
        />
        <Area type="monotone" dataKey="amount" stroke="#F56B22" strokeWidth={2}
          fill="url(#spendGrad)" dot={{ fill: '#F56B22', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: '#F56B22' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
