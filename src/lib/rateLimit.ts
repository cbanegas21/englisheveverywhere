// Application-level rate limiter for /login and /registro. Supabase Auth has
// its own (generous, project-wide) limits, but those don't stop per-IP
// credential-stuffing. We track attempts in a Supabase table via the admin
// client so the limiter works across the multi-instance serverless runtime
// (in-memory counters wouldn't survive cold starts or hop instances).
//
// Window: 15 minutes. Thresholds are tuned for early-stage usage — we can
// tighten them in one place here if abuse shows up in the `auth_attempts`
// table.

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

type Action = 'login' | 'signup' | 'reset'

const WINDOW_MS = 15 * 60 * 1000
const LIMIT: Record<Action, number> = {
  // Login: 10 per 15 min. Enough headroom for a genuine user fat-fingering
  // their password; low enough that credential-stuffing exhausts quickly.
  login: 10,
  // Signup: 5 per 15 min per IP. Legit traffic is one signup per person; a
  // higher ceiling here only helps bot farms.
  signup: 5,
  // Password reset: 3 per 15 min per IP — stops inbox-spam / email-quota drain.
  reset: 3,
}

// Per-EMAIL failed-login lockout, independent of the per-IP cap. A distributed
// credential-stuffing run rotates IPs to dodge the per-IP limit but still hammers
// ONE account — counting failed logins per email across all IPs catches that.
// 8 failed logins for a single account in 15 min is an attack, not a typo; a
// SUCCESSFUL login records success=true and never counts toward this.
const EMAIL_FAIL_LIMIT = 8

// Resolve the real client IP. On Vercel, `x-vercel-forwarded-for` and
// `x-real-ip` are injected by the edge and cannot be set by the client (incoming
// copies are stripped), so they're trustworthy. A client-supplied
// `x-forwarded-for` is attacker-controlled — its leftmost hop is spoofable — so
// it's used only as a last resort off-platform (local dev = single hop).
function getClientIp(h: Headers): string {
  return (
    h.get('x-vercel-forwarded-for') ||
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  )
}

// Normalize the email key for the limiter. Supabase Auth stores emails
// lowercased, so lowercasing here keeps recordLoginOutcome inserts and the
// per-email lockout query on the same key.
function normalizeEmail(email?: string): string | null {
  const e = email?.trim().toLowerCase()
  return e ? e : null
}

export async function checkAuthRateLimit(
  action: Action,
  email?: string,
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const h = await headers()
  const ip = getClientIp(h)
  const normalizedEmail = normalizeEmail(email)

  const admin = createAdminClient()
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const retryAfterSeconds = Math.ceil(WINDOW_MS / 1000)

  // Per-IP throttle (all actions): every recorded attempt for this ip+action.
  // Fail open on a query error (log it) — a DB blip must not lock out real users.
  const { count: ipCount, error: ipErr } = await admin
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('action', action)
    .gte('attempted_at', since)

  if (ipErr) console.error('[rateLimit] ip-count query failed (failing open)', ipErr)

  if ((ipCount ?? 0) >= LIMIT[action]) {
    return { ok: false, retryAfterSeconds }
  }

  // Per-email lockout (login only): failed logins for this account across IPs.
  // Fail open on error (log it) for the same reason as the per-IP query.
  if (action === 'login' && normalizedEmail) {
    const { count: failCount, error: failErr } = await admin
      .from('auth_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login')
      .eq('email', normalizedEmail)
      .eq('success', false)
      .gte('attempted_at', since)

    if (failErr) console.error('[rateLimit] email-lockout query failed (failing open)', failErr)

    if ((failCount ?? 0) >= EMAIL_FAIL_LIMIT) {
      return { ok: false, retryAfterSeconds }
    }
  }

  // Login records its row AFTER the credential check (recordLoginOutcome) so the
  // per-email lockout can count only genuine failures. Signup/reset have no
  // later success/failure signal worth distinguishing, so record the attempt
  // now (attempt-based per-IP throttle, unchanged). Fire-and-forget: a write
  // miss only makes the limiter under-count, never blocks a legit action.
  if (action !== 'login') {
    await admin
      .from('auth_attempts')
      .insert({ ip, action, email: normalizedEmail, success: true })
      .then(
        () => undefined,
        (err: unknown) => console.error('[rateLimit] insert failed', err),
      )
  }

  return { ok: true }
}

// Per-USER throttle for authenticated student mutations (DASH-07). Reuses the
// auth_attempts table (no new table): rows are keyed by the user id in the
// `email` column + a distinct `action` string, so they never collide with the
// login lockout query (which filters action='login'). Attempt-based — each call
// records a row and is blocked once `limit` rows exist in the window. Fails OPEN
// on a DB error so a blip never blocks a real user.
export async function checkUserActionLimit(
  userId: string,
  action: string,
  limit: number,
  windowMinutes = 15,
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const h = await headers()
  const ip = getClientIp(h)
  const admin = createAdminClient()
  const windowMs = windowMinutes * 60 * 1000
  const since = new Date(Date.now() - windowMs).toISOString()

  const { count, error } = await admin
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', userId)
    .eq('action', action)
    .gte('attempted_at', since)
  if (error) {
    console.error('[rateLimit] user-action query failed (failing open)', error)
    return { ok: true }
  }
  if ((count ?? 0) >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil(windowMs / 1000) }
  }

  await admin
    .from('auth_attempts')
    .insert({ ip, action, email: userId, success: true })
    .then(
      () => undefined,
      (err: unknown) => console.error('[rateLimit] user-action insert failed', err),
    )
  return { ok: true }
}

// Record the outcome of a login attempt — one row per attempt, with the real
// success/failure. Called by signIn after signInWithPassword so the per-email
// lockout counts failures (success=false) and the per-IP cap counts attempts.
export async function recordLoginOutcome(email: string | undefined, success: boolean): Promise<void> {
  const h = await headers()
  const ip = getClientIp(h)
  const admin = createAdminClient()

  await admin
    .from('auth_attempts')
    .insert({ ip, action: 'login', email: normalizeEmail(email), success })
    .then(
      () => undefined,
      (err: unknown) => console.error('[rateLimit] login-outcome insert failed', err),
    )
}
