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

type Action = 'login' | 'signup'

const WINDOW_MS = 15 * 60 * 1000
const LIMIT: Record<Action, number> = {
  // Login: 10 per 15 min. Enough headroom for a genuine user fat-fingering
  // their password; low enough that credential-stuffing exhausts quickly.
  login: 10,
  // Signup: 5 per 15 min per IP. Legit traffic is one signup per person; a
  // higher ceiling here only helps bot farms.
  signup: 5,
}

function getClientIp(h: Headers): string {
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') || 'unknown'
}

export async function checkAuthRateLimit(
  action: Action,
  email?: string,
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const h = await headers()
  const ip = getClientIp(h)

  const admin = createAdminClient()
  const since = new Date(Date.now() - WINDOW_MS).toISOString()

  const { count } = await admin
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('action', action)
    .gte('attempted_at', since)

  const attempts = count ?? 0
  if (attempts >= LIMIT[action]) {
    return { ok: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) }
  }

  // Record the attempt. Fire-and-forget from the caller's perspective:
  // a write failure shouldn't block the legitimate auth action. Worst case
  // a handful of attempts go unrecorded and the limiter under-counts.
  await admin
    .from('auth_attempts')
    .insert({ ip, action, email: email ?? null })
    .then(
      () => undefined,
      (err: unknown) => {
        console.error('[rateLimit] insert failed', err)
      },
    )

  return { ok: true }
}
