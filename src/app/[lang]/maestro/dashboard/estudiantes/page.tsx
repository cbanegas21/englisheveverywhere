import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EstudiantesClient from './EstudiantesClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function EstudiantesPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: teacherData } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacherData) redirect(`/${lang}/maestro/dashboard`)

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      student_id,
      scheduled_at,
      status,
      student:students(
        level,
        learning_goal,
        work_description,
        learning_style,
        age_range,
        profile:profiles(full_name, avatar_url)
      )
    `)
    .eq('teacher_id', teacherData.id)
    .order('scheduled_at', { ascending: false })

  return (
    <EstudiantesClient
      lang={lang as Locale}
      bookings={(bookings as any) || []}
    />
  )
}
