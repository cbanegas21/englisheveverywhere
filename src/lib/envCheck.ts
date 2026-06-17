// Production env fail-fast / loud-alert (P0-2). Many integrations silently no-op
// on a placeholder/empty key — Stripe → fake checkout success, LiveKit →
// window-less room, Resend → dropped emails — so a mistyped/rotated Vercel var
// degrades prod with NO signal (the team ships by git push + manual env, and CI
// builds green with all-placeholder env by design). This surfaces every such slip
// to Sentry once per server cold start. We alert rather than throw so a single
// non-money var (e.g. Resend) can't take the whole app down; the money/classroom
// PATHS additionally fail closed at point-of-use (stripe.ts / video.ts).
import * as Sentry from '@sentry/nextjs'

const CRITICAL = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'LIVEKIT_URL',
  'RESEND_API_KEY',
] as const

const isPlaceholder = (v?: string) => !v || v.endsWith('_placeholder')

export function assertProductionEnv() {
  if (process.env.VERCEL_ENV !== 'production') return
  const missing = CRITICAL.filter((k) => isPlaceholder(process.env[k]))
  if (missing.length) {
    const msg = `[envCheck] CRITICAL production secrets missing/placeholder: ${missing.join(', ')}`
    console.error(msg)
    try {
      Sentry.captureMessage(msg, 'fatal')
    } catch {
      /* Sentry not ready — the console.error above is the fallback signal */
    }
  }
}
