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
        placementScheduled={false}
        placementBookingAt={null}
        completedTotal={0}
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

  console.log('[progreso] student:', student.id, 'level:', student.level, 'classes_remaining:', student.classes_remaining, 'placement_test_done:', student.placement_test_done, 'placement_scheduled:', student.placement_scheduled)

  const { data: placementBooking } = await supabase
    .from('bookings')
    .select('scheduled_at')
    .eq('student_id', studentId)
    .eq('type', 'placement_test')
    .in('status', ['confirmed', 'pending'])
    .maybeSingle()

  const [
    { count: completedTotal },
    { count: completedThisMonth },
    { count: upcomingClasses },
    { data: recentBookings },
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
  ])

  console.log('[progreso] completedTotal:', completedTotal, 'completedThisMonth:', completedThisMonth, 'upcomingClasses:', upcomingClasses, 'recentBookings:', recentBookings?.length ?? 0)

  return (
    <ProgresoClient
      lang={lang as Locale}
      level={student.level || null}
      classesRemaining={student.classes_remaining || 0}
      currentPlan={(student.current_plan as string) || null}
      surveyAnswers={(student.survey_answers as Record<string, unknown>) || null}
      placementTestDone={student.placement_test_done ?? false}
      placementScheduled={student.placement_scheduled ?? false}
      placementBookingAt={placementBooking?.scheduled_at || null}
      completedTotal={completedTotal || 0}
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
