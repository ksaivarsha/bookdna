import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { DEFAULT_THEME, THEMES } from '../themes/presets'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme]               = useState(DEFAULT_THEME)
  const [isTransitioning, setTransit]   = useState(false)
  const [overlayOpacity, setOverlay]    = useState(0)
  const timers = useRef([])

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const after = (ms, fn) => { const id = setTimeout(fn, ms); timers.current.push(id) }

  // Preset theme change (instant, no cinematic — used internally)
  const applyTheme = useCallback((idOrObject) => {
    const next = typeof idOrObject === 'string'
      ? (THEMES[idOrObject] ?? DEFAULT_THEME)
      : { ...DEFAULT_THEME, ...idOrObject }
    clearTimers()
    setTransit(true)
    after(next.transitionDuration, () => { setTheme(next); setTransit(false) })
  }, [])

  // Book-search AI theme: cinematic wardrobe-opening transition
  // Shape: { background, accent, secondaryAccent, particles[], symbols[],
  //          fontMood, atmosphereText, transitionDuration, bgGlow, ... }
  const applyBookTheme = useCallback((aiTheme) => {
    const next = { ...DEFAULT_THEME, ...aiTheme, transitionDuration: 800 }
    clearTimers()

    // 1. Fade to black (600ms CSS transition)
    setOverlay(1)

    // 2. Swap theme while screen is black
    after(700, () => setTheme(next))

    // 3. Fade from black
    after(1000, () => setOverlay(0))

    // 4. Mark complete
    after(1650, () => setTransit(false))
    setTransit(true)
  }, [])

  return (
    <ThemeContext.Provider value={{
      theme, applyTheme, applyBookTheme,
      isTransitioning, overlayOpacity,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
