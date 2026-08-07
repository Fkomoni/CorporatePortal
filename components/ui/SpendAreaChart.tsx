'use client';

// The dashboard's claims-spend area chart, split into its own module so
// recharts can be code-split out of the dashboard's initial bundle. recharts
// is one of the heaviest dependencies in the app and the chart sits below the
// KPI row, so it does not need to block first paint: next/dynamic loads it
// after hydration (see the dashboard page).
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

/**
 * Axis ticks. `amount` is already in millions, so a value under 1 reads better
 * in thousands: "₦300K" rather than "₦0.3M". Keeping the label short also keeps
 * the reserved axis width small, which is what the plot area gets to keep.
 */
function fmtAxis(v: number): string {
  if (!v) return '₦0';
  if (v >= 1) return `₦${Number.isInteger(v) ? v : v.toFixed(1)}M`;
  return `₦${Math.round(v * 1000)}K`;
}

/** Tooltips have room for the real figure, so they show naira rather than a scale. */
function fmtTooltip(v: number): string {
  return `₦${Math.round(v * 1_000_000).toLocaleString('en-NG')}`;
}

export function SpendAreaChart({ data }: { data: { month: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={158}>
      {/* left must not be negative. It was -22, which pulled the Y axis outside
          the SVG and sliced the first character or two off every tick, so
          "₦0.9M" rendered as ").9M". The negative value only ever looked right
          while the ticks were bare numbers. */}
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F56B22" stopOpacity={0.14} />
            <stop offset="100%" stopColor="#F56B22" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fontSize: 10.5, fill: '#B0B7C9' }} axisLine={false} tickLine={false} />
        {/* Width has to hold the widest tick this formatter can produce
            ("₦1.2M" / "₦900K") at 10.5px, with a little air before the plot. */}
        <YAxis
          tick={{ fontSize: 10.5, fill: '#B0B7C9' }}
          axisLine={false} tickLine={false}
          tickFormatter={fmtAxis}
          width={48}
          tickMargin={4}
        />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #EDEEF2', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          formatter={(v) => [fmtTooltip(Number(v)), 'Claims paid']}
        />
        <Area type="monotone" dataKey="amount" stroke="#F56B22" strokeWidth={2}
          fill="url(#spendGrad)" dot={{ fill: '#F56B22', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: '#F56B22' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
