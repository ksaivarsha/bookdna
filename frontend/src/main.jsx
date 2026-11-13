import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from '@posthog/react'
import App from './App.jsx'
import { initAnalytics } from './analytics'

const posthogClient = initAnalytics()

const app = <App />

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {posthogClient
      ? <PostHogProvider client={posthogClient}>{app}</PostHogProvider>
      : app}
  </StrictMode>,
)
