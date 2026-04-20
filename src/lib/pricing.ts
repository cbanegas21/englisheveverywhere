// Canonical plan definitions — single source of truth for both landing and dashboard.
// Prices are USD; conversion to other currencies runs through src/lib/fx.ts.

export const PRICING_PLANS = [
  { key: 'spark',  nameEn: 'Spark',   nameEs: 'Chispa',  priceUsd: 129, classes: 8,  highlight: false },
  { key: 'drive',  nameEn: 'Drive',   nameEs: 'Impulso', priceUsd: 179, classes: 12, highlight: false },
  { key: 'ascent', nameEn: 'Ascent',  nameEs: 'Ascenso', priceUsd: 219, classes: 16, highlight: true  },
  { key: 'peak',   nameEn: 'Peak',    nameEs: 'Cima',    priceUsd: 259, classes: 20, highlight: false },
] as const

export type PricingPlanKey = (typeof PRICING_PLANS)[number]['key']

// Map for O(1) lookup in server actions
export const PRICING_MAP: Record<PricingPlanKey, { name: string; priceUsd: number; classes: number }> = {
  spark:  { name: 'Spark',  priceUsd: 129, classes: 8  },
  drive:  { name: 'Drive',  priceUsd: 179, classes: 12 },
  ascent: { name: 'Ascent', priceUsd: 219, classes: 16 },
  peak:   { name: 'Peak',   priceUsd: 259, classes: 20 },
}
