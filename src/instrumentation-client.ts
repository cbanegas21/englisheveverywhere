// Sentry browser-side init. Next.js auto-loads `instrumentation-client.ts`
// (the convention that replaced `sentry.client.config.ts` in Sentry SDK v8+;
// the old file was never loaded, so client errors never reported — fixed here).
// Activates only when NEXT_PUBLIC_SENTRY_DSN is a real DSN — the empty/
// placeholder default keeps Sentry a no-op in dev so we don't spam the project.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn && !dsn.endsWith('_placeholder')) {
  Sentry.init({
    dsn,
    // Explicit Session Replay integration — in v8+ the sample rates below are
    // ignored unless the integration is registered. Its compression worker
    // loads from blob: (allowed by worker-src) and reports to the ingest host
    // (allowed by connect-src in next.config.ts).
    integrations: [Sentry.replayIntegration()],
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

// Instrument client-side App Router navigations for tracing (Sentry v8+).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
