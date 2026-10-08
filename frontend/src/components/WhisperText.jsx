import { useState, useEffect } from 'react'

const PHRASES = [
  'Every book is a door left ajar…',
  'A thousand worlds on a single shelf…',
  'What story calls to you tonight?',
  'Step through the page…',
  'The library remembers everything…',
]

const SHOW_MS = 4800
const FADE_MS = 1400

export function WhisperText() {
  const [index,   setIndex]   = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const cycle = () => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % PHRASES.length)
        setVisible(true)
      }, FADE_MS + 150)
    }
    const id = setInterval(cycle, SHOW_MS + FADE_MS * 2 + 300)
    return () => clearInterval(id)
  }, [])

  return (
    <p className="whisper-text" style={{ opacity: visible ? 1 : 0 }}>
      {PHRASES[index]}
    </p>
  )
}
