import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveStudentNames, attachStudentName } from '@/lib/teacher/studentNames'
import { getSessionUser } from '@/lib/session'
import { activeBookingCutoffIso } from '@/lib/bookingWindow'
import { hnStartOfMonthUtc, isValidTimeZone } from '@/lib/timezone'
import TeacherDashboardClient from './TeacherDashboardClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function TeacherDashboardPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  // Request-memoized — reuses the layout's already-validated user (see src/lib/session.ts).
  const user = await getSessionUser()
  if (!user) redirect(`/${lang}/login`)

  // Fetch teacher data
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, rating, total_sessions, is_active, accepting_students, specializations')
    .eq('profile_id', user.id)
    .maybeSingle()

  // A teacher-role user with no teachers row hasn't finished onboarding — send
  // them to onboarding instead of rendering an empty dashboard (teacher.id would
  // match no bookings → a blank page). The dashboard layout already enforces
  // this redirect; guarding here too keeps the page correct on its own and lets
  // the queries below use teacher.id without the misleading `|| ''` fallback.
  if (!teacher) redirect(`/${lang}/onboarding`)

  // Bucket "this month" in HONDURAS time (the shared business zone) so the
  // teacher's home "this month" agrees with the earnings page — server-UTC
  // midnight mis-bucketed an HN-evening month-edge class into the wrong month
  // (SB-11). Pure computation, no await.
  const startOfMonth = hnStartOfMonthUtc()

  // The three reads are independent (upcoming + this-month need teacher.id, the
  // profile read needs user.id), so fire them concurrently instead of serially.
  const [
    { data: upcomingSessions },
    { count: thisMonthCount },
    { data: profileRow },
  ] = await Promise.all([
    // Upcoming sessions. Keep live / just-started sessions visible so the teacher can still join.
    supabase
      .from('bookings')
      .select(`
      id, scheduled_at, duration_minutes, status, student_id,
      student:students(profile:profiles(full_name))
    `)
      .eq('teacher_id', teacher.id)
      .in('status', ['confirmed', 'pending'])
      .gte('scheduled_at', activeBookingCutoffIso())
      .order('scheduled_at', { ascending: true })
      .limit(5),
    // This month's completed sessions (count only).
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacher.id)
      .eq('status', 'completed')
      .gte('scheduled_at', startOfMonth.toISOString()),
    // Phase D: prefer profiles.timezone (user-editable) over auth metadata.
    supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  // The student:profiles embed above resolves to NULL under RLS (no teacher ->
  // student-profile SELECT policy), and the client swallows it as "Estudiante".
  // Re-resolve via the service-role client, scoped to the bookings we already
  // filtered by teacher_id. See src/lib/teacher/studentNames.ts.
  const upcomingRows = (upcomingSessions ?? []) as { student_id?: string | null }[]
  const studentNames = await resolveStudentNames(upcomingRows.map((b) => b.student_id))
  const upcomingNamed = upcomingRows.map((b) => attachStudentName(b, studentNames))

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Teacher'
  const rawTimezone =
    (profileRow as { timezone?: string | null } | null)?.timezone ||
    (user.user_metadata?.timezone as string) ||
    'America/Tegucigalpa'
  // A corrupt stored tz throws RangeError mid-render and crashes the page —
  // same guard as dashboard/agendar/placement (DASH-01).
  const timezone = isValidTimeZone(rawTimezone) ? rawTimezone : 'America/Tegucigalpa'

  return (
    <TeacherDashboardClient
      lang={lang as Locale}
      profileId={user.id}
      userName={name}
      timezone={timezone}
      rating={teacher?.rating || 0}
      totalSessions={teacher?.total_sessions || 0}
      accepting={teacher?.accepting_students ?? true}
      specializations={teacher?.specializations || []}
      thisMonthSessions={thisMonthCount || 0}
      upcomingSessions={(upcomingNamed as any) || []}
    />
  )
}
