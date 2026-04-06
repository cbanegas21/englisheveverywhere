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
    .select('id, level, classes_remaining, placement_test_done')
    .eq('profile_id', user.id)
    .single()

  // Fetch upcoming bookings
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status,
      teacher:teachers(profile:profiles(full_name))
    `)
    .eq('student_id', student?.id || '')
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5)

  // Fetch completed sessions count
  const { count: completedCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', (student as { id?: string } | null)?.id || '')
    .eq('status', 'completed')

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student'

  return (
    <StudentDashboardClient
      lang={lang as Locale}
      userName={name}
      level={student?.level || null}
      classesRemaining={student?.classes_remaining || 0}
      placementTestDone={student?.placement_test_done || false}
      completedSessions={completedCount || 0}
      upcomingBookings={(upcomingBookings as any) || []}
    />
  )
}
