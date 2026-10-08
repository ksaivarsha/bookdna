import { useState } from 'react'
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

function BookPage() {
  const [searched, setSearched] = useState(false)

  return (
    <div className="book-page">
      <BackgroundLayer />
      <PageBorder />

      <main className="page-content">
        <Frieze />
        <DividerOrnament />
        <Logo />
        <DividerOrnament />

        {!searched && <ForYouSection />}

        <SearchBar onSearch={() => setSearched(true)} />

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
