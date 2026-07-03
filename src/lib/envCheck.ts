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
  // Powers the post-class AI summary + live vocabulary cuaderno (advertised on the
  // pricing page). Silently no-ops (generateSessionSummary/extractLiveVocab return
  // empty) if missing/placeholder, so alert — don't fail closed.
  'ANTHROPIC_API_KEY',
  // Live-vocab transcription — the other half of the cuaderno pair above.
  'DEEPGRAM_API_KEY',
  // CAPTCHA pair. Secret unset → verifyTurnstile no-ops = bot signups reopen
  // silently. Site key unset while the secret IS set → the widget never renders,
  // no token is minted, and the server rejects EVERY signup — a full signup
  // outage. Both drifts are invisible without this alert.
  'TURNSTILE_SECRET_KEY',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  // Bounce/complaint suppression webhook — unset means /api/resend/webhook 503s
  // until Resend pauses the endpoint and sender reputation loses its shield.
  'RESEND_WEBHOOK_SECRET',
  // GitHub-Actions crons (weekly payouts, payment reconcile) 503 without it.
  'CRON_SECRET',
  // The alerting channel itself — if the DSN drifts, every OTHER alert here
  // falls back to console-only.
  'NEXT_PUBLIC_SENTRY_DSN',
  // Google sign-in: GoogleButton renders NOTHING when unset, so an env drift
  // silently removes the only login method for Google-signup students (no
  // password) until they reset — with zero alert (deep-audit OPS-2).
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
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
