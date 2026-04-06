import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TeacherProfileClient from './TeacherProfileClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string; teacherId: string }>
}

export default async function TeacherProfilePage({ params }: Props) {
  const { lang, teacherId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: teacher } = await supabase
    .from('teachers')
    .select(`
      id,
      bio,
      hourly_rate,
      specializations,
      rating,
      total_sessions,
      is_active,
      profile:profiles(full_name, avatar_url)
    `)
    .eq('id', teacherId)
    .single()

  if (!teacher) notFound()

  // Get student info
  const { data: student } = await supabase
    .from('students')
    .select('id, classes_remaining')
    .eq('profile_id', user.id)
    .single()

  // Get teacher's recurring availability slots
  const { data: slots } = await supabase
    .from('availability_slots')
    .select('id, day_of_week, start_time, end_time')
    .eq('teacher_id', teacherId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <TeacherProfileClient
      lang={lang as Locale}
      teacher={teacher as any}
      availabilitySlots={(slots as any) || []}
      studentId={student?.id || null}
      classesRemaining={student?.classes_remaining || 0}
    />
  )
}
