// Enterprise backdrop for the sign-in panel.
//
// No photography and no illustration: five very-low-opacity layers that read as
// depth rather than decoration — a mesh gradient, an analytics grid, geometric
// waves, an abstract care-network of nodes, and a glass highlight. The mesh
// drifts slowly (see `bd-drift` in globals.css); everything else is static so
// the panel never competes with the copy on top of it.
//
// Opacities here are deliberately low. Raising them turns a premium backdrop
// into a busy one — an earlier attempt with visible tiled "windows" read as a
// repeating mesh and had to be pulled.

export function BrandBackdrop() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* 1 — Mesh gradient. Three offset radial pools, slowly drifting. */}
      <div
        className="bd-drift"
        style={{
          position: 'absolute', inset: '-12%',
          background: `
            radial-gradient(38% 44% at 78% 12%, rgba(232,119,34,0.16) 0%, rgba(232,119,34,0) 68%),
            radial-gradient(42% 38% at 12% 82%, rgba(66,86,150,0.20) 0%, rgba(66,86,150,0) 70%),
            radial-gradient(30% 30% at 88% 78%, rgba(232,119,34,0.08) 0%, rgba(232,119,34,0) 72%)
          `,
        }}
      />

      {/* 2 — Analytics grid. Fine 44px rule, faded out toward the lower left so
              it never sits behind the headline. */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.5,
        backgroundImage: `
          linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)
        `,
        backgroundSize: '44px 44px',
        maskImage: 'radial-gradient(120% 100% at 100% 0%, #000 25%, transparent 78%)',
        WebkitMaskImage: 'radial-gradient(120% 100% at 100% 0%, #000 25%, transparent 78%)',
      }} />

      <svg viewBox="0 0 600 900" preserveAspectRatio="xMidYMax slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="bd-wave" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#E87722" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#E87722" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#E87722" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bd-wave-2" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#5B7BC4" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#5B7BC4" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="bd-glass" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 3 — Geometric waves, bottom-anchored */}
        <path d="M0,900 C160,812 300,742 600,690 L600,900 Z" fill="url(#bd-wave)" />
        <path d="M0,900 C190,846 360,806 600,772 L600,900 Z" fill="url(#bd-wave-2)" />
        <path d="M0,832 C170,760 320,700 600,652" fill="none" stroke="#E87722" strokeOpacity="0.16" strokeWidth="1" />

        {/* 4 — Abstract care network: nodes joined by thin links */}
        <g stroke="#9FB4E8" strokeOpacity="0.16" strokeWidth="0.9" fill="none">
          <path d="M104,190 L196,142 L286,196 L372,150 L470,206" />
          <path d="M196,142 L214,246 L286,196" />
          <path d="M372,150 L392,252 L470,206" />
          <path d="M214,246 L330,300 L392,252" />
          <path d="M104,190 L128,286 L214,246" />
        </g>
        <g fill="#BFCEF4" fillOpacity="0.28">
          {[[104, 190], [196, 142], [286, 196], [372, 150], [470, 206], [214, 246], [392, 252], [330, 300], [128, 286]].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" />
          ))}
        </g>
        <g fill="#E87722" fillOpacity="0.5">
          <circle cx="286" cy="196" r="3.4" />
          <circle cx="330" cy="300" r="3.4" />
        </g>

        {/* 5 — Glass highlight, upper right */}
        <ellipse cx="500" cy="120" rx="230" ry="180" fill="url(#bd-glass)" />
      </svg>
    </div>
  );
}
