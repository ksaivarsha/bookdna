import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { Symbol } from './Symbols'

function seededRandom(seed) {
  // Deterministic random for stable particle layout per theme
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function generateParticles(theme) {
  const { count, speedRange, sizeRange } = theme.particleConfig
  const rand = seededRandom(theme.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
  const symbols = theme.symbols

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    symbol: symbols[i % symbols.length],
    x: rand() * 88 + 6,          // 6–94 vw
    y: rand() * 78 + 8,          // 8–86 vh
    size: rand() * (sizeRange[1] - sizeRange[0]) + sizeRange[0],
    opacity: rand() * 0.28 + 0.08,
    delay: -(rand() * 30),        // stagger start deep into animation cycle
    duration: rand() * (speedRange[1] - speedRange[0]) + speedRange[0],
    drift: (i % 5) + 1,          // picks CSS animation variant 1-5
  }))
}

function Particle({ symbol, x, y, size, opacity, delay, duration, drift, color }) {
  return (
    <div
      className={`particle particle--drift-${drift}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        '--p-op': opacity,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}ms`,
        color,
      }}
    >
      <Symbol name={symbol} size={size} color="currentColor" />
    </div>
  )
}

export function ParticleSystem() {
  const { theme } = useTheme()
  const [visible, setVisible] = useState(true)
  const [activeThemeId, setActiveThemeId] = useState(theme.id)

  // Fade out → swap → fade in on theme change
  useEffect(() => {
    if (theme.id === activeThemeId) return
    setVisible(false)
    const t = setTimeout(() => {
      setActiveThemeId(theme.id)
      setVisible(true)
    }, theme.transitionDuration * 0.55)
    return () => clearTimeout(t)
  }, [theme.id])

  const particles = useMemo(
    () => generateParticles(theme),
    [activeThemeId]
  )

  return (
    <div
      className="particle-layer"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${theme.transitionDuration * 0.4}ms ease`,
      }}
    >
      {particles.map(p => (
        <Particle key={p.id} {...p} color={theme.accent} />
      ))}
    </div>
  )
}
