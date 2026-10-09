import { useState } from 'react'

const SHORT_DESCRIPTION = 320  // characters shown before "Read more"

export function BookDNA({ profile, loading }) {
  if (!profile) {
    return loading
      ? <p className="book-dna__pending"><em>Reading the book's DNA…</em></p>
      : null
  }
  const tropes = profile.tropes || []
  return (
    <div className="book-dna">
      {tropes.length > 0 && (
        <ul className="book-dna__tropes" aria-label="Tropes">
          {tropes.map(t => <li key={t} className="dna-chip">{t}</li>)}
        </ul>
      )}
      <div className="book-dna__meta">
        {profile.world_setting && (
          <span><span className="book-dna__label">Setting</span>{profile.world_setting}</span>
        )}
        {profile.world_setting && profile.tone && <span className="book-dna__sep" aria-hidden="true">❧</span>}
        {profile.tone && (
          <span><span className="book-dna__label">Tone</span>{profile.tone}</span>
        )}
      </div>
    </div>
  )
}

function shorten(text) {
  if (text.length <= SHORT_DESCRIPTION) return text
  const cut = text.slice(0, SHORT_DESCRIPTION)
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.;:\s]+$/, '') + '…'
}

export function Description({ text }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) {
    return <p className="featured-book__description featured-book__description--empty">
      <em>The archives hold no description of this volume.</em>
    </p>
  }
  const long = text.length > SHORT_DESCRIPTION
  return (
    <div className="featured-book__description">
      <p>{expanded || !long ? text : shorten(text)}</p>
      {long && (
        <button type="button" className="read-more" aria-expanded={expanded}
          onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

export function Cover({ src, title, className }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={`${className} cover-placeholder`} aria-hidden="true">
        <span className="cover-placeholder__title">{title}</span>
      </div>
    )
  }
  return <img src={src} alt={`Cover of ${title}`} className={className} onError={() => setFailed(true)} />
}

export function FeaturedBook({ book, profile, profileLoading }) {
  const authors = (book.authors || []).join(', ')
  return (
    <article className="featured-book" aria-label={`Searched book: ${book.title}`}>
      <Cover key={book.cover} src={book.cover} title={book.title} className="featured-book__cover" />
      <div className="featured-book__body">
        <h2 className="featured-book__title">{book.title}</h2>
        <p className="featured-book__byline">
          {authors && <>by {authors}</>}
          {authors && book.published && <span className="book-dna__sep" aria-hidden="true">·</span>}
          {book.published && <span>{book.published}</span>}
        </p>
        <Description key={book.id} text={book.description} />
        <BookDNA profile={profile} loading={profileLoading} />
      </div>
    </article>
  )
}
