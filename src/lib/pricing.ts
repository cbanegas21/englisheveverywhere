// Canonical plan definitions — single source of truth for both landing and dashboard.
// Prices are USD; conversion to other currencies runs through src/lib/fx.ts.

// Plan names are "one-word milestones" (Departure → Journey → Ascent → Summit).
// Keys + prices + class counts are UNCHANGED — only the display names changed.
export const PRICING_PLANS = [
  { key: 'spark',  nameEn: 'Departure', nameEs: 'Partida',  priceUsd: 129, classes: 8,  highlight: false },
  { key: 'drive',  nameEn: 'Journey',   nameEs: 'Trayecto', priceUsd: 179, classes: 12, highlight: false },
  { key: 'ascent', nameEn: 'Ascent',    nameEs: 'Ascenso',  priceUsd: 219, classes: 16, highlight: true  },
  { key: 'peak',   nameEn: 'Summit',    nameEs: 'Cumbre',   priceUsd: 259, classes: 20, highlight: false },
] as const

export type PricingPlanKey = (typeof PRICING_PLANS)[number]['key']

// Map for O(1) lookup in server actions
// O(1) lookup for server actions. `name` is the English display name — for
// locale-aware UI use PRICING_PLANS' nameEn/nameEs instead.
export const PRICING_MAP: Record<PricingPlanKey, { name: string; priceUsd: number; classes: number }> = {
  spark:  { name: 'Departure', priceUsd: 129, classes: 8  },
  drive:  { name: 'Journey',   priceUsd: 179, classes: 12 },
  ascent: { name: 'Ascent',    priceUsd: 219, classes: 16 },
  peak:   { name: 'Summit',    priceUsd: 259, classes: 20 },
}

// Locale-aware display name for a plan key (falls back to the key itself).
export function planName(key: string, lang: 'es' | 'en'): string {
  const p = PRICING_PLANS.find(pl => pl.key === key)
  if (!p) return key
  return lang === 'es' ? p.nameEs : p.nameEn
}
