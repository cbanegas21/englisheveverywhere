// Next.js instrumentation hook — runs once per cold start, on both server
// runtimes. Defers Sentry init to the runtime-specific config files so the
// edge build doesn't pull in the Node SDK and vice versa.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs'
