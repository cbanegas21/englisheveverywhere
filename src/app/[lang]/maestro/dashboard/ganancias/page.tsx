import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GananciasClient from './GananciasClient'
import type { Locale } from '@/lib/i18n/translations'

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
    .select('id, total_sessions, hourly_rate')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) redirect(`/${lang}/maestro/dashboard`)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: allSessions } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status,
      student:students(profile:profiles(full_name)),
      payments(teacher_payout_usd, status)
    `)
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    .limit(50)

  // Coalesce the payments relation (supabase returns an array for 1:N joins
  // even though the unique-booking-id constraint makes it effectively 1:1).
  type RawSession = {
    id: string
    scheduled_at: string
    duration_minutes: number
    status: string
    student: { profile: { full_name: string } | null } | null
    payments: { teacher_payout_usd: number; status: string }[] | null
  }
  const rows = (allSessions as RawSession[] | null) || []

  const sessions = rows.map(s => ({
    id: s.id,
    scheduled_at: s.scheduled_at,
    duration_minutes: s.duration_minutes,
    status: s.status,
    student: s.student,
    // Per-session payout — prefer the payments row; fall back to hourly
    // rate math so legacy completed bookings (before payments row was
    // being inserted) still show something.
    payoutUsd:
      s.payments?.[0]?.teacher_payout_usd ??
      Math.round((teacher.hourly_rate || 0) * ((s.duration_minutes || 50) / 60)),
  }))

  const thisMonth = sessions.filter(
    s => new Date(s.scheduled_at) >= startOfMonth
  )

  const thisMonthEarningsUsd = thisMonth.reduce((sum, s) => sum + (s.payoutUsd || 0), 0)
  const totalEarningsUsd = sessions.reduce((sum, s) => sum + (s.payoutUsd || 0), 0)

  return (
    <GananciasClient
      lang={lang as Locale}
      totalSessions={teacher.total_sessions || 0}
      thisMonthSessions={thisMonth.length}
      thisMonthEarningsUsd={thisMonthEarningsUsd}
      totalEarningsUsd={totalEarningsUsd}
      sessions={sessions}
    />
  )
}
