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

export function CategorySection({ categories, loading, onSelect }) {
  const shelves = categories || []
  if (!loading && shelves.length === 0) return null

  return (
    <div className="category-section">
      {shelves.map(cat => (
        <div key={cat.label} className="category-group">
          <h3 className="category-label">{cat.label}</h3>
          <Shelf label={cat.label}>
            {cat.books.map(book => (
              <RecCard key={book.id || book.title} book={book} onSelect={onSelect} />
            ))}
          </Shelf>
        </div>
      ))}
      {loading && (
        <p className="search-hint"><em>Consulting the deeper stacks…</em></p>
      )}
    </div>
  )
}
