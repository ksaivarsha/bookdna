const INK = '#2a1e08'

function CornerOrnament() {
  return (
    <svg viewBox="0 0 70 70" width="70" height="70" fill={INK}
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" opacity="0.8">
      {/* Horizontal arm */}
      <path d="M14,14 C26,12 42,11 58,13" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round"/>
      <path d="M56,13 C62,12 66,9 65,6 C64,3 60,4 61,8 C62,11 65,12 65,12" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Vertical arm */}
      <path d="M14,14 C12,26 11,42 13,58" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round"/>
      <path d="M13,56 C12,62 9,66 6,65 C3,64 4,60 8,61 C11,62 12,65 12,65" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Acanthus leaves on horizontal arm */}
      <path d="M32,12 C30,7 35,5 37,9 C39,13 36,17 32,12 Z"/>
      <path d="M48,11 C46,6 51,4 53,8 C55,12 52,16 48,11 Z"/>
      {/* Acanthus leaves on vertical arm */}
      <path d="M12,32 C7,30 5,35 9,37 C13,39 17,36 12,32 Z"/>
      <path d="M11,48 C6,46 4,51 8,53 C12,55 16,52 11,48 Z"/>
      {/* Central rosette */}
      <circle cx="14" cy="14" r="5" fill={INK}/>
      <circle cx="14" cy="14" r="3" fill="#e8d5a0"/>
      <circle cx="14" cy="14" r="1.5" fill={INK}/>
      {/* Corner flourish petals */}
      <path d="M14,9 C12,7 10,8 11,11 C12,13 14,13 14,9 Z"/>
      <path d="M19,14 C21,12 20,10 17,11 C15,12 15,14 19,14 Z"/>
      <path d="M14,19 C12,21 10,20 11,17 C12,15 14,15 14,19 Z"/>
      <path d="M9,14 C7,12 8,10 11,11 C13,12 13,14 9,14 Z"/>
      {/* Small berry clusters */}
      <circle cx="22" cy="11" r="1.5"/>
      <circle cx="25" cy="10" r="1.2"/>
      <circle cx="11" cy="22" r="1.5"/>
      <circle cx="10" cy="25" r="1.2"/>
    </svg>
  )
}

export function PageBorder() {
  return (
    <>
      <div className="border-outer" aria-hidden="true" />
      <div className="border-inner" aria-hidden="true" />
      <div className="corner-orn corner-orn--tl"><CornerOrnament /></div>
      <div className="corner-orn corner-orn--tr" style={{ transform: 'scaleX(-1)' }}><CornerOrnament /></div>
      <div className="corner-orn corner-orn--bl" style={{ transform: 'scaleY(-1)' }}><CornerOrnament /></div>
      <div className="corner-orn corner-orn--br" style={{ transform: 'scale(-1,-1)' }}><CornerOrnament /></div>
    </>
  )
}
