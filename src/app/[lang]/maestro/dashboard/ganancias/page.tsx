import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GananciasClient from './GananciasClient'
import type { Locale } from '@/lib/i18n/translations'

// Earnings clear (become payable) this many days after the class — the hold that
// absorbs late refunds/no-shows before money is swept out to the teacher's Veem.
const HOLD_DAYS = 7

interface Props {
  params: Promise<{ lang: string }>
}

export default async function GananciasPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, total_sessions, hourly_rate, payout_veem_email, payout_setup_at')
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
  const clearMs = Date.now() - HOLD_DAYS * 24 * 60 * 60 * 1000

  const sessions = rows.map(s => {
    const pay = s.payments?.[0]
    // "Paid out" once a transfer to the teacher has been recorded (Veem sweep,
    // phase 2c). None are yet, so cleared earnings read as "available".
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
    // Cleared = past the hold window → counts toward the next payout. Otherwise
    // it's still "pending" (in hold).
    const cleared = new Date(s.scheduled_at).getTime() <= clearMs
    return {
      id: s.id,
      scheduled_at: s.scheduled_at,
      duration_minutes: s.duration_minutes,
      student: s.student,
      paidOut,
      payoutUsd,
      cleared,
    }
  })

  const thisMonth = sessions.filter(s => new Date(s.scheduled_at) >= startOfMonth)

  const lifetimeEarnedUsd = sessions.reduce((sum, s) => sum + (s.payoutUsd || 0), 0)
  const thisMonthEarnedUsd = thisMonth.reduce((sum, s) => sum + (s.payoutUsd || 0), 0)
  // Available = cleared (past hold) and not yet swept out. Pending = still in hold.
  const availableUsd = sessions.filter(s => s.cleared && !s.paidOut).reduce((sum, s) => sum + (s.payoutUsd || 0), 0)
  const pendingUsd = sessions.filter(s => !s.cleared).reduce((sum, s) => sum + (s.payoutUsd || 0), 0)

  // Next weekly payout = the upcoming Friday (the auto-sweep day). Computed in the
  // business zone so the date the teacher sees is consistent.
  const HN = 'America/Tegucigalpa'
  const nowHn = new Date(new Date().toLocaleString('en-US', { timeZone: HN }))
  const daysUntilFri = (5 - nowHn.getDay() + 7) % 7 // 0 if today is Friday
  const nextPayout = new Date(nowHn)
  nextPayout.setDate(nowHn.getDate() + daysUntilFri)
  const nextPayoutLabel = nextPayout.toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: HN,
  })

  const displaySessions = sessions.slice(0, 50)

  return (
    <GananciasClient
      lang={lang as Locale}
      totalSessions={teacher.total_sessions || 0}
      thisMonthSessions={thisMonth.length}
      thisMonthEarnedUsd={thisMonthEarnedUsd}
      lifetimeEarnedUsd={lifetimeEarnedUsd}
      availableUsd={availableUsd}
      pendingUsd={pendingUsd}
      nextPayoutLabel={nextPayoutLabel}
      veemEmail={teacher.payout_veem_email ?? null}
      sessions={displaySessions}
    />
  )
}
