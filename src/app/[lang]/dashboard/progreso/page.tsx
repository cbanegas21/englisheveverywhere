import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProgresoClient from './ProgresoClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function ProgresoPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: student } = await supabase
    .from('students')
    .select('id, level, classes_remaining, current_plan, survey_answers, placement_test_done, placement_scheduled')
    .eq('profile_id', user.id)
    .single()

  if (!student) {
    return (
      <ProgresoClient
        lang={lang as Locale}
        level={null}
        classesRemaining={0}
        currentPlan={null}
        surveyAnswers={null}
        placementTestDone={false}
        placementBooking={null}
        completedTotal={0}
        totalHours={0}
        completedThisMonth={0}
        upcomingClasses={0}
        recentBookings={[]}
      />
    )
  }

  const studentId = student.id

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: placementBooking } = await supabase
    .from('bookings')
    .select('id, scheduled_at, status')
    .eq('student_id', studentId)
    .eq('type', 'placement_test')
    .neq('status', 'cancelled')
    .maybeSingle()

  const [
    { count: completedTotal },
    { count: completedThisMonth },
    { count: upcomingClasses },
    { data: recentBookings },
    { data: completedDurations },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('type', 'class')
      .eq('status', 'completed'),

    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('type', 'class')
      .eq('status', 'completed')
      .gte('scheduled_at', startOfMonth.toISOString()),

    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('type', 'class')
      .in('status', ['confirmed', 'pending'])
      .gte('scheduled_at', new Date().toISOString()),

    supabase
      .from('bookings')
      .select('id, scheduled_at, duration_minutes, notes')
      .eq('student_id', studentId)
      .eq('type', 'class')
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false })
      .limit(8),

    // Real total live-class hours = SUM(duration_minutes) over ALL completed
    // classes — not the class COUNT with an 'h' suffix (which was wrong for any
    // non-60-min class and duplicated the Classes tile). PROG-HOURS-DATA-01.
    supabase
      .from('bookings')
      .select('duration_minutes')
      .eq('student_id', studentId)
      .eq('type', 'class')
      .eq('status', 'completed'),
  ])

  const totalMinutes = ((completedDurations as { duration_minutes: number | null }[] | null) || [])
    .reduce((sum, r) => sum + (r.duration_minutes || 60), 0)
  // One decimal so a 90-min class reads 4.5h, but a whole number stays clean (4h).
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10

  return (
    <ProgresoClient
      lang={lang as Locale}
      level={student.level || null}
      classesRemaining={student.classes_remaining || 0}
      currentPlan={(student.current_plan as string) || null}
      surveyAnswers={(student.survey_answers as Record<string, unknown>) || null}
      placementTestDone={student.placement_test_done ?? false}
      placementBooking={(placementBooking as { id: string; scheduled_at: string; status: string } | null) || null}
      completedTotal={completedTotal || 0}
      totalHours={totalHours}
      completedThisMonth={completedThisMonth || 0}
      upcomingClasses={upcomingClasses || 0}
      recentBookings={(recentBookings || []) as {
        id: string
        scheduled_at: string
        duration_minutes: number
        notes?: unknown
      }[]}
    />
  )
}
