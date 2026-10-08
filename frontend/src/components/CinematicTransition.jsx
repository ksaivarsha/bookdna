import { useTheme } from '../contexts/ThemeContext'

// Full-screen fade-through-black when a book theme fires from the AI backend
export function CinematicTransition() {
  const { overlayOpacity } = useTheme()

  return (
    <div
      className="cinematic-overlay"
      aria-hidden="true"
      style={{ opacity: overlayOpacity }}
    />
  )
}
