const BASE_URL = 'http://localhost:8000'

export async function searchBooks(query) {
  const response = await fetch(`${BASE_URL}/books/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Search failed')
  }
  return response.json()
}
