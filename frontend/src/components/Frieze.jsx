const INK = '#2a1e08'

export function Frieze() {
  return (
    <svg viewBox="0 0 600 36" width="100%" height="36"
      className="frieze-svg" aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      {/* Top and bottom rules */}
      <line x1="0" y1="2" x2="600" y2="2" stroke={INK} strokeWidth="0.8" opacity="0.6"/>
      <line x1="0" y1="34" x2="600" y2="34" stroke={INK} strokeWidth="0.8" opacity="0.6"/>
      {/* Repeating fleur-de-lis motifs every 40px */}
      {Array.from({length: 15}, (_, i) => (
        <g key={i} transform={`translate(${i * 40 + 20}, 18)`}>
          <path d="M0,-10 C-2,-7 -3,-4 -2,-1 C-4,-2 -7,-2 -8,0 C-7,2 -4,2 -2,1 C-3,4 -2,7 0,10 C2,7 3,4 2,1 C4,2 7,2 8,0 C7,-2 4,-2 2,-1 C3,-4 2,-7 0,-10 Z"
            fill={INK} opacity="0.75"/>
          <circle cx="0" cy="0" r="1.5" fill="#e8d5a0"/>
        </g>
      ))}
    </svg>
  )
}
