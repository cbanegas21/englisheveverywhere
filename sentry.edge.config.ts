// Sentry edge-runtime init. The proxy/middleware (`src/proxy.ts`) runs in
// the Vercel Edge runtime and would otherwise be unobserved.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn && !dsn.endsWith('_placeholder')) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV || 'development',
  })
}
