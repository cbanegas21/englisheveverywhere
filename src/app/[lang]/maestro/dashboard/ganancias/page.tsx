import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GananciasClient from './GananciasClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ connected?: string }>
}

export default async function GananciasPage({ params, searchParams }: Props) {
  const { lang } = await params
  const { connected } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, hourly_rate, total_sessions, stripe_account_id')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) redirect(`/${lang}/maestro/dashboard`)

  // This month earnings
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: monthPayments } = await supabase
    .from('payments')
    .select('amount_usd, teacher_payout_usd, created_at')
    .eq('teacher_id', teacher.id)
    .gte('created_at', startOfMonth.toISOString())
    .eq('status', 'completed')

  // All-time earnings
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount_usd, teacher_payout_usd, created_at')
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20)

  const thisMonthTotal = (monthPayments || []).reduce((sum, p) => sum + (p.teacher_payout_usd || 0), 0)
  const allTimeTotal = (allPayments || []).reduce((sum, p) => sum + (p.teacher_payout_usd || 0), 0)

  return (
    <GananciasClient
      lang={lang as Locale}
      hourlyRate={teacher.hourly_rate || 0}
      totalSessions={teacher.total_sessions || 0}
      thisMonthEarnings={thisMonthTotal}
      allTimeEarnings={allTimeTotal}
      recentPayments={(allPayments as any) || []}
      hasStripeAccount={!!(teacher as any).stripe_account_id}
      justConnected={!!connected}
    />
  )
}
