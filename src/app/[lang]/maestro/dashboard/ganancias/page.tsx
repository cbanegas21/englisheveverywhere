import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeTeacherAvailable, sessionPayoutUsd, isClearedAt } from '@/lib/teacherEarnings'
import { hnStartOfMonthUtc } from '@/lib/timezone'
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

  // Only select columns the `authenticated` role is actually granted. The Veem
  // payout columns (payout_veem_email / payout_setup_at) were added by migration
  // 038 WITHOUT a column-level SELECT grant to authenticated — and this table uses
  // column-level grants, so they're not auto-covered. Including them made the
  // WHOLE query fail with 42501 (permission denied) → teacher=null → this page
  // redirected to /onboarding → onboarding bounced the (already-onboarded) teacher
  // to /maestro/dashboard. i.e. the earnings page silently kicked the teacher home.
  // The Veem email is read below via computeTeacherAvailable (admin/service client,
  // which bypasses the grant), so we don't need those columns here.
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) redirect(`/${lang}/onboarding`)

  // Business zone (America/Tegucigalpa, UTC-6) — used for BOTH the "this month"
  // bucket boundary and the next-Friday payout label so the dashboard's dates are
  // internally consistent (previously the month boundary used server-UTC midnight,
  // mis-bucketing HN-evening month-edge classes).
  const HN = 'America/Tegucigalpa'
  const nowHn = new Date(new Date().toLocaleString('en-US', { timeZone: HN }))
  // First of the current month at HN midnight, as a UTC instant — shared helper so
  // teacher home + student progreso bucket the month identically (SB-11).
  const startOfMonth = hnStartOfMonthUtc()

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

  type RawSession = {
    id: string
    scheduled_at: string
    duration_minutes: number
    status: string
    student: { profile: { full_name: string } | null } | null
    payments: { teacher_payout_usd: number; status: string }[] | null
  }
  const rows = (allSessions as RawSession[] | null) || []
  const now = Date.now()

  const sessions = rows.map(s => {
    const pay = s.payments?.[0]
    // Per-session payout via the shared earnings rule (kept in sync with the admin
    // sweep so the teacher's total = what we'll pay out). A no-show (completed, no
    // payment row) correctly earns $0 here too.
    const payoutUsd = sessionPayoutUsd(pay)
    const cleared = isClearedAt(s.scheduled_at, now)
    // "Attended" = the class actually has a settled payment (attendance-gated by
    // migration 045). A no-show completes the booking but writes no payment, so it
    // must NOT count toward the Sessions tile — otherwise the count diverged from
    // the teacher-home total_sessions and showed a $0 "unpaid session" (SB-10).
    const attended = !!pay && pay.status === 'completed'
    return {
      id: s.id,
      scheduled_at: s.scheduled_at,
      duration_minutes: s.duration_minutes,
      student: s.student,
      payoutUsd,
      cleared,
      attended,
    }
  })

  const thisMonth = sessions.filter(s => new Date(s.scheduled_at) >= startOfMonth)

  const lifetimeEarnedUsd = sessions.reduce((sum, s) => sum + (s.payoutUsd || 0), 0)
  const thisMonthEarnedUsd = thisMonth.reduce((sum, s) => sum + (s.payoutUsd || 0), 0)
  // Available subtracts amounts already committed to a payout (pending + paid),
  // so it never double-counts money that's been swept. Canonical math shared
  // with the admin payout sweep.
  const admin = createAdminClient()
  const { availableUsd, pendingHoldUsd: pendingUsd, veemEmail } = await computeTeacherAvailable(admin, teacher.id)

  // Next weekly payout = the upcoming Friday (the auto-sweep day), in the business
  // zone (HN defined above) so the date the teacher sees is consistent.
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
      totalSessions={sessions.filter(s => s.attended).length}
      thisMonthSessions={thisMonth.filter(s => s.attended).length}
      thisMonthEarnedUsd={thisMonthEarnedUsd}
      lifetimeEarnedUsd={lifetimeEarnedUsd}
      availableUsd={availableUsd}
      pendingUsd={pendingUsd}
      nextPayoutLabel={nextPayoutLabel}
      veemEmail={veemEmail}
      sessions={displaySessions}
    />
  )
}
