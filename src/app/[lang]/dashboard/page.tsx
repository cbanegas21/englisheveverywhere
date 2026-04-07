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
    .select('id, level, classes_remaining, placement_test_done, current_plan')
    .eq('profile_id', user.id)
    .single()

  console.log('[dashboard] student:', student?.id, 'classes_remaining:', student?.classes_remaining, 'placement_test_done:', student?.placement_test_done)

  // Fetch upcoming bookings (class type only)
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status,
      teacher:teachers(profile:profiles(full_name))
    `)
    .eq('student_id', student?.id || '')
    .eq('type', 'class')
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5)

  console.log('[dashboard] upcomingBookings count:', upcomingBookings?.length ?? 0)

  // Fetch completed sessions count (class type only)
  const { count: completedCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', (student as { id?: string } | null)?.id || '')
    .eq('type', 'class')
    .eq('status', 'completed')

  console.log('[dashboard] completedCount:', completedCount)

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student'
  const timezone = (user.user_metadata?.timezone as string) || 'America/Bogota'

  return (
    <StudentDashboardClient
      lang={lang as Locale}
      userName={name}
      timezone={timezone}
      level={student?.level || null}
      classesRemaining={student?.classes_remaining || 0}
      placementTestDone={student?.placement_test_done || false}
      completedSessions={completedCount || 0}
      upcomingBookings={(upcomingBookings as any) || []}
    />
  )
}
