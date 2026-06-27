import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sanitizeQuestion,
  aggregateAttempts,
  isGradingMethod,
  type BankQuestionRow,
  type SanitizedQuestion,
  type GradingMethod,
} from '@/lib/lab/grading'
import TeacherReviewClient from './TeacherReviewClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string; quizId: string }> }

// Format the correct answer of an UNSANITIZED bank question for the teacher's eyes
// only (this page is teacher-gated). Lets the teacher see the key while grading even
// when the quiz has review-after OFF, where the student snapshot has keys stripped
// (REVIEW-02). The frozen snapshot stays authoritative for what the student saw.
function correctText(q: SanitizedQuestion, lang: string): string {
  const T = lang === 'es' ? { t: 'Verdadero', f: 'Falso' } : { t: 'True', f: 'False' }
  if (q.type === 'mcq_single' || q.type === 'mcq_multi')
    return (q.options || []).filter((o) => o.correct).map((o) => o.text).join(', ') || '—'
  if (q.type === 'true_false') return q.answer === undefined ? '—' : q.answer ? T.t : T.f
  if (q.type === 'short_answer') return (q.accepted || []).join('  /  ') || '—'
  if (q.type === 'matching') return (q.pairs || []).map((p) => `${p.left} → ${p.right}`).join(';  ') || '—'
  return q.guidance || '—'
}

// The Lab STEP 3d + multi-attempt — teacher attempt review. Each attempt is rendered
// from its OWN frozen questions_snapshot (NOT the live bank), so a later question edit
// can't mislabel what the student actually answered or change a committed grade — the
// snapshot is authoritative post-submit (migration 054 invariant). The teacher-only
// correct-answer reference (keyByQuestion) is read live from the bank. Grading is
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
    .select('id, title, teacher_id, question_ids, settings')
    .eq('id', quizId)
    .maybeSingle()
  if (!quiz || quiz.teacher_id !== teacher.id) redirect(`/${lang}/maestro/dashboard/quizzes`)

  const s = (quiz.settings && typeof quiz.settings === 'object' && !Array.isArray(quiz.settings)
    ? (quiz.settings as Record<string, unknown>)
    : {})
  const gradingMethod: GradingMethod = isGradingMethod(s.gradingMethod) ? s.gradingMethod : 'greatest'

  // Teacher-only correct-answer reference, read live from the bank (REVIEW-02).
  const qids = (Array.isArray(quiz.question_ids) ? quiz.question_ids : []).filter((x): x is string => typeof x === 'string')
  const { data: bankRows } = await admin
    .from('lab_question_bank')
    .select('id, type, prompt, payload')
    .in('id', qids.length ? qids : ['00000000-0000-0000-0000-000000000000'])
  const keyByQuestion: Record<string, string> = {}
  for (const r of (bankRows || [])) {
    const sani = sanitizeQuestion(r as BankQuestionRow, true)
    if (sani) keyByQuestion[sani.id] = correctText(sani, lang)
  }

  const { data: assignmentRows } = await admin
    .from('lab_quiz_assignments')
    .select(
      'id, status, created_at, student:students(profile:profiles(full_name)), attempts:lab_quiz_attempts(id, attempt_number, auto_score, max_score, teacher_feedback, graded_at, answers, questions_snapshot)',
    )
    .eq('quiz_id', quiz.id)
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false })

  const rows = ((assignmentRows as unknown[]) || []).map((row) => {
    const r = row as Record<string, unknown>
    const st = Array.isArray(r.student) ? r.student[0] : r.student
    const prof = (st as { profile?: unknown } | null)?.profile
    const profRec = Array.isArray(prof) ? prof[0] : prof
    const studentName =
      (profRec as { full_name?: string | null } | null)?.full_name || (lang === 'es' ? 'Estudiante' : 'Student')

    const rawAttempts = Array.isArray(r.attempts) ? (r.attempts as Record<string, unknown>[]) : []
    const attempts = rawAttempts
      .map((a) => ({
        attemptId: a.id as string,
        attemptNumber: Number(a.attempt_number ?? 1),
        autoScore: Number(a.auto_score ?? 0),
        maxScore: Number(a.max_score ?? 0),
        graded: !!a.graded_at,
        teacherFeedback: String(a.teacher_feedback ?? ''),
        answers: (a.answers as Record<string, unknown>) || {},
        questions: Array.isArray(a.questions_snapshot)
          ? (a.questions_snapshot as (SanitizedQuestion & { outcome?: string })[])
          : [],
      }))
      .sort((a, b) => a.attemptNumber - b.attemptNumber)

    const official = attempts.length
      ? aggregateAttempts(attempts.map((a) => ({ autoScore: a.autoScore, maxScore: a.maxScore })), gradingMethod)
      : null

    return { assignmentId: r.id as string, status: r.status as string, studentName, attempts, official }
  })

  return (
    <TeacherReviewClient
      lang={lang as Locale}
      quizTitle={quiz.title}
      rows={rows}
      keyByQuestion={keyByQuestion}
      gradingMethod={gradingMethod}
    />
  )
}
