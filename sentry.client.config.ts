// Sentry browser-side init. Loaded into every client bundle.
//
// Activates only when NEXT_PUBLIC_SENTRY_DSN is set to a real DSN —
// the empty/placeholder default makes Sentry a no-op in dev so we don't
// spam noise into the project before launch.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn && !dsn.endsWith('_placeholder')) {
  Sentry.init({
    dsn,
    // Sample 20% of perf traces to keep the free-tier quota healthy.
    tracesSampleRate: 0.2,
    // Capture 10% of normal sessions; 100% if a session sees an error.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Tag every event with the deploy SHA so we can correlate spikes to releases.
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
  })
}
