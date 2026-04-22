// Sentry server-side init. Picks up errors thrown in server actions, route
// handlers (incl. /api/stripe/webhook), and React Server Components.
//
// Activates only when SENTRY_DSN is set. In dev we leave the DSN empty so
// local error logs stay in the terminal where we can read them.

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
