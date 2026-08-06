// The brand backdrop for the login panel: a dusk glow, an optional skyline,
// and the layered orange arc from the reference design.
//
// About the skyline: the reference uses a photograph of glass towers shot from
// below. We don't hold that asset. A vector stand-in was tried and dropped —
// tiled window patterns read as a repeating mesh rather than architecture, and
// seen through the translucent panel content they muddied the middle of the
// composition. It is kept behind `showSkyline` (off by default) rather than
// deleted, because it is the right hook for the real photo: drop an <img> in
// behind this component and leave showSkyline off.
//
// The arc is the part that carries the brand. Two constraints are load-bearing:
// it is anchored bottom-right so the copy column on the left always sits over
// flat navy, and the front arc must not start further left than about x=280 at
// the bottom edge or it climbs into the feature list.

export function BrandBackdrop({ showSkyline = false }: { showSkyline?: boolean }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Warm dusk glow, upper right — the light source the arc implies */}
      <div style={{
        position: 'absolute', top: -200, right: -170, width: 560, height: 560, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,107,34,0.18) 0%, rgba(245,107,34,0.05) 48%, rgba(245,107,34,0) 74%)',
      }} />

      {showSkyline && (
        <svg viewBox="0 0 600 760" preserveAspectRatio="xMaxYMax slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="bb-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#243066" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#243066" stopOpacity="0.62" />
            </linearGradient>
            <linearGradient id="bb-mid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1A2352" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#1A2352" stopOpacity="0.88" />
            </linearGradient>
            {/* White, not black: SVG masks are luminance-based, so black stops
                mask everything out regardless of their alpha. */}
            <linearGradient id="bb-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="30%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="60%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="1" />
            </linearGradient>
            <mask id="bb-mask">
              <rect x="0" y="0" width="600" height="760" fill="url(#bb-fade)" />
            </mask>
          </defs>
          <g mask="url(#bb-mask)">
            <rect x="318" y="286" width="54" height="474" fill="url(#bb-far)" />
            <rect x="392" y="238" width="42" height="522" fill="url(#bb-far)" />
            <rect x="470" y="300" width="60" height="460" fill="url(#bb-far)" />
            <rect x="551" y="256" width="49" height="504" fill="url(#bb-far)" />
            <rect x="352" y="196" width="70" height="564" fill="url(#bb-mid)" />
            <rect x="440" y="330" width="66" height="430" fill="url(#bb-mid)" />
            <rect x="516" y="376" width="84" height="384" fill="url(#bb-mid)" />
          </g>
        </svg>
      )}

      {/* The brand arc. Drawn in a 0-100 box with preserveAspectRatio="none" so
          the curve lands in the same proportional place at any panel size —
          with `slice` the control points flattened into a straight diagonal.
          The muted arc sits behind and above the bright one so the pair reads
          as a single banded curve. Keep both feet right of x=44: the footer
          text runs along the bottom-left. */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="bb-arc-back" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#8A4A2A" stopOpacity="0.46" />
            <stop offset="55%" stopColor="#5A3352" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#131C4E" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bb-arc-front" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF7F33" stopOpacity="1" />
            <stop offset="45%" stopColor="#F56B22" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#D2540C" stopOpacity="0.90" />
          </linearGradient>
        </defs>
        <path d="M44,100 C66,97 80,86 100,30 L100,100 Z" fill="url(#bb-arc-back)" />
        <path d="M57,100 C75,98 86,89 100,49 L100,100 Z" fill="url(#bb-arc-front)" />
      </svg>
    </div>
  );
}
