import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Liveness probe for the Supabase data plane.
 *
 * Why this exists: on 2026-08-21 the production Supabase project was found
 * PAUSED (free-tier idle auto-pause) — its host had stopped resolving weeks
 * earlier, so login/registro/dashboard/checkout were all dead while the static
 * marketing pages kept serving 200s. Two compounding causes:
 *
 *   1. NOTHING generated scheduled database traffic. The daily reconciliation
 *      cron builds an admin client but only queries inside its loop over PAID
 *      Stripe sessions — with zero paid sessions it never issued a single
 *      request, so the idle timer never reset.
 *   2. NOTHING alerted. That same cron returned `{ok:true}` every day of the
 *      outage because it never touched the database it was meant to check.
 *
 * So the probe must issue a REAL request over the data API (PostgREST) — the
 * path Supabase counts as project activity — and callers must fail LOUDLY on a
 * bad result. A HEAD+count read is the cheapest query that still round-trips to
 * Postgres. `teachers` is tiny and permanent.
 */
export type DbProbe = { ok: true; ms: number } | { ok: false; ms: number; error: string }

const PROBE_TIMEOUT_MS = 10_000

export async function probeDatabase(): Promise<DbProbe> {
  const started = Date.now()
  try {
    const { error } = await createAdminClient()
      .from('teachers')
      .select('id', { count: 'exact', head: true })
      .abortSignal(AbortSignal.timeout(PROBE_TIMEOUT_MS))
    const ms = Date.now() - started
    if (error) return { ok: false, ms, error: error.message }
    return { ok: true, ms }
  } catch (err) {
    // A paused/deleted project fails at DNS, so this lands here, not in `error`.
    return {
      ok: false,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : 'unknown database error',
    }
  }
}

/** Liveness probe for the auth plane — the DB can be up while GoTrue is not. */
export async function probeAuth(): Promise<DbProbe> {
  const started = Date.now()
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: 'no-store',
    })
    const ms = Date.now() - started
    if (!res.ok) return { ok: false, ms, error: `auth health ${res.status}` }
    return { ok: true, ms }
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : 'unknown auth error',
    }
  }
}
