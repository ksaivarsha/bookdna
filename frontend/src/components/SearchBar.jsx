import { useEffect, useRef, useState } from 'react'
import { searchBooks, addToHistory, getRelated, streamRecommendations } from '../services/api'
import { CategorySection } from './CategorySection'
import { FeaturedBook } from './FeaturedBook'

const SHELF_ORDER = ['Similar Storyline', 'Similar Tropes', 'Similar World/Setting', 'Same Vibe']
const byShelfOrder = (a, b) => SHELF_ORDER.indexOf(a.label) - SHELF_ORDER.indexOf(b.label)

function BookCard({ book, onSelect }) {
  return (
    <button type="button" className="book-card-small" onClick={() => onSelect?.(book)}
      aria-label={`${book.title}, details`}>
      {book.cover ? (
        <img src={book.cover} alt="" className="book-card-small__cover" />
      ) : (
        <div className="book-card-small__no-cover">No cover</div>
      )}
      <div className="book-card-small__title">{book.title}</div>
      <div className="book-card-small__author">{(book.authors || []).join(', ')}</div>
    </button>
  )
}

export function SearchBar({ activeQuery, onSubmit, onHome, onSelectBook }) {
  const [draft, setDraft]           = useState(activeQuery)
  const [focused, setFocused]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [results, setResults]       = useState(null)
  const [catLoading, setCatLoading] = useState(false)
  const [categories, setCategories] = useState(null)
  const [profile, setProfile]       = useState(null)
  const [genrePicks, setGenrePicks] = useState([])
  const streamRef = useRef(null)

  // The URL's ?q= drives the search: typing a search, the back button,
  // a shared link, and the logo (which clears it) all arrive here.
  useEffect(() => {
    setDraft(activeQuery)
    if (activeQuery) {
      runSearch(activeQuery)
    } else {
      streamRef.current?.abort()
      setLoading(false)
      setError('')
      setResults(null)
      setCategories(null)
      setProfile(null)
      setGenrePicks([])
      setCatLoading(false)
    }
    return () => streamRef.current?.abort()
  }, [activeQuery])

  async function runSearch(q) {
    streamRef.current?.abort()  // drop events from a previous search
    const controller = new AbortController()
    streamRef.current = controller

    setLoading(true)
    setError('')
    setResults(null)
    setCategories(null)
    setProfile(null)
    setGenrePicks([])
    setCatLoading(false)
    try {
      const data = await searchBooks(q)
      if (controller.signal.aborted) return
      setResults(data)
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
      if (!controller.signal.aborted) setError(err.message)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  function handleSubmit() {
    const q = draft.trim()
    if (!q) return
    if (q === activeQuery) runSearch(q)  // same URL: search again explicitly
    else onSubmit(q)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <section className="search-section">
      <div className={`search-bar ${focused ? 'search-bar--focused' : ''}`}>
        <input
          className="search-input"
          type="text"
          placeholder="Search by title, author, or genre…"
          aria-label="Search the library"
          autoComplete="off"
          spellCheck="false"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
        />
        <button className="search-btn" type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? '…' : 'Seek'}
        </button>
      </div>

      {activeQuery && (results || error) && !loading && (
        <a href="./" className="return-link" onClick={e => { e.preventDefault(); onHome() }}>
          ← Return to the library
        </a>
      )}

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
          <FeaturedBook book={results.source} profile={profile} profileLoading={catLoading} />

          {/* Phase 1: genre picks, shown until the first AI shelf arrives (and kept if none do) */}
          {!categories && genrePicks.length > 0 && (
            <div className="genre-recs">
              {genrePicks.map(book => (
                <BookCard key={book.id} book={book} onSelect={onSelectBook} />
              ))}
            </div>
          )}

          {/* Phase 2: categorized recs */}
          <CategorySection categories={categories} loading={catLoading} onSelect={onSelectBook} />
        </div>
      )}
    </section>
  )
}
