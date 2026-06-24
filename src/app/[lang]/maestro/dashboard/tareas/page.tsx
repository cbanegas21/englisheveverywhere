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
  if (!teacher) redirect(`/${lang}/onboarding`)

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
      id, title, instructions, rubric, attachment_name, due_at, status, created_at, student_id,
      student:students(profile:profiles(full_name)),
      submission:assignment_submissions(id, submitted_text, submitted_at, teacher_feedback, score, graded_at, attachment_name, audio_feedback_name)
    `)
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false })

  const rows = (assignments || []).map((a: any) => {
    // assignment_submissions.assignment_id is UNIQUE (migration 017), so PostgREST
    // returns this to-one embed as an OBJECT — reading it as `a.submission?.[0]`
    // is always undefined, so the teacher would NEVER see submissions and could
    // not grade. The student page was fixed for this in 47f0693; mirror it here.
    const sub = Array.isArray(a.submission) ? a.submission[0] : a.submission
    return {
      id: a.id,
      title: a.title,
      instructions: a.instructions,
      rubric: a.rubric || null,
      attachment_name: a.attachment_name || null,
      due_at: a.due_at,
      status: a.status,
      created_at: a.created_at,
      student_id: a.student_id,
      student_name: a.student?.profile?.full_name || 'Student',
      submission: sub
        ? {
            id: sub.id,
            text: sub.submitted_text,
            submitted_at: sub.submitted_at,
            feedback: sub.teacher_feedback,
            score: sub.score,
            graded_at: sub.graded_at,
            attachment_name: sub.attachment_name || null,
            audio_feedback_name: sub.audio_feedback_name || null,
          }
        : null,
    }
  })

  return <TeacherTareasClient lang={lang as Locale} students={students} assignments={rows} />
}
