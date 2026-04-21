import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StudentTareasClient from './StudentTareasClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

export default async function StudentTareasPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()
  const { data: student } = await admin
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!student) redirect(`/${lang}/dashboard`)

  const { data: assignments } = await admin
    .from('assignments')
    .select(`
      id, title, instructions, due_at, status, created_at,
      teacher:teachers(profile:profiles(full_name)),
      submission:assignment_submissions(id, submitted_text, submitted_at, teacher_feedback, score, graded_at)
    `)
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })

  const rows = (assignments || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    instructions: a.instructions,
    due_at: a.due_at,
    status: a.status,
    created_at: a.created_at,
    teacher_name: a.teacher?.profile?.full_name || 'Teacher',
    submission: a.submission?.[0]
      ? {
          id: a.submission[0].id,
          text: a.submission[0].submitted_text,
          submitted_at: a.submission[0].submitted_at,
          feedback: a.submission[0].teacher_feedback,
          score: a.submission[0].score,
          graded_at: a.submission[0].graded_at,
        }
      : null,
  }))

  return <StudentTareasClient lang={lang as Locale} assignments={rows} />
}
