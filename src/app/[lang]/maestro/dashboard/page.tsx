import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
    .select('id, rating, total_sessions, is_active, specializations')
    .eq('profile_id', user.id)
    .single()

  // Fetch upcoming sessions
  const { data: upcomingSessions } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status,
      student:students(profile:profiles(full_name))
    `)
    .eq('teacher_id', teacher?.id || '')
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5)

  // Fetch this month's completed sessions
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: thisMonthCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacher?.id || '')
    .eq('status', 'completed')
    .gte('scheduled_at', startOfMonth.toISOString())

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Teacher'

  return (
    <TeacherDashboardClient
      lang={lang as Locale}
      profileId={user.id}
      userName={name}
      rating={teacher?.rating || 0}
      totalSessions={teacher?.total_sessions || 0}
      isActive={teacher?.is_active || false}
      specializations={teacher?.specializations || []}
      thisMonthSessions={thisMonthCount || 0}
      upcomingSessions={(upcomingSessions as any) || []}
    />
  )
}
