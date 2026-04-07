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
    .select('id, level, classes_remaining, current_plan, survey_answers, placement_test_done')
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
        completedTotal={0}
        completedThisMonth={0}
        recentBookings={[]}
      />
    )
  }

  const studentId = student.id

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { count: completedTotal },
    { count: completedThisMonth },
    { data: recentBookings },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'completed'),

    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .gte('scheduled_at', startOfMonth.toISOString()),

    supabase
      .from('bookings')
      .select('id, scheduled_at, duration_minutes, notes')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false })
      .limit(8),
  ])

  return (
    <ProgresoClient
      lang={lang as Locale}
      level={student.level || null}
      classesRemaining={student.classes_remaining || 0}
      currentPlan={(student.current_plan as string) || null}
      surveyAnswers={(student.survey_answers as Record<string, unknown>) || null}
      placementTestDone={student.placement_test_done ?? false}
      completedTotal={completedTotal || 0}
      completedThisMonth={completedThisMonth || 0}
      recentBookings={(recentBookings || []) as {
        id: string
        scheduled_at: string
        duration_minutes: number
        notes?: unknown
      }[]}
    />
  )
}
