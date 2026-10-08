import { WhisperText } from './WhisperText'

export function Logo() {
  return (
    <header className="logo-section">
      {/* Main title — EB Garamond 600, embossed ink on parchment */}
      <h1 className="logo-wordmark">
        BOOK<span className="logo-dna">DNA</span>
      </h1>

      {/* Hair-rule beneath the title */}
      <div className="logo-hairline" />

      {/* Tagline: small caps, wide-tracked */}
      <p className="logo-tagline">Your Literary Fingerprint</p>

      {/* Slowly cycling italic whisper */}
      <WhisperText />
    </header>
  )
}
