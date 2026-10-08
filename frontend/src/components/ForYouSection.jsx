import { useState, useEffect } from 'react'
import { getForYou } from '../services/api'
import { CategorySection } from './CategorySection'

export function ForYouSection() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getForYou()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data?.book || !data?.categories?.length) return null

  return (
    <section className="for-you-section">
      <p className="for-you-headline">
        Because you searched <em>{data.book.title}</em>
      </p>
      <CategorySection categories={data.categories} loading={false} />
    </section>
  )
}
