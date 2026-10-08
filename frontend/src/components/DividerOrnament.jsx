const INK = '#2a1e08'

function MainDivider() {
  return (
    <svg viewBox="0 0 300 16" width="300" height="16"
      className="divider-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="8" x2="118" y2="8" stroke={INK} strokeWidth="0.6" opacity="0.7"/>
      <line x1="0" y1="10" x2="112" y2="10" stroke={INK} strokeWidth="0.3" opacity="0.4"/>
      <path d="M125,8 C127,5 129,4 131,6 C133,4 135,5 137,8 C135,11 133,12 131,10 C129,12 127,11 125,8 Z" fill={INK} opacity="0.8"/>
      <circle cx="150" cy="8" r="3" fill={INK} opacity="0.8"/>
      <path d="M163,8 C165,5 167,4 169,6 C171,4 173,5 175,8 C173,11 171,12 169,10 C167,12 165,11 163,8 Z" fill={INK} opacity="0.8"/>
      <line x1="182" y1="8" x2="300" y2="8" stroke={INK} strokeWidth="0.6" opacity="0.7"/>
      <line x1="188" y1="10" x2="300" y2="10" stroke={INK} strokeWidth="0.3" opacity="0.4"/>
    </svg>
  )
}

function Tailpiece() {
  return (
    <svg viewBox="0 0 160 24" width="160" height="24"
      className="divider-svg tailpiece-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M80,2 L83,10 L80,22 L77,10 Z" fill={INK} opacity="0.8"/>
      <path d="M77,10 C65,9 45,11 25,9 C15,8 5,5 2,8 C5,11 15,10 25,11 C45,13 65,11 77,10 Z" fill={INK} opacity="0.7"/>
      <path d="M83,10 C95,9 115,11 135,9 C145,8 155,5 158,8 C155,11 145,10 135,11 C115,13 95,11 83,10 Z" fill={INK} opacity="0.7"/>
      <circle cx="12" cy="9" r="2" fill={INK} opacity="0.8"/>
      <circle cx="148" cy="9" r="2" fill={INK} opacity="0.8"/>
    </svg>
  )
}

export function DividerOrnament({ variant = 'main' }) {
  return (
    <div className="divider-ornament">
      {variant === 'tail' ? <Tailpiece /> : <MainDivider />}
    </div>
  )
}
