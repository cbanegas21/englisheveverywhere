import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { activeBookingCutoffIso } from '@/lib/bookingWindow'
import { isValidTimeZone } from '@/lib/timezone'
import StudentDashboardClient from './StudentDashboardClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function StudentDashboardPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  // Fetch student data
  const { data: student } = await supabase
    .from('students')
    .select('id, classes_remaining, placement_test_done, placement_scheduled, current_plan, primary_teacher_id')
    .eq('profile_id', user.id)
    .maybeSingle()

  // A logged-in student with no students row hasn't finished onboarding (the row
  // is created only on onboarding completion). Mirror the teacher dashboard guard
  // and the sibling pages (agendar/placement) — send them to finish setup instead
  // of rendering an all-zeros, dead-CTA home (SH-COLD-01).
  if (!student) redirect(`/${lang}/onboarding`)

  // Fetch placement booking scheduled_at (to detect past calls) + the id of
  // whoever's running it, so the dashboard banner can name the host.
  const { data: placementBooking } = await supabase
    .from('bookings')
    .select('scheduled_at, conductor_profile_id, teacher_id')
    .eq('student_id', student.id)
    .eq('type', 'placement_test')
    .neq('status', 'cancelled')
    .maybeSingle()

  // Resolve the placement host's name. The host is either an admin "conductor"
  // (conductor_profile_id) or an assigned teacher (teacher_id). A student cannot
  // read an admin's profiles row under RLS, so the previous embedded join came
  // back null and the banner wrongly said "host being assigned" (SH-BAN-01). Read
  // the single display name via the service-role client — the student is entitled
  // to know who runs their own call. Server-only; never sent to the browser raw.
  let placementConductorName: string | null = null
  if (placementBooking?.conductor_profile_id || placementBooking?.teacher_id) {
    const admin = createAdminClient()
    if (placementBooking.conductor_profile_id) {
      const { data } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', placementBooking.conductor_profile_id)
        .maybeSingle()
      placementConductorName = (data as { full_name?: string | null } | null)?.full_name ?? null
    } else if (placementBooking.teacher_id) {
      const { data } = await admin
        .from('teachers')
        .select('profile:profiles(full_name)')
        .eq('id', placementBooking.teacher_id)
        .maybeSingle()
      const prof = (data as { profile?: { full_name?: string | null } | { full_name?: string | null }[] } | null)?.profile
      placementConductorName = Array.isArray(prof) ? prof[0]?.full_name ?? null : prof?.full_name ?? null
    }
  }

  // Fetch upcoming bookings (class type only)
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status, teacher_id,
      teacher:teachers(profile:profiles(full_name))
    `)
    .eq('student_id', student?.id || '')
    .eq('type', 'class')
    .in('status', ['confirmed', 'pending'])
    // Keep live / just-started classes visible so the Join button stays reachable.
    .gte('scheduled_at', activeBookingCutoffIso())
    .order('scheduled_at', { ascending: true })
    .limit(5)

  // Fetch completed sessions (class type only) — read durations so "total time"
  // is the real SUM of minutes, not the class count × 1h (SH-BAN-05).
  const { data: completedRows } = await supabase
    .from('bookings')
    .select('duration_minutes')
    .eq('student_id', student.id)
    .eq('type', 'class')
    .eq('status', 'completed')
  const completedCount = completedRows?.length || 0
  const totalStudyMinutes = (completedRows || []).reduce(
    (sum, r) => sum + ((r as { duration_minutes?: number }).duration_minutes || 0),
    0,
  )

  // Fetch scheduled-class count (class type only). Match the hero/upcoming cutoff
  // (now − 2.5h, activeBookingCutoffIso) so a live or just-started class is
  // counted — using `now` dropped it, leaving the stat at 0 and showing the wrong
  // "you used all your classes" banner while a class was on screen (SH-BAN-04).
  const { count: scheduledCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', student.id)
    .eq('type', 'class')
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', activeBookingCutoffIso())

  // Surface the student's locked-in teacher (admin-assigned via primary_teacher_id)
  // so the dashboard can answer "Can I get the same teacher every time?" with a
  // direct yes — see Q30 in docs/USER_AUDIT.md.
  const primaryTeacherId = (student as { primary_teacher_id?: string | null }).primary_teacher_id ?? null
  let primaryTeacherName: string | null = null
  if (primaryTeacherId) {
    // Service-role read: a student may not yet share a booking with their
    // admin-assigned teacher, which RLS requires for the profile name — without
    // this the "your assigned teacher" card silently never renders (SH-COLD-06).
    const admin = createAdminClient()
    const { data: pt } = await admin
      .from('teachers')
      .select('profile:profiles(full_name)')
      .eq('id', primaryTeacherId)
      .maybeSingle()
    const ptProfile = (pt as { profile?: { full_name?: string | null } | { full_name?: string | null }[] } | null)?.profile
    primaryTeacherName = Array.isArray(ptProfile)
      ? ptProfile[0]?.full_name ?? null
      : ptProfile?.full_name ?? null
  }

  // Phase D: canonical timezone lives on profiles.timezone (updated by the
  // settings page). Auth user_metadata is the initial signup value and goes
  // stale once the user edits their profile.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student'
  const rawTimezone =
    (profileRow as { timezone?: string | null } | null)?.timezone ||
    (user.user_metadata?.timezone as string) ||
    ''
  // Validate before it reaches any Intl/toLocale call — an invalid IANA string
  // (stale row, direct DB edit, future bug) would otherwise throw a RangeError
  // mid-render and blank the dashboard (SH-HYD-03 / DASH-01). Canonical fallback
  // matches Agendar/Placement.
  const timezone = isValidTimeZone(rawTimezone) ? rawTimezone : 'America/Tegucigalpa'

  // Compute the time-of-day greeting on the server from one authoritative clock
  // so SSR and client hydration render the SAME word — calling new Date() in
  // client render straddles the 12:00/18:00 boundary and trips React #418
  // (SH-HYD-01). The client maps this key to localized copy.
  let greetHour: number
  try {
    greetHour = parseInt(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(new Date()),
      10,
    )
    if (Number.isNaN(greetHour)) greetHour = new Date().getUTCHours()
  } catch {
    greetHour = new Date().getUTCHours()
  }
  const greetingKey: 'greeting' | 'greetingAfternoon' | 'greetingEvening' =
    greetHour < 12 ? 'greeting' : greetHour < 18 ? 'greetingAfternoon' : 'greetingEvening'

  return (
    <StudentDashboardClient
      lang={lang as Locale}
      userName={name}
      timezone={timezone}
      greetingKey={greetingKey}
      classesRemaining={student.classes_remaining || 0}
      currentPlan={(student.current_plan as string) || null}
      placementTestDone={student.placement_test_done || false}
      placementScheduled={student.placement_scheduled || false}
      placementScheduledAt={placementBooking?.scheduled_at || null}
      placementConductorName={placementConductorName}
      primaryTeacherName={primaryTeacherName}
      completedSessions={completedCount || 0}
      totalStudyMinutes={totalStudyMinutes}
      scheduledClasses={scheduledCount || 0}
      upcomingBookings={(upcomingBookings as any) || []}
    />
  )
}
