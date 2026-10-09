import { WhisperText } from './WhisperText'

export function Logo({ onHome }) {
  return (
    <header className="logo-section">
      {/* Main title — EB Garamond 600, embossed ink on parchment; links home */}
      <h1 className="logo-wordmark">
        <a
          href="./"
          className="logo-link"
          aria-label="BookDNA, return to the library"
          onClick={e => { e.preventDefault(); onHome?.() }}
        >
          BOOK<span className="logo-dna">DNA</span>
        </a>
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
