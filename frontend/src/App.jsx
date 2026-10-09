import { useEffect, useState } from 'react'
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

  function navigate(q) {
    if (q === query) return
    const url = q ? `?q=${encodeURIComponent(q)}` : window.location.pathname
    window.history.pushState(null, '', url)
    setQuery(q)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="book-page">
      <BackgroundLayer />
      <PageBorder />

      <main className="page-content">
        <Frieze />
        <DividerOrnament />
        <Logo onHome={() => navigate('')} />
        <DividerOrnament />

        {!query && <ForYouSection />}

        <SearchBar activeQuery={query} onSubmit={navigate} onHome={() => navigate('')} />

        <DividerOrnament variant="tail" />
      </main>

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
