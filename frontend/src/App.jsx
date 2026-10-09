import { useCallback, useEffect, useRef, useState } from 'react'
import './index.css'
import './App.css'
import { ThemeProvider }        from './contexts/ThemeContext'
import { BackgroundLayer }      from './components/BackgroundLayer'
import { PageBorder }           from './components/PageBorder'
import { Frieze }               from './components/Frieze'
import { DividerOrnament }      from './components/DividerOrnament'
import { Logo }                 from './components/Logo'
import { SearchBar }            from './components/SearchBar'
import { ForYouSection }        from './components/ForYouSection'
import { CinematicTransition }  from './components/CinematicTransition'
import { BookDetailPanel }      from './components/BookDetailPanel'

function readQuery() {
  return (new URLSearchParams(window.location.search).get('q') || '').trim()
}

function BookPage() {
  const [query, setQuery] = useState(readQuery)

  // Back/forward buttons restore whichever search (or homepage) was in the URL
  useEffect(() => {
    const onPop = () => setQuery(readQuery())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const scrollRef = useRef(null)

  // Every change of page (a new search, the logo, Return, back/forward) starts
  // at the top of the page's scroll container, so the search bar is in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [query])

  const [selectedBook, setSelectedBook] = useState(null)
  const closePanel = useCallback(() => setSelectedBook(null), [])

  function seekBook(book) {
    setSelectedBook(null)
    navigate([book.title, book.authors?.[0]].filter(Boolean).join(' '))
  }

  function navigate(q) {
    if (q === query) return
    const url = q ? `?q=${encodeURIComponent(q)}` : window.location.pathname
    window.history.pushState(null, '', url)
    setQuery(q)
  }

  return (
    <div className="book-page">
      <BackgroundLayer />
      <PageBorder />

      <div className="page-scroll" ref={scrollRef}>
      <main className="page-content">
        <Frieze />
        <DividerOrnament />
        <Logo onHome={() => navigate('')} />
        <DividerOrnament />

        {/* Always rendered, and first after the logo so it is in view on the homepage */}
        <SearchBar
          activeQuery={query}
          onSubmit={navigate}
          onHome={() => navigate('')}
          onSelectBook={setSelectedBook}
        />

        {!query && <ForYouSection onSelectBook={setSelectedBook} />}

        <DividerOrnament variant="tail" />
      </main>
      </div>

      {selectedBook && (
        <BookDetailPanel book={selectedBook} onClose={closePanel} onSeek={seekBook} />
      )}

      <CinematicTransition />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BookPage />
    </ThemeProvider>
  )
}
