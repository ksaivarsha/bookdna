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

export async function getWorkDescription(key, signal) {
  const response = await fetch(`${BASE_URL}/books/work?key=${encodeURIComponent(key)}`, { signal })
  if (!response.ok) throw new Error('Description unavailable')
  return (await response.json()).description || ''
}

export async function getRelated(book) {
  try {
    const response = await fetch(`${BASE_URL}/books/related`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(book),
    })
    if (!response.ok) return []
    return (await response.json()).recommendations || []
  } catch {
    return []
  }
}

/**
 * Stream the book's DNA and shelves. Calls onEvent for each
 * {type: 'profile' | 'shelf' | 'done'} event as it arrives.
 * Resolves when the stream ends; never rejects (a failure just ends the stream early).
 */
export async function streamRecommendations(book, onEvent, signal) {
  try {
    const response = await fetch(`${BASE_URL}/recommendations/by-category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(book),
      signal,
    })
    if (!response.ok || !response.body) return
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (line.trim()) onEvent(JSON.parse(line))
      }
    }
  } catch {
    // network error, abort, or bad JSON: whatever arrived so far stays on screen
  }
}

export async function getForYou() {
  const sessionId = getSessionId()
  const response = await fetch(`${BASE_URL}/history/${sessionId}/for-you`)
  if (!response.ok) return { book: null, categories: [], fallback: true }
  return response.json()
}
