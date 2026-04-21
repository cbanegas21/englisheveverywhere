import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TeacherTareasClient from './TeacherTareasClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

export default async function MaestroTareasPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'teacher') redirect(`/${lang}/dashboard`)

  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!teacher) redirect(`/${lang}/maestro/pending`)

  // Pull the teacher's students via non-cancelled bookings — mirrors the
  // gate used by teacherSetStudentLevel / createAssignment.
  const { data: bookings } = await admin
    .from('bookings')
    .select('student_id, student:students(id, profile:profiles(full_name))')
    .eq('teacher_id', teacher.id)
    .neq('status', 'cancelled')

  const studentMap = new Map<string, { id: string; name: string }>()
  for (const b of bookings || []) {
    const s = (b as any).student
    if (!s?.id) continue
    if (!studentMap.has(s.id)) {
      studentMap.set(s.id, { id: s.id, name: s.profile?.full_name || 'Student' })
    }
  }
  const students = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  // All assignments this teacher owns + their submission (if any).
  const { data: assignments } = await admin
    .from('assignments')
    .select(`
      id, title, instructions, due_at, status, created_at, student_id,
      student:students(profile:profiles(full_name)),
      submission:assignment_submissions(id, submitted_text, submitted_at, teacher_feedback, score, graded_at)
    `)
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false })

  const rows = (assignments || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    instructions: a.instructions,
    due_at: a.due_at,
    status: a.status,
    created_at: a.created_at,
    student_id: a.student_id,
    student_name: a.student?.profile?.full_name || 'Student',
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

  return <TeacherTareasClient lang={lang as Locale} students={students} assignments={rows} />
}
