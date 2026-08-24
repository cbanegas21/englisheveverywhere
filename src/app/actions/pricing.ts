'use server'

import { PRICING_MAP, type PricingPlanKey } from '@/lib/pricing'

/**
 * Reveal one plan's price to the public quiz.
 *
 * WHY A SERVER ACTION AND NOT A PROP: prices are public now (2026-08-23 decision —
 * the gate stopped protecting anything the moment the teacher started closing the
 * sale, and hiding them was costing us people who bounce rather than register to
 * find out). But "public" must not mean "sitting in the static JS bundle", where
 * all four packs can be scraped in one request and read as a margin table. A
 * server action returns the figure at runtime, so `scripts/qa-public-leak.mjs`
 * keeps passing and the landing bundle stays price-free.
 *
 * Only ONE plan's price crosses per call — the one the quiz actually recommended.
 * No auth: this is deliberately reachable by anyone who answers three questions.
 */
export type PlanPricing = {
  priceUsd: number
  classes: number
  /** Rounded per-class figure — the honest framing for a prepaid pack. */
  perClassUsd: number
}

export async function revealPlanPricing(planKey: string): Promise<PlanPricing | null> {
  // Validate against the canonical map rather than trusting the caller's string.
  const plan = PRICING_MAP[planKey as PricingPlanKey]
  if (!plan) return null
  return {
    priceUsd: plan.priceUsd,
    classes: plan.classes,
    perClassUsd: Math.round(plan.priceUsd / plan.classes),
  }
}
