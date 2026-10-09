function RecCard({ book }) {
  return (
    <div className="rec-card">
      <div className="rec-card__cover-wrap">
        {book.cover ? (
          <img src={book.cover} alt={book.title} className="rec-card__cover" />
        ) : (
          <div className="rec-card__no-cover">No cover</div>
        )}
      </div>
      <div className="rec-card__title">{book.title}</div>
      <div className="rec-card__author">{(book.authors || []).slice(0, 1).join('')}</div>
      {book.reason && <div className="rec-card__reason">{book.reason}</div>}
    </div>
  )
}

export function CategorySection({ categories, loading }) {
  const shelves = categories || []
  if (!loading && shelves.length === 0) return null

  return (
    <div className="category-section">
      {shelves.map(cat => (
        <div key={cat.label} className="category-group">
          <h3 className="category-label">{cat.label}</h3>
          <div className="category-books">
            {cat.books.map(book => (
              <RecCard key={book.id || book.title} book={book} />
            ))}
          </div>
        </div>
      ))}
      {loading && (
        <p className="search-hint"><em>Consulting the deeper stacks…</em></p>
      )}
    </div>
  )
}
