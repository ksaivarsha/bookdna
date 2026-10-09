import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getWorkDescription } from '../services/api'
import { Cover } from './FeaturedBook'

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function BookDetailPanel({ book, onClose, onSeek }) {
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  const [description, setDescription] = useState(null)  // null = loading
  const [failed, setFailed] = useState(false)

  // Fetch the description when the panel opens
  useEffect(() => {
    const controller = new AbortController()
    setDescription(null)
    setFailed(false)
    if (!book.id?.startsWith('/works/')) {
      setDescription('')
      return
    }
    getWorkDescription(book.id, controller.signal)
      .then(setDescription)
      .catch(() => {
        if (!controller.signal.aborted) { setFailed(true); setDescription('') }
      })
    return () => controller.abort()
  }, [book.id])

  // Focus the dialog, trap Tab inside it, close on Escape, restore focus on close
  useEffect(() => {
    const opener = document.activeElement
    closeRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Tab') {
        const items = [...panelRef.current.querySelectorAll(FOCUSABLE)]
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [onClose])

  const authors = (book.authors || []).join(', ')
  const olUrl = book.id ? `https://openlibrary.org${book.id}` : null

  // Portal to <body>: the page layers use transforms, which would otherwise
  // confine this fixed overlay to the page box instead of the viewport.
  return createPortal(
    <div
      className="detail-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <button ref={closeRef} type="button" className="detail-panel__close"
          aria-label="Close" onClick={onClose}>
          ×
        </button>

        <div className="detail-panel__head">
          <Cover key={book.cover} src={book.cover} title={book.title} className="detail-panel__cover" />
          <div>
            <h2 id="detail-title" className="detail-panel__title">{book.title}</h2>
            {authors && <p className="featured-book__byline">by {authors}</p>}
          </div>
        </div>

        {book.reason && (
          <section className="detail-panel__section">
            <h3 className="detail-panel__label">Why it was chosen</h3>
            <p className="detail-panel__reason">{book.reason}</p>
          </section>
        )}

        <section className="detail-panel__section">
          <h3 className="detail-panel__label">From the archives</h3>
          {description === null ? (
            <p className="book-dna__pending"><em>Fetching the description…</em></p>
          ) : description ? (
            <p className="detail-panel__description">{description}</p>
          ) : (
            <p className="book-dna__pending"><em>
              {failed
                ? 'The archives could not be reached just now.'
                : 'The archives hold no description of this volume.'}
            </em></p>
          )}
        </section>

        <div className="detail-panel__actions">
          <button type="button" className="search-btn detail-panel__seek"
            onClick={() => onSeek(book)}>
            Seek this book
          </button>
          {olUrl && (
            <a className="detail-panel__ol" href={olUrl} target="_blank" rel="noopener noreferrer">
              View on Open Library ↗
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
