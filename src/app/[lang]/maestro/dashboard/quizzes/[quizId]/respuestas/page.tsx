import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SanitizedQuestion } from '@/lib/lab/grading'
import TeacherReviewClient from './TeacherReviewClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string; quizId: string }> }

// The Lab STEP 3d — teacher attempt review. Each attempt is rendered from its OWN
// frozen questions_snapshot (NOT the live bank), so a later question edit can't
// mislabel what the student actually answered or change a committed grade — the
// snapshot is authoritative post-submit (migration 054 invariant). Grading is
// committed server-side via gradeQuizAttempt. Maestro layout enforces role +
// is_active; we additionally verify quiz ownership here.
export default async function QuizResponsesPage({ params }: Props) {
  const { lang, quizId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()
  const { data: teacher } = await admin.from('teachers').select('id').eq('profile_id', user.id).maybeSingle()
  if (!teacher) redirect(`/${lang}/maestro/dashboard`)

  const { data: quiz } = await admin
    .from('lab_quizzes')
    .select('id, title, teacher_id')
    .eq('id', quizId)
    .maybeSingle()
  if (!quiz || quiz.teacher_id !== teacher.id) redirect(`/${lang}/maestro/dashboard/quizzes`)

  const { data: assignmentRows } = await admin
    .from('lab_quiz_assignments')
    .select(
      'id, status, created_at, student:students(profile:profiles(full_name)), attempt:lab_quiz_attempts(id, auto_score, max_score, teacher_feedback, graded_at, answers, questions_snapshot)',
    )
    .eq('quiz_id', quiz.id)
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false })

  const attempts = ((assignmentRows as unknown[]) || []).map((row) => {
    const r = row as Record<string, unknown>
    const st = Array.isArray(r.student) ? r.student[0] : r.student
    const prof = (st as { profile?: unknown } | null)?.profile
    const profRec = Array.isArray(prof) ? prof[0] : prof
    const studentName =
      (profRec as { full_name?: string | null } | null)?.full_name || (lang === 'es' ? 'Estudiante' : 'Student')
    const at = Array.isArray(r.attempt) ? r.attempt[0] : r.attempt
    const a = (at as Record<string, unknown>) || null
    const snap =
      a && Array.isArray(a.questions_snapshot)
        ? (a.questions_snapshot as (SanitizedQuestion & { outcome?: string })[])
        : []
    return {
      assignmentId: r.id as string,
      status: r.status as string,
      attemptId: a ? (a.id as string) : null,
      submitted: !!a,
      autoScore: a ? Number(a.auto_score ?? 0) : 0,
      maxScore: a ? Number(a.max_score ?? 0) : 0,
      graded: a ? !!a.graded_at : false,
      teacherFeedback: a ? String(a.teacher_feedback ?? '') : '',
      answers: a ? ((a.answers as Record<string, unknown>) || {}) : {},
      questions: snap,
      studentName,
    }
  })

  return <TeacherReviewClient lang={lang as Locale} quizTitle={quiz.title} attempts={attempts} />
}
