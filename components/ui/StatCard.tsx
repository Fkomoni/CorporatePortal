'use client';

// The stat card used across People, Finance and the dashboard: a tinted icon
// tile, the figure, a label and sub-label, and an optional sparkline.
//
// `trend` is optional on purpose. Several of these metrics have no history
// stored anywhere yet (member counts, for instance), and drawing an invented
// line next to a real figure would imply a trend nobody measured: so when
// there's no series the card simply renders without one.
import { ChevronRight } from 'lucide-react';

export interface StatCardProps {
  label: string;
  sub?: string;
  /** Colour for the sub line: used when it carries a delta or status tone. */
  subColor?: string;
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
  /** Action row pinned to the card's bottom edge, e.g. "View members →". */
  footer?: { label: string; onClick: () => void };
  loading?: boolean;
  onClick?: () => void;
}

// Decoration, so it is the thing that yields when the card is narrow: the
// wrapper may shrink to SPARK_MIN and the SVG scales with it. Four of these
// cards across a dashboard leaves roughly 285px each, and a fixed 90px line was
// taking a third of that from the label.
const SPARK_W = 64;
const SPARK_MIN = 40;

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
    <div style={{ flex: `0 1 ${SPARK_W}px`, minWidth: SPARK_MIN, maxWidth: SPARK_W, lineHeight: 0 }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        // The line squeezes horizontally rather than being cropped. Stroke width
        // is given in absolute units so it stays 2px however the box scales.
        preserveAspectRatio="none"
        style={{ width: '100%', height: h, overflow: 'visible' }}
        aria-hidden="true"
      >
        <path
          d={line} fill="none" stroke={color} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />
      </svg>
    </div>
  );
}

export function StatCard({
  label, sub, subColor, value, icon: Icon, color, tint, trend, trendColor, footer, loading, onClick,
}: StatCardProps) {
  const showTrend = !loading && Array.isArray(trend) && trend.length >= 2;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{
        background: '#fff', borderRadius: 16, border: '1px solid #DEE3ED',
        boxShadow: '0 1px 3px rgba(19,28,78,0.04)',
        display: 'flex', flexDirection: 'column',
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
      <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 auto' }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, background: tint, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: 21, height: 21, color }} strokeWidth={1.9} />
        </div>

        {/* The sparkline sits on the value's row rather than beside the whole
            block, so the label and sub get the column's full width.
            Previously all three shared it with a fixed 90px line, which left
            about 84px at four cards across and truncated the label to
            "Active Me..." and the delta to "▲ 10 this mo...". Measured: the
            longest label in the app, "Total Number of Staff", needs 131px and
            now has 164px. The value strings it does share with are short. */}
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', lineHeight: 1.1, minWidth: 0, overflowWrap: 'anywhere' }}>
              {loading ? '...' : value}
            </p>
            {showTrend && <Sparkline points={trend!} color={trendColor ?? color} />}
          </div>
          {/* These wrap rather than truncate. A card may be a line taller; a
              metric may not be unreadable. */}
          <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginTop: 6, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{label}</p>
          {sub && (
            <p style={{ fontSize: 11, color: subColor ?? '#9CA3B8', fontWeight: subColor ? 600 : 400, marginTop: 3, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
              {sub}
            </p>
          )}
        </div>

        {/* A card that filters the page on click has to look like it does. The
            footer link already says so where there is one, so this only appears
            on the cards without it, which are also the ones whose right side was
            empty for want of a trend series. */}
        {onClick && !footer && (
          <ChevronRight style={{ width: 18, height: 18, color: '#C4C9D9', flexShrink: 0 }} aria-hidden="true" />
        )}
      </div>

      {footer && (
        <button
          onClick={(e) => { e.stopPropagation(); footer.onClick(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '11px 22px', width: '100%', textAlign: 'left',
            fontSize: 12, fontWeight: 700, color: '#F56B22',
            background: 'none', border: 'none', borderTop: '1px solid #F0F1F5',
            cursor: 'pointer',
          }}
        >
          {footer.label} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
