import { useState } from 'react'
import { searchBooks } from '../services/api'

const CARD_STYLE = {
  maxWidth: 120,
  textAlign: 'center',
  fontSize: '0.85rem',
  fontFamily: 'EB Garamond, serif',
  color: '#1a1208',
}

function BookCard({ book }) {
  return (
    <div style={CARD_STYLE}>
      {book.cover
        ? <img src={book.cover} alt={book.title}
            style={{ width: 80, height: 112, objectFit: 'cover', display: 'block', margin: '0 auto 6px' }} />
        : <div style={{ width: 80, height: 112, background: '#d9c99a', margin: '0 auto 6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', color: '#7a5c2a' }}>No cover</div>
      }
      <div style={{ fontWeight: 600, lineHeight: 1.2, marginBottom: 2 }}>{book.title}</div>
      <div style={{ opacity: 0.7 }}>{(book.authors || []).join(', ')}</div>
    </div>
  )
}

export function SearchBar() {
  const [query, setQuery]     = useState('')
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [results, setResults] = useState(null)

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const data = await searchBooks(query)
      setResults(data)
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
        <div style={{ width: '100%', fontFamily: 'EB Garamond, serif', color: '#1a1208' }}>
          <p style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: '1rem', fontSize: '0.95rem' }}>
            <em>{results.source.title}</em>
            {results.source.authors?.[0] && <> by {results.source.authors[0]}</>}
          </p>
          {results.recommendations.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16,
              justifyContent: 'center', marginTop: 8 }}>
              {results.recommendations.map(book => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
