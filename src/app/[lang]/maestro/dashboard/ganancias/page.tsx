import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTeacherPayoutStatus } from '@/app/actions/stripe'
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
    .select('id, total_sessions, hourly_rate')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) redirect(`/${lang}/onboarding`)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: allSessions } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status,
      student:students(profile:profiles(full_name)),
      payments(teacher_payout_usd, status, stripe_transfer_id)
    `)
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })

  type RawSession = {
    id: string
    scheduled_at: string
    duration_minutes: number
    status: string
    student: { profile: { full_name: string } | null } | null
    payments: { teacher_payout_usd: number; status: string; stripe_transfer_id: string | null }[] | null
  }
  const rows = (allSessions as RawSession[] | null) || []

  const sessions = rows.map(s => {
    const pay = s.payments?.[0]
    // A payout is "paid out" once a Stripe transfer to the teacher's connected
    // account has been recorded. None are yet (transfers are phase 2), so today
    // everything earned reads as "awaiting payout".
    const paidOut = !!pay?.stripe_transfer_id
    // Per-session payout. A payment row only counts as earnings when it actually
    // settled ('completed') — a refunded/failed payout is $0 so the totals don't
    // overstate earnings. A legacy completed booking with NO payment row falls
    // back to hourly-rate math.
    let payoutUsd: number
    if (pay) {
      payoutUsd = pay.status === 'completed' ? (pay.teacher_payout_usd || 0) : 0
    } else {
      payoutUsd = Math.round((teacher.hourly_rate || 0) * ((s.duration_minutes || 60) / 60))
    }
    return {
      id: s.id,
      scheduled_at: s.scheduled_at,
      duration_minutes: s.duration_minutes,
      student: s.student,
      paidOut,
      payoutUsd,
    }
  })

  const thisMonth = sessions.filter(s => new Date(s.scheduled_at) >= startOfMonth)

  const lifetimeEarnedUsd = sessions.reduce((sum, s) => sum + (s.payoutUsd || 0), 0)
  const thisMonthEarnedUsd = thisMonth.reduce((sum, s) => sum + (s.payoutUsd || 0), 0)
  const paidOutUsd = sessions.filter(s => s.paidOut).reduce((sum, s) => sum + (s.payoutUsd || 0), 0)
  const awaitingPayoutUsd = lifetimeEarnedUsd - paidOutUsd

  // Connect onboarding status for the payout-setup banner.
  const payout = await getTeacherPayoutStatus()
  const connectStatus: 'none' | 'pending' | 'ready' = !payout.hasAccount
    ? 'none'
    : payout.payoutsEnabled
      ? 'ready'
      : 'pending'

  const displaySessions = sessions.slice(0, 50)

  return (
    <GananciasClient
      lang={lang as Locale}
      totalSessions={teacher.total_sessions || 0}
      thisMonthSessions={thisMonth.length}
      thisMonthEarnedUsd={thisMonthEarnedUsd}
      lifetimeEarnedUsd={lifetimeEarnedUsd}
      awaitingPayoutUsd={awaitingPayoutUsd}
      connectStatus={connectStatus}
      justConnected={connected === '1'}
      sessions={displaySessions}
    />
  )
}
