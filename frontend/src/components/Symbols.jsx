// SVG silhouette library — all icons use stroke, no fill, for a feathery particle appearance

const ICON_PATHS = {
  dust: (
    <circle cx="12" cy="12" r="2.5" />
  ),
  book: (
    <path d="M4 4v16l8-4 8 4V4l-8 4-8-4zm8 4v12" />
  ),
  feather: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L3 14.67V21h6.33l10.06-10.06a5.5 5.5 0 0 0 0-7.78zM9 21H5v-4l7-7 4 4-7 7zm8.5-13.5L16 9l-4-4 1.5-1.5 4 4z" />
  ),
  quill: (
    <path d="M20 3C12 3 6 10 6 20l4-4c0 0 1-6 8-10L4 20M10 14l4-4" />
  ),
  'rose-petal': (
    <path d="M12 22C12 22 4 15 4 9a8 8 0 0 1 16 0c0 6-8 13-8 13z" />
  ),
  dagger: (
    <><path d="M12 2v18" /><path d="M8 8l4-6 4 6" /><path d="M9 16h6" /></>
  ),
  'crescent-moon': (
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  ),
  star: (
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  ),
  sparkle: (
    <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z" />
  ),
  planet: (
    <><circle cx="12" cy="12" r="5" /><ellipse cx="12" cy="12" rx="11" ry="4.5" /></>
  ),
  spacecraft: (
    <path d="M12 2l5 10H7l5-10zm-5 10l-3 7 3-2 5 4 5-4 3 2-3-7" />
  ),
  dragon: (
    <path d="M4 17l3-5 2 3 3-7 3 4 4-6-2 7 2 4-5-2-2 4-2-4-4 2-2-5 2 3-2 5z" />
  ),
  sword: (
    <><path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /></>
  ),
  'storm-cloud': (
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  ),
  'magnifying-glass': (
    <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></>
  ),
  eye: (
    <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
  ),
  'shadowy-figure': (
    <><circle cx="12" cy="5" r="3" /><path d="M9 9h6l1 6H8l1-6zM8 15l-1 6M16 15l1 6M10 21h4" /></>
  ),
  'bare-tree': (
    <><path d="M12 22V12" /><path d="M12 12l-4-5M12 12l4-5" /><path d="M8 7l-3-3M16 7l3-3" /><path d="M12 16l-3-2M12 16l3-2" /></>
  ),
  'ink-drop': (
    <path d="M12 2L7.5 10A6 6 0 1 0 16.5 10L12 2z" />
  ),
  'wax-seal': (
    <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 8v8M8 12h8" /></>
  ),
}

// Large atmospheric background silhouettes (rendered at very low opacity)
export const BG_SVGS = {
  cathedral: (
    <svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
      <path d="
        M0,300 L0,200 L60,160 L60,120 L80,80 L100,40 L120,80 L120,120 L160,80
        L160,120 L200,100 L220,60 L240,20 L260,60 L280,100 L280,120
        L320,80 L360,40 L400,10 L440,40 L480,80 L480,120
        L520,100 L540,60 L560,20 L580,60 L600,100 L600,120
        L640,80 L680,120 L680,80 L700,40 L720,80 L720,120
        L740,160 L800,200 L800,300 Z
      " fill="currentColor" />
    </svg>
  ),
  mountains: (
    <svg viewBox="0 0 800 250" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,250 L120,60 L200,140 L300,10 L420,160 L500,70 L640,180 L720,30 L800,120 L800,250 Z" fill="currentColor" />
    </svg>
  ),
  castle: (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
      <path d="
        M40,240 L40,140 L40,120 L60,120 L60,100 L80,100 L80,120 L100,120
        L100,80 L120,80 L120,60 L140,60 L140,80 L160,80 L160,120 L180,120
        L180,100 L200,100 L200,120 L220,120 L220,80 L240,80 L240,60 L260,60
        L260,80 L280,80 L280,120 L300,120 L300,100 L320,100 L320,120
        L340,120 L340,140 L360,140 L360,240
        M160,240 L160,180 L200,180 L200,240
        M220,240 L220,180 L260,180 L260,240
      " fill="currentColor" />
    </svg>
  ),
  galaxy: null, // rendered via special component with rotation
  grid: null,   // rendered via CSS
}

export function Symbol({ name, size = 24, color = 'currentColor' }) {
  const content = ICON_PATHS[name]
  if (!content) return null
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      {content}
    </svg>
  )
}
