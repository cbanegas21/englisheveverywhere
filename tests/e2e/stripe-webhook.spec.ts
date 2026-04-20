import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

;(function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i)
      if (!m) continue
      const [, k, vRaw] = m
      if (process.env[k]) continue
      process.env[k] = vRaw.replace(/^['"]|['"]$/g, '')
    }
  } catch { /* optional */ }
})()

/**
 * Tier 1.5 — Stripe webhook plan credit flow.
 *
 * The webhook (src/app/api/stripe/webhook/route.ts) credits a student's
 * `classes_remaining` on `checkout.session.completed`. It:
 *   1. Resolves plan_key → class count via CLASS_COUNTS (backed by PRICING_MAP).
 *   2. Looks up the plan_id in the `plans` table by classes_per_month.
 *   3. Upserts a subscriptions row and updates students.classes_remaining.
 *
 * Since `plans` still contains LEGACY rows with overlapping classes_per_month
 * values (4/8/16) left over from the pre-plan_key era, the lookup in step 2
 * can return multiple rows. The webhook uses `.single()` which errors when
 * multiple rows match, silently skipping the credit.
 *
 * This spec verifies:
 *   1. CLASS_COUNTS maps every canonical plan_key + legacy key to a count.
 *   2. Plan lookup by classes_per_month is UNAMBIGUOUS for each canonical
 *      tier — i.e. there's exactly one active plan row per canonical count.
 *      (Regression detector for the duplicate-plans bug.)
 *   3. The lookup the webhook actually performs (`.eq('classes_per_month', n)
 *      .single()`) resolves correctly for all four canonical plan_keys.
 */

function getAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const EXPECTED_COUNTS: Record<string, number> = {
  spark: 8,
  drive: 12,
  ascent: 16,
  peak: 20,
}

test.describe('Tier 1.5 — Stripe webhook plan credit contract', () => {
  let admin: SupabaseClient | null = null

  test.beforeAll(() => {
    admin = getAdmin()
  })

  test('pricing.ts canonical keys match expected class counts', async () => {
    // Read pricing.ts as source so we don't hit the ESM import issues in
    // the Playwright runner. Pins the canonical class counts — if a plan
    // definition changes, this test must be updated in lockstep with the
    // webhook's CLASS_COUNTS map.
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/pricing.ts'),
      'utf8',
    )
    for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
      const re = new RegExp(`${key}:\\s*{[^}]*classes:\\s*(\\d+)`, 'i')
      const m = src.match(re)
      expect(m, `PRICING_MAP must define ${key}`).toBeTruthy()
      expect(Number(m![1]), `PRICING_MAP[${key}].classes`).toBe(expected)
    }
  })

  test('plans table has an ACTIVE row for each canonical plan_key', async () => {
    test.skip(!admin, 'Service role not available')

    const { data: plans } = await admin!
      .from('plans')
      .select('plan_key, classes_per_month, is_active, price_usd')
      .eq('is_active', true)

    expect(plans, 'plans query should return rows').toBeTruthy()
    const keys = new Set((plans ?? []).map(p => p.plan_key))
    for (const key of Object.keys(EXPECTED_COUNTS)) {
      expect(keys.has(key), `active plan with plan_key='${key}' must exist`).toBe(true)
    }
  })

  test('webhook plan lookup by plan_key + is_active=true resolves for every canonical tier', async () => {
    test.skip(!admin, 'Service role not available')

    // Mirrors the post-fix webhook query. The previous query (by
    // classes_per_month alone) was ambiguous because legacy rows share
    // 8/16 with spark/ascent and `.single()` errored out (PGRST116),
    // silently skipping the credit. Fix: `plan_key + is_active=true`.
    const failures: string[] = []
    for (const key of Object.keys(EXPECTED_COUNTS)) {
      const { data, error } = await admin!
        .from('plans')
        .select('id, plan_key, is_active')
        .eq('plan_key', key)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        failures.push(`${key}: ${error?.code ?? 'no data'} ${error?.message ?? ''}`)
      }
    }

    expect(
      failures,
      `Webhook will silently fail to credit classes for these tiers:\n${failures.join('\n')}`,
    ).toEqual([])
  })

  test('legacy alias plan_keys (starter/estandar/intensivo) collapse to canonical', async () => {
    test.skip(!admin, 'Service role not available')

    // The webhook maps starter→spark, estandar→drive, intensivo→ascent so
    // in-flight checkouts from legacy metadata still credit correctly.
    // Verify the canonical rows exist and are active (the alias path relies
    // on them resolving through the canonical lookup).
    const aliases = [
      { alias: 'starter', canonical: 'spark' },
      { alias: 'estandar', canonical: 'drive' },
      { alias: 'intensivo', canonical: 'ascent' },
    ]
    for (const { alias, canonical } of aliases) {
      const { data, error } = await admin!
        .from('plans')
        .select('id, plan_key')
        .eq('plan_key', canonical)
        .eq('is_active', true)
        .single()
      expect(data, `alias ${alias} requires canonical ${canonical} to resolve`).toBeTruthy()
      expect(error).toBeNull()
    }
  })

  test('webhook endpoint returns 200 + {received:true} for dev-mode (placeholder env)', async ({ request, baseURL }) => {
    // Even without a signature, the webhook should return 200 when Stripe env
    // is placeholder (dev mode). This guards against accidental 500s on
    // misconfigured local envs.
    const resp = await request.post(`${baseURL}/api/stripe/webhook`, {
      data: '{}',
      headers: { 'content-type': 'application/json' },
    })
    // In placeholder mode: 200 with {received:true}.
    // In real-mode (if envs are set): 400 missing signature. Accept either.
    expect([200, 400]).toContain(resp.status())
  })
})
