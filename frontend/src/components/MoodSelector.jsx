import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { MOOD_LIST } from '../themes/presets'

export function MoodSelector() {
  const { theme, applyTheme } = useTheme()
  const [active, setActive] = useState(null)

  function handleSelect(mood) {
    const next = active === mood.id ? null : mood.id
    setActive(next)
    applyTheme(next ?? 'default')
  }

  return (
    <nav className="mood-selector">
      <span
        className="mood-label"
        style={{ color: theme.textMuted, transition: `color ${theme.transitionDuration}ms` }}
      >
        Atmosphere
      </span>

      <div className="mood-track">
        {MOOD_LIST.map(mood => {
          const isActive = active === mood.id
          return (
            <button
              key={mood.id}
              className={`mood-btn ${isActive ? 'mood-btn--active' : ''}`}
              onClick={() => handleSelect(mood)}
              style={{
                '--mood-color': mood.color,
                borderColor: isActive ? mood.color : theme.borderColor,
                color: isActive ? mood.color : theme.textMuted,
                backgroundColor: isActive ? `${mood.color}18` : 'transparent',
                transition: `border-color ${theme.transitionDuration}ms, color 0.2s, background-color 0.2s`,
              }}
            >
              <span
                className="mood-gem"
                style={{
                  backgroundColor: mood.color,
                  boxShadow: isActive ? `0 0 8px ${mood.color}` : 'none',
                }}
              />
              {mood.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
