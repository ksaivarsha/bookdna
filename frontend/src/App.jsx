import './index.css'
import './App.css'
import { ThemeProvider }        from './contexts/ThemeContext'
import { BackgroundLayer }      from './components/BackgroundLayer'
import { PageBorder }           from './components/PageBorder'
import { Frieze }               from './components/Frieze'
import { DividerOrnament }      from './components/DividerOrnament'
import { Logo }                 from './components/Logo'
import { SearchBar }            from './components/SearchBar'
import { CinematicTransition }  from './components/CinematicTransition'

function BookPage() {
  return (
    <div className="book-page">
      {/* Atmosphere mist layer */}
      <BackgroundLayer />

      {/* Ornate printed border (fixed, above content) */}
      <PageBorder />

      {/* Main page content */}
      <main className="page-content">
        {/* Top engraving frieze */}
        <Frieze />

        <DividerOrnament />

        {/* Title, tagline, whisper */}
        <Logo />

        <DividerOrnament />

        {/* Search */}
        <SearchBar />

        {/* Bottom tailpiece */}
        <DividerOrnament variant="tail" />
      </main>

      {/* Cinematic warp when AI book theme fires from backend */}
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
