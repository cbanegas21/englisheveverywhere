// 1 USD ≈ 24.7 HNL (fixed rate for display)
export const HNL_RATE = 24.7

export const PLANS = {
  starter:  { name: 'Starter',   priceUsd: 39,  classes: 4  },
  estandar: { name: 'Estándar',  priceUsd: 69,  classes: 8  },
  intensivo:{ name: 'Intensivo', priceUsd: 119, classes: 16 },
} as const

export type PlanKey = keyof typeof PLANS
