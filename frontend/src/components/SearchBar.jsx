import { useRef, useState } from 'react'
import { searchBooks, addToHistory, getRelated, streamRecommendations } from '../services/api'
import { CategorySection } from './CategorySection'

const SHELF_ORDER = ['Similar Storyline', 'Similar Tropes', 'Similar World/Setting', 'Same Vibe']
const byShelfOrder = (a, b) => SHELF_ORDER.indexOf(a.label) - SHELF_ORDER.indexOf(b.label)

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

function BookDNA({ profile }) {
  if (!profile) return null
  const tropes = profile.tropes || []
  return (
    <div className="book-dna">
      {tropes.length > 0 && (
        <div className="book-dna__tropes">
          {tropes.map(t => <span key={t} className="dna-chip">{t}</span>)}
        </div>
      )}
      <div className="book-dna__meta">
        {profile.world_setting && (
          <span><span className="book-dna__label">Setting</span>{profile.world_setting}</span>
        )}
        {profile.world_setting && profile.tone && <span className="book-dna__sep">❧</span>}
        {profile.tone && (
          <span><span className="book-dna__label">Tone</span>{profile.tone}</span>
        )}
      </div>
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
  const [profile, setProfile]       = useState(null)
  const [genrePicks, setGenrePicks] = useState([])
  const streamRef = useRef(null)

  async function handleSearch() {
    if (!query.trim()) return
    streamRef.current?.abort()  // drop events from a previous search
    const controller = new AbortController()
    streamRef.current = controller

    setLoading(true)
    setError('')
    setResults(null)
    setCategories(null)
    setProfile(null)
    setGenrePicks([])
    try {
      const data = await searchBooks(query)
      setResults(data)
      onSearch?.()
      addToHistory(data.source)

      getRelated(data.source).then(picks => {
        if (!controller.signal.aborted) setGenrePicks(picks)
      })

      setCatLoading(true)
      streamRecommendations(data.source, event => {
        if (controller.signal.aborted) return
        if (event.type === 'profile') setProfile(event.profile)
        if (event.type === 'shelf') {
          setCategories(prev => [...(prev || []), event].sort(byShelfOrder))
        }
      }, controller.signal).finally(() => {
        if (!controller.signal.aborted) setCatLoading(false)
      })
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
        <p className="search-error">{error}</p>
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
          <BookDNA profile={profile} />

          {/* Phase 1: genre picks, shown until the first AI shelf arrives (and kept if none do) */}
          {!categories && genrePicks.length > 0 && (
            <div className="genre-recs">
              {genrePicks.map(book => (
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
