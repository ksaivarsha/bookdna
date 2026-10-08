const BASE_URL = 'http://localhost:8000'

function getSessionId() {
  let id = localStorage.getItem('bookdna_session')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('bookdna_session', id)
  }
  return id
}

export async function searchBooks(query) {
  const response = await fetch(`${BASE_URL}/books/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Search failed')
  }
  return response.json()
}

export async function addToHistory(source) {
  const sessionId = getSessionId()
  fetch(`${BASE_URL}/history/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      book_id: source.id,
      book_title: source.title,
      book_authors: source.authors || [],
      book_cover: source.cover || '',
    }),
  }).catch(() => {})
}

export async function getRecommendationsByCategory(book) {
  const response = await fetch(`${BASE_URL}/recommendations/by-category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(book),
  })
  if (!response.ok) return { categories: [], fallback: true }
  return response.json()
}

export async function getForYou() {
  const sessionId = getSessionId()
  const response = await fetch(`${BASE_URL}/history/${sessionId}/for-you`)
  if (!response.ok) return { book: null, categories: [], fallback: true }
  return response.json()
}
