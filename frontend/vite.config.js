import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PostHog reverse proxy (dev only): the browser sends analytics to its own
// origin under /ingest and Vite forwards them, so nothing that blocks requests
// to *.posthog.com stops them. More specific prefixes must come first.
const posthogProxy = {
  '/ingest/static': {
    target: 'https://us-assets.i.posthog.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/ingest/, ''),
  },
  '/ingest/array': {
    target: 'https://us-assets.i.posthog.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/ingest/, ''),
  },
  '/ingest': {
    target: 'https://us.i.posthog.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/ingest/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: posthogProxy,
  },
})
