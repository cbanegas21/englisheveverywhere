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

  const rows = (assignments || []).map((a: any) => {
    // PostgREST returns this to-one submission embed as an OBJECT (it was being
    // read as `a.submission?.[0]`, which is always undefined → submissions never
    // rendered: submitted work stayed "open", graded work showed an editable box).
    // Normalize either an array or object shape before reading it.
    const sub = Array.isArray(a.submission) ? a.submission[0] : a.submission
    return {
      id: a.id,
      title: a.title,
      instructions: a.instructions,
      due_at: a.due_at,
      status: a.status,
      created_at: a.created_at,
      // Localized fallback so ES students never see hardcoded English (mirrors
      // the BROWSE-01 fix in maestros/page.tsx).
      teacher_name: a.teacher?.profile?.full_name || (lang === 'es' ? 'Maestro' : 'Teacher'),
      submission: sub
        ? {
            id: sub.id,
            text: sub.submitted_text,
            submitted_at: sub.submitted_at,
            feedback: sub.teacher_feedback,
            score: sub.score,
            graded_at: sub.graded_at,
          }
        : null,
    }
  })

  return <StudentTareasClient lang={lang as Locale} assignments={rows} />
}
