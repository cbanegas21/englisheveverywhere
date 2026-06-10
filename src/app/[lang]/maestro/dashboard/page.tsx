import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { activeBookingCutoffIso } from '@/lib/bookingWindow'
import TeacherDashboardClient from './TeacherDashboardClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function TeacherDashboardPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
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

  // Fetch upcoming sessions
  const { data: upcomingSessions } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status,
      student:students(profile:profiles(full_name))
    `)
    .eq('teacher_id', teacher.id)
    .in('status', ['confirmed', 'pending'])
    // Keep live / just-started sessions visible so the teacher can still join.
    .gte('scheduled_at', activeBookingCutoffIso())
    .order('scheduled_at', { ascending: true })
    .limit(5)

  // Fetch this month's completed sessions
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: thisMonthCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .gte('scheduled_at', startOfMonth.toISOString())

  // Phase D: prefer profiles.timezone (user-editable) over auth metadata.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Teacher'
  const timezone =
    (profileRow as { timezone?: string | null } | null)?.timezone ||
    (user.user_metadata?.timezone as string) ||
    'America/Tegucigalpa'

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
      upcomingSessions={(upcomingSessions as any) || []}
    />
  )
}
