'use client';

// The stat card used across People, Finance and the dashboard: a tinted icon
// tile, the figure, a label and sub-label, and an optional sparkline.
//
// `trend` is optional on purpose. Several of these metrics have no history
// stored anywhere yet (member counts, for instance), and drawing an invented
// line next to a real figure would imply a trend nobody measured — so when
// there's no series the card simply renders without one.
export interface StatCardProps {
  label: string;
  sub?: string;
  /** Pre-formatted so callers control currency, thousands separators and dashes. */
  value: string;
  icon: React.ElementType;
  /** Icon colour and its tile background. */
  color: string;
  tint: string;
  /** Oldest → newest. At least 2 points are needed to draw anything. */
  trend?: number[] | null;
  /** Sparkline colour; defaults to the icon colour. */
  trendColor?: string;
  loading?: boolean;
  onClick?: () => void;
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 90;
  const h = 34;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = pad + i * step;
    // Invert: SVG y grows downward.
    const y = pad + (h - pad * 2) * (1 - (p - min) / span);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0, overflow: 'visible' }} aria-hidden="true">
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />
    </svg>
  );
}

export function StatCard({
  label, sub, value, icon: Icon, color, tint, trend, trendColor, loading, onClick,
}: StatCardProps) {
  const showTrend = !loading && Array.isArray(trend) && trend.length >= 2;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{
        background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2',
        boxShadow: '0 1px 3px rgba(19,28,78,0.04)',
        padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16,
        cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={onClick ? (e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(19,28,78,0.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(19,28,78,0.04)';
        e.currentTarget.style.transform = 'none';
      } : undefined}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 13, background: tint, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon style={{ width: 21, height: 21, color }} strokeWidth={1.9} />
      </div>

      <div style={{ flex: '1 1 0%', minWidth: 0 }}>
        <p style={{ fontSize: 26, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {loading ? '…' : value}
        </p>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginTop: 5 }} className="truncate">{label}</p>
        {sub && <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }} className="truncate">{sub}</p>}
      </div>

      {showTrend && <Sparkline points={trend!} color={trendColor ?? color} />}
    </div>
  );
}
