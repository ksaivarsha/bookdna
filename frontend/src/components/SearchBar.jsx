import { useState } from 'react'
import { searchBooks, addToHistory, getRecommendationsByCategory } from '../services/api'
import { CategorySection } from './CategorySection'

function BookCard({ book }) {
  return (
    <div className="book-card-small">
      {book.cover ? (
        <img src={book.cover} alt={book.title} className="book-card-small__cover" />
      ) : (
        <div className="book-card-small__no-cover">No cover</div>
      )}
      <div className="book-card-small__title">{book.title}</div>
      <div className="book-card-small__author">{(book.authors || []).join(', ')}</div>
    </div>
  )
}

export function SearchBar({ onSearch }) {
  const [query, setQuery]           = useState('')
  const [focused, setFocused]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [results, setResults]       = useState(null)
  const [catLoading, setCatLoading] = useState(false)
  const [categories, setCategories] = useState(null)

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults(null)
    setCategories(null)
    try {
      const data = await searchBooks(query)
      setResults(data)
      onSearch?.()
      addToHistory(data.source)
      setCatLoading(true)
      getRecommendationsByCategory(data.source)
        .then(rec => {
          if (!rec.fallback && rec.categories?.length) setCategories(rec.categories)
        })
        .catch(() => {})
        .finally(() => setCatLoading(false))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <section className="search-section">
      <div className={`search-bar ${focused ? 'search-bar--focused' : ''}`}>
        <input
          className="search-input"
          type="text"
          placeholder="Search by title, author, or genre…"
          autoComplete="off"
          spellCheck="false"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
        />
        <button className="search-btn" type="button" onClick={handleSearch} disabled={loading}>
          {loading ? '…' : 'Seek'}
        </button>
      </div>

      {loading && (
        <p className="search-hint"><em>Consulting the library…</em></p>
      )}
      {error && !loading && (
        <p className="search-hint" style={{ color: '#8b2020' }}>{error}</p>
      )}
      {!loading && !error && !results && (
        <p className="search-hint">
          Enter a title, an author, or a feeling —{' '}
          <em>the library will find you a door.</em>
        </p>
      )}

      {results && !loading && (
        <div className="search-results">
          <p className="search-results__source">
            <em>{results.source.title}</em>
            {results.source.authors?.[0] && <> by {results.source.authors[0]}</>}
          </p>

          {/* Phase 1: genre fallback recs (always shown until category recs replace them) */}
          {!categories && results.recommendations.length > 0 && (
            <div className="genre-recs">
              {results.recommendations.map(book => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}

          {/* Phase 2: categorized recs */}
          <CategorySection categories={categories} loading={catLoading} />
        </div>
      )}
    </section>
  )
}
