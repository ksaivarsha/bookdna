import { useCallback } from 'react'
import posthog from 'posthog-js'
import { usePostHog } from '@posthog/react'

/**
 * Anonymous product analytics (PostHog). Only the funnel below is tracked:
 * no autocapture, no session recording, no identify, and no search text —
 * query strings are scrubbed from every URL before an event leaves the browser.
 */

const TOKEN = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN
const HOST  = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

export const analyticsEnabled = Boolean(TOKEN)

export const EVENTS = {
  searchSubmitted:  'search_submitted',
  firstShelfShown:  'first_shelf_shown',
  bookDetailOpened: 'book_detail_opened',
  seekClicked:      'seek_clicked',
}

/** The book's Open Library work key (e.g. "/works/OL123W"), or null. */
export function workId(book) {
  const id = book?.id
  return typeof id === 'string' && id.startsWith('/works/') ? id : null
}

// "https://host/path?q=dune#x" -> "https://host/path"
function stripQuery(value) {
  if (typeof value !== 'string') return value
  return value.replace(/[?#].*$/, '')
}

function scrubUrls(props) {
  if (!props) return
  for (const key of Object.keys(props)) {
    if (/url|referrer/i.test(key)) props[key] = stripQuery(props[key])
  }
}

function scrubEvent(event) {
  if (!event) return event
  scrubUrls(event.properties)
  scrubUrls(event.$set)
  scrubUrls(event.$set_once)
  return event
}

export function initAnalytics() {
  if (!analyticsEnabled) return null
  posthog.init(TOKEN, {
    api_host: HOST,
    defaults: '2026-08-30',           // pageviews on history change (SPA navigation)
    person_profiles: 'identified_only', // we never identify, so everything stays anonymous
    autocapture: false,
    disable_session_recording: true,
    before_send: scrubEvent,
  })
  return posthog
}

/** Returns track(event, props); a no-op when no PostHog token is configured. */
export function useTrack() {
  const client = usePostHog()
  return useCallback((event, props) => {
    if (analyticsEnabled) client?.capture(event, props)
  }, [client])
}
