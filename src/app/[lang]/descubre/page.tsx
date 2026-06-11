import type { Locale } from '@/lib/i18n/translations'
import DescubreClient from './DescubreClient'

interface Props { params: Promise<{ lang: string }> }

// "Descubre tu plan" — a short value-first quiz that recommends a plan from the
// student's level/goal/frequency, then sends them to sign up. The actual price
// is revealed only after signup (at the plan/checkout step) — the gated-pricing
// funnel. Public route (no auth).
export default async function DescubrePage({ params }: Props) {
  const { lang } = await params
  return <DescubreClient lang={lang as Locale} />
}
