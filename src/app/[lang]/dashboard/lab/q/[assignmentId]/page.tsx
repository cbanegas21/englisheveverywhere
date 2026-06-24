import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeQuestion, type BankQuestionRow, type SanitizedQuestion } from '@/lib/lab/grading'
import LabQuizClient from './LabQuizClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string; assignmentId: string }> }

// Fisher–Yates. Matching answers are graded by right-side TEXT, so shuffling the
// pool can't change the grade — it only stops the player from leaking the pairing
// (rights[i] aligned to lefts[i] is the answer). Done here, server-side, so the
// decoupled order is all the client ever receives.
function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

// The Lab — student quiz player (STEP 3c). The server reads the quiz + questions
// and STRIPS answer keys before anything reaches the client (gated-pricing leak
// lesson). Auto-grading happens server-side in submitQuizAttempt, never here.
export default async function LabQuizPage({ params }: Props) {
  const { lang, assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()
  const { data: student } = await admin.from('students').select('id').eq('profile_id', user.id).maybeSingle()
  if (!student) redirect(`/${lang}/onboarding`)

  // Assignment must target THIS student. Redirect (not notFound) so we don't even
  // confirm the id exists to a non-owner.
  const { data: assignment } = await admin
    .from('lab_quiz_assignments')
    .select('id, quiz_id, student_id, status')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!assignment || assignment.student_id !== student.id) redirect(`/${lang}/dashboard/lab`)

  const { data: quiz } = await admin
    .from('lab_quizzes')
    .select('id, title, intro, question_ids, status, teacher:teachers(profile:profiles(full_name))')
    .eq('id', assignment.quiz_id)
    .maybeSingle()
  if (!quiz) redirect(`/${lang}/dashboard/lab`)

  // The teacher→profile embed comes back as nested arrays from PostgREST.
  const teacher = Array.isArray(quiz.teacher) ? quiz.teacher[0] : quiz.teacher
  const profileRaw = (teacher as { profile?: unknown } | null)?.profile
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
  const teacherName =
    (profile as { full_name?: string | null } | null)?.full_name ||
    (lang === 'es' ? 'Tu maestro·a' : 'Your teacher')

  // Already submitted? Render the FROZEN snapshot (keys present only if the quiz
  // allowed review-after; decided at submit time).
  const { data: attempt } = await admin
    .from('lab_quiz_attempts')
    .select('questions_snapshot, answers, auto_score, max_score, teacher_feedback, graded_at')
    .eq('assignment_id', assignment.id)
    .maybeSingle()

  if (attempt) {
    return (
      <LabQuizClient
        lang={lang as Locale}
        mode="review"
        assignmentId={assignment.id}
        title={quiz.title}
        intro={quiz.intro}
        teacherName={teacherName}
        review={{
          questions: ((attempt.questions_snapshot as unknown as (SanitizedQuestion & { outcome?: string })[]) || []),
          answers: ((attempt.answers as Record<string, unknown>) || {}),
          autoScore: attempt.auto_score ?? 0,
          maxScore: attempt.max_score ?? 0,
          teacherFeedback: attempt.teacher_feedback ?? null,
          graded: !!attempt.graded_at,
        }}
      />
    )
  }

  // No attempt yet but the assignment / quiz is closed → gentle closed state.
  if (assignment.status !== 'open' || quiz.status === 'cancelled') {
    return (
      <LabQuizClient
        lang={lang as Locale}
        mode="closed"
        assignmentId={assignment.id}
        title={quiz.title}
        intro={quiz.intro}
        teacherName={teacherName}
      />
    )
  }

  // Play mode — read the questions in the quiz's order, STRIP keys, shuffle
  // matching pools.
  const orderedIds = (Array.isArray(quiz.question_ids) ? quiz.question_ids : []).filter(
    (x): x is string => typeof x === 'string',
  )
  const { data: rows } = await admin
    .from('lab_question_bank')
    .select('id, type, prompt, payload')
    .in('id', orderedIds.length ? orderedIds : ['00000000-0000-0000-0000-000000000000'])
  const byId = new Map((rows || []).map((r) => [r.id as string, r as BankQuestionRow]))
  const questions = orderedIds
    .map((id) => byId.get(id))
    .filter((q): q is BankQuestionRow => !!q)
    .map((q) => sanitizeQuestion(q, false))
    .filter((q): q is SanitizedQuestion => q !== null)
    .map((q) => (q.type === 'matching' && q.rights ? { ...q, rights: shuffle(q.rights) } : q))

  if (questions.length === 0) redirect(`/${lang}/dashboard/lab`)

  return (
    <LabQuizClient
      lang={lang as Locale}
      mode="play"
      assignmentId={assignment.id}
      title={quiz.title}
      intro={quiz.intro}
      teacherName={teacherName}
      questions={questions}
    />
  )
}
