import type { Locale } from '@/lib/i18n/translations'
import { publicPlans } from '@/lib/pricing'
import DescubreClient from './DescubreClient'

interface Props { params: Promise<{ lang: string }> }

// "Descubre tu plan" — a short value-first quiz that recommends a plan from the
// student's level/goal/frequency, then sends them to sign up. The actual price
// is revealed only after signup (at the plan/checkout step) — the gated-pricing
// funnel. Public route (no auth).
export default async function DescubrePage({ params }: Props) {
  const { lang } = await params
  // Pass a price-free plan list (names + class counts only) — the quiz reveals a
  // recommended pack but NEVER its price (gated funnel); priceUsd stays server-side.
  return <DescubreClient lang={lang as Locale} plans={publicPlans()} />
}
