import { useCallback, useEffect, useRef, useState } from 'react'

function RecCard({ book, onSelect }) {
  return (
    <button type="button" className="rec-card" onClick={() => onSelect?.(book)}
      aria-label={`${book.title}, details`}>
      <div className="rec-card__cover-wrap">
        {book.cover ? (
          <img src={book.cover} alt="" className="rec-card__cover" />
        ) : (
          <div className="rec-card__no-cover">No cover</div>
        )}
      </div>
      <div className="rec-card__title">{book.title}</div>
      <div className="rec-card__author">{(book.authors || []).slice(0, 1).join('')}</div>
      {book.reason && <div className="rec-card__reason">{book.reason}</div>}
    </button>
  )
}

// A horizontally scrolling shelf with edge fades and ‹ › buttons that only
// appear when there is more to see in that direction.
function Shelf({ label, children }) {
  const ref = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 2)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    update()
    const el = ref.current
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [update, children])

  function scrollShelf(direction) {
    const el = ref.current
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const fade = `${canLeft ? ' category-books--fade-left' : ''}${canRight ? ' category-books--fade-right' : ''}`
  return (
    <div className="shelf">
      {canLeft && (
        <button type="button" className="shelf__arrow shelf__arrow--left"
          aria-label={`Scroll ${label} left`} onClick={() => scrollShelf(-1)}>‹</button>
      )}
      <div ref={ref} className={`category-books${fade}`} onScroll={update}>
        {children}
      </div>
      {canRight && (
        <button type="button" className="shelf__arrow shelf__arrow--right"
          aria-label={`Scroll ${label} right`} onClick={() => scrollShelf(1)}>›</button>
      )}
    </div>
  )
}

const PLACEHOLDER_BOOKS = 5

// An empty shelf of book outlines shown while that shelf is still being written
function PlaceholderShelf({ label }) {
  return (
    <div className="category-group category-group--pending" aria-hidden="true">
      <h3 className="category-label">{label}</h3>
      <div className="category-books">
        {Array.from({ length: PLACEHOLDER_BOOKS }, (_, i) => (
          <div key={i} className="placeholder-card" style={{ '--i': i }}>
            <div className="placeholder-card__cover" />
            <div className="placeholder-card__line" />
            <div className="placeholder-card__line placeholder-card__line--short" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Shelves of recommendations. While `loading`, every label in `expectedLabels`
 * that hasn't arrived yet is held open by a placeholder shelf, so each real
 * shelf drops into its own place as it arrives.
 */
export function CategorySection({ categories, loading, onSelect, expectedLabels = [] }) {
  const shelves = categories || []
  if (!loading && shelves.length === 0) return null

  const byLabel = new Map(shelves.map(cat => [cat.label, cat]))
  const order = loading
    ? [...expectedLabels, ...shelves.map(cat => cat.label).filter(l => !expectedLabels.includes(l))]
    : shelves.map(cat => cat.label)

  return (
    <div className="category-section" aria-busy={loading}>
      {loading && (
        <p className="search-hint category-section__status" role="status">
          <em>Consulting the deeper stacks…</em>
        </p>
      )}
      {order.map(label => {
        const cat = byLabel.get(label)
        if (!cat) return <PlaceholderShelf key={label} label={label} />
        return (
          <div key={label} className="category-group category-group--arrived">
            <h3 className="category-label">{label}</h3>
            <Shelf label={label}>
              {cat.books.map(book => (
                <RecCard key={book.id || book.title} book={book} onSelect={onSelect} />
              ))}
            </Shelf>
          </div>
        )
      })}
    </div>
  )
}
