// The brand backdrop for navy surfaces: a dusk skyline with lit windows and a
// sculptural orange swoosh sweeping out of the lower-right corner.
//
// The reference design used a licensed photograph of a skyscraper at dusk. We
// don't hold that asset, so this draws the same composition — layered building
// masses, receding depth, warm window light, bold brand curve — as vector art.
// It scales to any panel size, costs about 3 KB instead of a 300 KB photo, and
// needs no licence. If a licensed photo is ever cleared, render it behind this
// and drop `showSkyline`.
//
// Composition rule: the skyline and swoosh are weighted to the RIGHT half so
// the left column (eyebrow, headline, body, footer) always sits over flat navy
// and stays legible. Don't rebalance them without re-checking that.

export function BrandBackdrop({ showSkyline = true }: { showSkyline?: boolean }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Warm dusk glow, upper right — the light source everything else implies */}
      <div style={{
        position: 'absolute', top: -180, right: -160, width: 520, height: 520, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,107,34,0.20) 0%, rgba(245,107,34,0.06) 45%, rgba(245,107,34,0) 72%)',
      }} />

      {showSkyline && (
        <svg viewBox="0 0 600 760" preserveAspectRatio="xMaxYMax slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            {/* Buildings fade toward the top so they read as receding into haze */}
            <linearGradient id="bb-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#243066" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#243066" stopOpacity="0.62" />
            </linearGradient>
            <linearGradient id="bb-mid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1A2352" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#1A2352" stopOpacity="0.88" />
            </linearGradient>
            <linearGradient id="bb-near" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D1436" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#0A1030" stopOpacity="0.96" />
            </linearGradient>
            {/* The brand curve */}
            <linearGradient id="bb-swoosh" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#F56B22" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#E8621A" stopOpacity="0.80" />
              <stop offset="100%" stopColor="#C84A05" stopOpacity="0.42" />
            </linearGradient>
            <linearGradient id="bb-swoosh-2" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFB54B" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#F56B22" stopOpacity="0" />
            </linearGradient>
            {/* Lit windows, tiled — cheaper and more even than hand-placing them */}
            <pattern id="bb-win-far" width="13" height="17" patternUnits="userSpaceOnUse">
              <rect width="5" height="7" fill="#8FA0D8" opacity="0.16" />
            </pattern>
            <pattern id="bb-win-mid" width="15" height="20" patternUnits="userSpaceOnUse">
              <rect width="6" height="8" fill="#B6C2EC" opacity="0.13" />
              <rect x="8" y="10" width="4" height="5" fill="#FFC98A" opacity="0.12" />
            </pattern>
            <pattern id="bb-win-near" width="19" height="25" patternUnits="userSpaceOnUse">
              <rect width="7" height="10" fill="#C7D1F2" opacity="0.10" />
              <rect x="10" y="13" width="6" height="7" fill="#FFB765" opacity="0.14" />
            </pattern>
            {/* Everything below is masked to the right side so the copy column
                on the left keeps a clean navy field. */}
            {/* White, not black: SVG masks are luminance-based, so black stops
                mask everything out no matter what their alpha is. */}
            <linearGradient id="bb-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="22%" stopColor="#fff" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="1" />
            </linearGradient>
            <mask id="bb-mask">
              <rect x="0" y="0" width="600" height="760" fill="url(#bb-fade)" />
            </mask>
          </defs>

          <g mask="url(#bb-mask)">
            {/* Far towers */}
            <g>
              <rect x="318" y="286" width="54" height="474" fill="url(#bb-far)" />
              <rect x="318" y="286" width="54" height="474" fill="url(#bb-win-far)" />
              <rect x="392" y="238" width="42" height="522" fill="url(#bb-far)" />
              <rect x="392" y="238" width="42" height="522" fill="url(#bb-win-far)" />
              <rect x="470" y="300" width="60" height="460" fill="url(#bb-far)" />
              <rect x="470" y="300" width="60" height="460" fill="url(#bb-win-far)" />
              <rect x="551" y="256" width="49" height="504" fill="url(#bb-far)" />
              <rect x="551" y="256" width="49" height="504" fill="url(#bb-win-far)" />
            </g>

            {/* Mid towers — the tallest mass, with a stepped crown */}
            <g>
              <rect x="352" y="196" width="70" height="564" fill="url(#bb-mid)" />
              <rect x="352" y="196" width="70" height="564" fill="url(#bb-win-mid)" />
              <rect x="366" y="170" width="42" height="30" fill="url(#bb-mid)" />
              <rect x="440" y="330" width="66" height="430" fill="url(#bb-mid)" />
              <rect x="440" y="330" width="66" height="430" fill="url(#bb-win-mid)" />
              <rect x="516" y="376" width="84" height="384" fill="url(#bb-mid)" />
              <rect x="516" y="376" width="84" height="384" fill="url(#bb-win-mid)" />
            </g>

            {/* Near tower — clipped by the panel edge, gives the low-angle feel */}
            <g>
              <rect x="286" y="404" width="76" height="356" fill="url(#bb-near)" />
              <rect x="286" y="404" width="76" height="356" fill="url(#bb-win-near)" />
              <rect x="418" y="452" width="92" height="308" fill="url(#bb-near)" />
              <rect x="418" y="452" width="92" height="308" fill="url(#bb-win-near)" />
              {/* Antenna on the tall mid tower */}
              <rect x="385" y="128" width="3" height="44" fill="#243066" opacity="0.7" />
            </g>
          </g>

          {/* Brand swoosh — a low arc hugging the bottom edge and rising to the
              right. Kept under the copy and the feature cards: it must not
              climb past roughly y=470, or it starts crossing them. */}
          <path d="M0,760 C210,744 410,672 600,470 L600,760 Z" fill="url(#bb-swoosh)" />
          <path d="M0,760 C230,752 450,700 600,548 L600,760 Z" fill="url(#bb-swoosh-2)" opacity="0.45" />
          {/* Thin highlight along the curve's leading edge */}
          <path d="M0,760 C210,744 410,672 600,470" fill="none" stroke="#FFC98A" strokeOpacity="0.30" strokeWidth="1.5" />
        </svg>
      )}
    </div>
  );
}
