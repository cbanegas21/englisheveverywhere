import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import LabFeedClient from './LabFeedClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

// The Lab — STEP 0 shell (zero schema). Re-skins EXISTING data (open assignments,
// the AI cuaderno vocabulary persisted by migration 053, completed-class count)
// into the §8.2 feed so the surface ships before any new tables land. Strictly
// credit-neutral: it only READS, never touches credits/Stripe/payouts/sessions.
export default async function LabPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()
  const { data: student } = await admin
    .from('students')
    .select('id, classes_remaining')
    .eq('profile_id', user.id)
    .maybeSingle()
  // No students row = onboarding unfinished — mirror the dashboard home guard
  // instead of rendering an all-empty feed (SH-COLD-01).
  if (!student) redirect(`/${lang}/onboarding`)
  const studentId = student.id

  // Booking ids for the latest-vocab read. A robust two-step (vs a filtered
  // embed) so the "De tu última clase" card never silently misses.
  const { data: bookingRows } = await admin
    .from('bookings')
    .select('id')
    .eq('student_id', studentId)
  const bookingIds = (bookingRows || []).map((b: { id: string }) => b.id)

  const [{ data: assignments }, { count: completedCount }, { data: quizAssignments }] = await Promise.all([
    admin
      .from('assignments')
      // The submission embed lets us drop already-submitted homework below:
      // status stays 'open' after submit/grade (only cancel changes it), so
      // status alone would count finished homework as pending forever.
      .select('id, title, status, created_at, submission:assignment_submissions(id), teacher:teachers(profile:profiles(full_name))')
      .eq('student_id', studentId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('type', 'class')
      .eq('status', 'completed'),
    admin
      .from('lab_quiz_assignments')
      .select('id, created_at, quiz:lab_quizzes(title)')
      .eq('student_id', studentId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  // Which assigned quizzes already have a (single) attempt → show "review" vs "start".
  const quizAssignmentIds = ((quizAssignments as { id: string }[]) || []).map((q) => q.id)
  let attemptedQuizIds = new Set<string>()
  if (quizAssignmentIds.length) {
    const { data: attempts } = await admin
      .from('lab_quiz_attempts')
      .select('assignment_id')
      .in('assignment_id', quizAssignmentIds)
    attemptedQuizIds = new Set(((attempts as { assignment_id: string }[]) || []).map((a) => a.assignment_id))
  }

  const labQuizzes = ((quizAssignments as unknown[]) || []).map((row) => {
    const r = row as { id: string; quiz?: unknown }
    const quiz = Array.isArray(r.quiz) ? r.quiz[0] : r.quiz
    const titleVal = (quiz as { title?: string | null } | null)?.title
    return { id: r.id, title: titleVal || 'Quiz', done: attemptedQuizIds.has(r.id) }
  })

  // Files a teacher has shared with this student (§8.4) — opened read-only via an
  // entitlement-gated signed URL.
  const { data: sharedFileRows } = await admin
    .from('lab_file_shares')
    .select('shared_at, file:lab_teacher_files(id, file_name, description, mime_type)')
    .eq('student_id', studentId)
    .order('shared_at', { ascending: false })
    .limit(8)
  const sharedFiles = ((sharedFileRows as unknown[]) || [])
    .map((row) => {
      const r = row as { file?: unknown }
      const f = Array.isArray(r.file) ? r.file[0] : r.file
      const fr = f as { id?: string; file_name?: string; description?: string; mime_type?: string } | null
      return fr && fr.id
        ? { id: fr.id, fileName: fr.file_name || (lang === 'es' ? 'Archivo' : 'File'), description: fr.description || '', mimeType: fr.mime_type || '' }
        : null
    })
    .filter((x): x is { id: string; fileName: string; description: string; mimeType: string } => x !== null)

  // Latest completed session that captured vocabulary (the cuaderno we now persist).
  let rawVocab: unknown = null
  if (bookingIds.length) {
    const { data: lastSession } = await admin
      .from('sessions')
      .select('vocabulary, ended_at')
      .in('booking_id', bookingIds)
      .not('vocabulary', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    rawVocab = (lastSession as { vocabulary?: unknown } | null)?.vocabulary ?? null
  }

  const lastClassVocab = Array.isArray(rawVocab)
    ? (rawVocab as Array<{ word?: unknown; translation?: unknown; example?: unknown }>)
        .filter((v) => v && typeof v.word === 'string' && typeof v.translation === 'string')
        .map((v) => ({
          word: String(v.word),
          translation: String(v.translation),
          example: typeof v.example === 'string' ? v.example : '',
        }))
        .slice(0, 8)
    : []

  // The teacher→profile embed comes back as nested arrays from PostgREST; normalize
  // either shape (mirrors the dashboard home's conductor/teacher name handling).
  const openAssignments = ((assignments as unknown[]) || [])
    .filter((row) => {
      // Already-submitted homework is done from the student's side — it must
      // not sit in "de parte de tu maestro" (nor the hero count) forever.
      const sub = (row as { submission?: unknown }).submission
      return !(Array.isArray(sub) ? sub[0] : sub)
    })
    .slice(0, 4)
    .map((row) => {
    const a = row as { id: string; title: string; teacher?: unknown }
    const teacher = Array.isArray(a.teacher) ? a.teacher[0] : a.teacher
    const profileRaw = (teacher as { profile?: unknown } | null)?.profile
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
    const fullName = (profile as { full_name?: string | null } | null)?.full_name
    return {
      id: a.id,
      title: a.title,
      teacher_name: fullName || (lang === 'es' ? 'Maestro' : 'Teacher'),
    }
  })

  const name =
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    (lang === 'es' ? 'Estudiante' : 'Student')

  return (
    <LabFeedClient
      lang={lang as Locale}
      userName={name}
      openAssignments={openAssignments}
      labQuizzes={labQuizzes}
      sharedFiles={sharedFiles}
      lastClassVocab={lastClassVocab}
      stats={{
        completedClasses: completedCount || 0,
        classesRemaining: student.classes_remaining || 0,
        lastClassWords: lastClassVocab.length,
      }}
    />
  )
}
