import { useState, useEffect } from 'react'
import { getForYou } from '../services/api'
import { CategorySection } from './CategorySection'

function forYouHeadline(books) {
  if (!books || books.length === 0) return 'For you'
  if (books.length === 1) return `Because you searched “${books[0].title}”`
  const first = `“${books[0].title}”`
  const rest = books.length === 2
    ? `“${books[1].title}”`
    : `${books.length - 1} other searches`
  return `Because you searched ${first} and ${rest}`
}

export function ForYouSection({ onSelectBook }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getForYou()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data?.books?.length || !data?.categories?.length) return null

  return (
    <section className="for-you-section">
      <p className="for-you-headline">
        {forYouHeadline(data.books)}
      </p>
      <CategorySection categories={data.categories} loading={false} onSelect={onSelectBook} />
    </section>
  )
}
