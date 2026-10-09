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
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
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

        {!query && <ForYouSection onSelectBook={setSelectedBook} />}

        <SearchBar
          activeQuery={query}
          onSubmit={navigate}
          onHome={() => navigate('')}
          onSelectBook={setSelectedBook}
        />

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
