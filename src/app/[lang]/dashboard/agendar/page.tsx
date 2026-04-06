import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgendarClient from './AgendarClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

export default async function AgendarPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: student } = await supabase
    .from('students')
    .select('id, classes_remaining, intake_done')
    .eq('profile_id', user.id)
    .single()

  if (!student) redirect(`/${lang}/dashboard`)

  // No classes → buy first
  if ((student.classes_remaining || 0) <= 0) {
    redirect(`/${lang}/dashboard/plan`)
  }

  // Intake not done → complete profile first
  if (!student.intake_done) {
    redirect(`/${lang}/dashboard/intake`)
  }

  // Fetch all active teachers with their availability slots
  const { data: teachersRaw } = await supabase
    .from('teachers')
    .select(`
      id,
      bio,
      hourly_rate,
      specializations,
      rating,
      total_sessions,
      profile:profiles(full_name, avatar_url),
      slots:availability_slots(id, day_of_week, start_time, end_time)
    `)
    .eq('is_active', true)
    .order('rating', { ascending: false })

  // Only include teachers who have availability slots
  const teachers = (teachersRaw || []).filter((t: any) => (t.slots || []).length > 0)

  return (
    <AgendarClient
      lang={lang as Locale}
      studentId={student.id}
      classesRemaining={student.classes_remaining || 0}
      teachers={teachers as any}
    />
  )
}
