import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sanitizeQuestion,
  aggregateAttempts,
  scoringAttemptIndex,
  isGradingMethod,
  type BankQuestionRow,
  type SanitizedQuestion,
  type GradingMethod,
} from '@/lib/lab/grading'
import LabQuizClient from './LabQuizClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string; assignmentId: string }>
  searchParams: Promise<{ intentar?: string }>
}

// Fisher–Yates. Used for: matching pools (already sorted in sanitizeQuestion, this
// adds presentation randomness), MCQ option order (shuffleAnswers — options carry
// their original bank .idx so grading is untouched), and question order
// (shuffleQuestions — graded by qid, order-independent). Math.random server-side
// is fine; each page load (= each attempt) gets a fresh order, frozen in client state.
function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

// The Lab — student quiz player (STEP 3c + multi-attempt). The server reads the
// quiz + questions and STRIPS answer keys before anything reaches the client
// (gated-pricing leak lesson). Auto-grading happens server-side in
// submitQuizAttempt, never here. "retake always allowed" up to attempts_allowed.
export default async function LabQuizPage({ params, searchParams }: Props) {
  const { lang, assignmentId } = await params
  const { intentar } = await searchParams
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
    .select('id, title, intro, question_ids, settings, status, teacher:teachers(profile:profiles(full_name))')
    .eq('id', assignment.quiz_id)
    .maybeSingle()
  if (!quiz) redirect(`/${lang}/dashboard/lab`)

  // The teacher→profile embed comes back as nested arrays from PostgREST.
  const teacher = Array.isArray(quiz.teacher) ? quiz.teacher[0] : quiz.teacher
  const profileRaw = (teacher as { profile?: unknown } | null)?.profile
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
  const teacherName =
    (profile as { full_name?: string | null } | null)?.full_name ||
    (lang === 'es' ? 'Tu maestro' : 'Your teacher')

  // Settings drive attempts, grading method, review reveal, and shuffle.
  const s = (quiz.settings && typeof quiz.settings === 'object' && !Array.isArray(quiz.settings)
    ? (quiz.settings as Record<string, unknown>)
    : {})
  const attemptsAllowed = typeof s.attemptsAllowed === 'number' && s.attemptsAllowed >= 1 ? Math.min(20, Math.floor(s.attemptsAllowed)) : 1
  const gradingMethod: GradingMethod = isGradingMethod(s.gradingMethod) ? s.gradingMethod : 'greatest'
  const reviewAfter = s.reviewAfter !== false
  const shuffleQuestions = s.shuffleQuestions === true
  const shuffleAnswers = s.shuffleAnswers === true

  // All attempts so far, oldest→newest (for first/last aggregation + latest detail).
  const { data: attemptRows } = await admin
    .from('lab_quiz_attempts')
    .select('attempt_number, questions_snapshot, answers, auto_score, max_score, teacher_feedback, graded_at')
    .eq('assignment_id', assignment.id)
    .order('attempt_number', { ascending: true })
  const attempts = (attemptRows as Array<Record<string, unknown>> | null) || []
  const isOpen = assignment.status === 'open' && quiz.status !== 'cancelled'
  const canRetry = isOpen && attempts.length < attemptsAllowed
  const wantRetry = intentar === '1' && canRetry

  // ── PLAY: no attempt yet (open), or an explicit retake with attempts left. ──
  if ((attempts.length === 0 && isOpen) || wantRetry) {
    const baseIds = (Array.isArray(quiz.question_ids) ? quiz.question_ids : []).filter(
      (x): x is string => typeof x === 'string',
    )
    const orderedIds = shuffleQuestions ? shuffle(baseIds) : baseIds
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
      // shuffleAnswers reorders MCQ options for display ONLY; each option keeps its
      // bank .idx, so the grader (which indexes the unsanitized bank) is untouched.
      .map((q) => ((q.type === 'mcq_single' || q.type === 'mcq_multi') && shuffleAnswers && q.options ? { ...q, options: shuffle(q.options) } : q))

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
        attemptNumber={attempts.length + 1}
        attemptsAllowed={attemptsAllowed}
      />
    )
  }

  // ── REVIEW: at least one attempt exists. ──
  if (attempts.length > 0) {
    const scored = attempts.map((a) => ({ autoScore: Number(a.auto_score ?? 0), maxScore: Number(a.max_score ?? 0) }))
    const agg = aggregateAttempts(scored, gradingMethod)
    // Show the attempt the aggregate actually scored (MA-02), not always the latest.
    const idx = scoringAttemptIndex(scored, gradingMethod)
    const shown = attempts[idx >= 0 ? idx : attempts.length - 1]
    const shownSnap = ((shown.questions_snapshot as unknown as (SanitizedQuestion & { outcome?: string })[]) || [])
    const pendingCount = shownSnap.filter((q) => q?.outcome === 'pending').length
    return (
      <LabQuizClient
        lang={lang as Locale}
        mode="review"
        assignmentId={assignment.id}
        title={quiz.title}
        intro={quiz.intro}
        teacherName={teacherName}
        review={{
          // Per-question detail + the student's own answers ship ONLY when the teacher
          // allowed review-after. With it OFF we send NO per-question outcomes/answers:
          // outcome + own-answer can reconstruct a binary key, and the new retake path
          // would weaponize that (GRADE-OUTCOME-LEAK). Column grants (migration 057)
          // close the matching direct-REST read vector.
          questions: reviewAfter ? shownSnap : [],
          answers: reviewAfter ? ((shown.answers as Record<string, unknown>) || {}) : {},
          autoScore: agg.autoScore,
          maxScore: agg.maxScore,
          pendingCount,
          teacherFeedback: (shown.teacher_feedback as string | null) ?? null,
          graded: !!shown.graded_at,
          reviewAfter,
          attemptCount: attempts.length,
          attemptsAllowed,
          gradingMethod,
          canRetry,
        }}
      />
    )
  }

  // No attempt yet and the assignment / quiz is closed → gentle closed state.
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
