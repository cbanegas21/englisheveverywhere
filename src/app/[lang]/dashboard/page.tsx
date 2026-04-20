import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
    .select('id, classes_remaining, placement_test_done, placement_scheduled, current_plan')
    .eq('profile_id', user.id)
    .single()

  // Fetch placement booking scheduled_at (to detect past calls)
  const { data: placementBooking } = await supabase
    .from('bookings')
    .select('scheduled_at')
    .eq('student_id', student?.id || '')
    .eq('type', 'placement_test')
    .neq('status', 'cancelled')
    .maybeSingle()

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
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5)

  // Fetch completed sessions count (class type only)
  const { count: completedCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', (student as { id?: string } | null)?.id || '')
    .eq('type', 'class')
    .eq('status', 'completed')

  // Fetch scheduled-class count (class type only, future + active)
  const { count: scheduledCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', (student as { id?: string } | null)?.id || '')
    .eq('type', 'class')
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', new Date().toISOString())

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student'
  const timezone = (user.user_metadata?.timezone as string) || 'America/Bogota'

  return (
    <StudentDashboardClient
      lang={lang as Locale}
      userName={name}
      timezone={timezone}
      classesRemaining={student?.classes_remaining || 0}
      currentPlan={(student?.current_plan as string) || null}
      placementTestDone={student?.placement_test_done || false}
      placementScheduled={student?.placement_scheduled || false}
      placementScheduledAt={placementBooking?.scheduled_at || null}
      completedSessions={completedCount || 0}
      scheduledClasses={scheduledCount || 0}
      upcomingBookings={(upcomingBookings as any) || []}
    />
  )
}
