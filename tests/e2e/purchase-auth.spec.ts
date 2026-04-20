import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * LAUNCH-BLOCKER regression guard — Pay button flow.
 *
 * Current state (bug):
 *   src/app/[lang]/dashboard/plan/PlanClient.tsx:228 unconditionally calls
 *   `simulatePurchase(planKey, lang)` on Pay-button click. simulatePurchase
 *   credits `students.classes_remaining` with the plan's classes WITHOUT
 *   invoking Stripe — no checkout session, no payment verification. A logged
 *   -in student can claim unlimited classes for free.
 *
 * Also: `createCheckoutSession` (src/app/actions/stripe.ts:30), the real
 * Stripe-backed path, has ZERO callers in the repo.
 *
 * This spec is a STATIC guard — it reads the PlanClient source and asserts:
 *   1. handlePay routes through `createCheckoutSession`, NOT `simulatePurchase`
 *   2. `simulatePurchase` is either deleted or gated behind a dev-mode check
 *
 * Both assertions currently fail. When they pass, the Pay flow is safe to
 * ship. A static-source test is used because simulating the Stripe-live
 * environment in CI is more plumbing than this deserves at audit time —
 * wire it into a real flow test after the fix lands.
 */

test.describe('LAUNCH BLOCKER — Pay button must go through Stripe', () => {
  test('PlanClient.handlePay calls createCheckoutSession (not simulatePurchase)', async () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/[lang]/dashboard/plan/PlanClient.tsx'),
      'utf8',
    )

    // Locate the handlePay function body.
    const match = src.match(/function handlePay\([\s\S]*?^\s*\}/m)
    expect(match, 'handlePay function must exist in PlanClient').toBeTruthy()
    const body = match![0]

    const callsSimulate = /simulatePurchase\s*\(/.test(body)
    const callsStripe = /createCheckoutSession\s*\(/.test(body)

    expect(
      callsStripe,
      'handlePay must call createCheckoutSession — real Stripe checkout path',
    ).toBe(true)
    expect(
      callsSimulate,
      'handlePay must NOT call simulatePurchase — that grants classes for free without payment verification',
    ).toBe(false)
  })

  test('simulatePurchase is either removed or gated to dev-mode only', async () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/actions/purchase.ts'),
      'utf8',
    )

    // If the file is deleted or empty, we're good.
    if (!src.trim()) {
      expect(true).toBe(true)
      return
    }

    // Otherwise it MUST have a dev-mode gate — check for a placeholder-key
    // guard at the top of the function body.
    const devModeGate =
      /STRIPE_SECRET_KEY.*sk_test_placeholder|NODE_ENV.*development|placeholder/.test(src)

    expect(
      devModeGate,
      `simulatePurchase must be gated behind a dev-mode / placeholder check. ` +
      `Currently callable from any authenticated student's browser to grant unlimited free classes.`,
    ).toBe(true)
  })

  test('createCheckoutSession has at least one UI caller', async () => {
    // Grep the src/ tree for the function call. Playwright ships its own
    // `rg`/`grep` via FS — use Node fs to traverse.
    const { readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')

    function walk(dir: string, acc: string[] = []): string[] {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry)
        if (statSync(p).isDirectory()) {
          if (entry === 'node_modules' || entry === '.next') continue
          walk(p, acc)
        } else if (/\.(ts|tsx)$/.test(entry)) {
          acc.push(p)
        }
      }
      return acc
    }

    const files = walk(resolve(process.cwd(), 'src'))
    const callers = files.filter(f => {
      if (f.endsWith('stripe.ts')) return false // definition, not caller
      const content = readFileSync(f, 'utf8')
      return /createCheckoutSession\s*\(/.test(content)
    })

    expect(
      callers.length,
      `createCheckoutSession must be called from at least one UI component. ` +
      `Currently dead code — no Stripe checkout session is ever created.`,
    ).toBeGreaterThan(0)
  })
})
