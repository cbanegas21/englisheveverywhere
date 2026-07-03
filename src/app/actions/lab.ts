'use server'

// The Lab — server actions. Mirrors src/app/actions/assignments.ts exactly:
// RLS-read + service-role-write, every mutation gated by auth + role + ownership,
// raw PG errors logged (never reflected), localized {error} returned (never
// thrown). Credit-neutral: nothing here touches credits/Stripe/payouts/bookings/
// sessions. STEP 2 = the teacher question bank; quiz engine + folder land in
// later steps in this same file.

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gradeAttempt, sanitizeQuestion, type BankQuestionRow } from '@/lib/lab/grading'
import { LAB_FILES_BUCKET, FILE_URL_TTL, MAX_FILE_BYTES, ALLOWED_FILE_TYPES, magicMatches } from '@/lib/lab/files'
import { checkUserActionLimit } from '@/lib/rateLimit'

// Postgres unique-violation — the single-attempt UNIQUE(assignment_id) guard on
// lab_quiz_attempts surfaces this when two submits race the same assignment.
function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '23505' || !!error?.message?.toLowerCase().includes('duplicate')
}

// ── Localized, user-safe errors ──────────────────────────────────────────
const L_MSG = {
  notAuth: { es: 'No autenticado.', en: 'Not authenticated.' },
  teacherRole: { es: 'Se requiere una cuenta de maestro.', en: 'Teacher account required.' },
  teacherNotFound: { es: 'No se encontró el registro de maestro.', en: 'Teacher record not found.' },
  teacherInactive: { es: 'Tu cuenta de maestro no está activa.', en: 'Teacher account is not active.' },
  promptRequired: { es: 'El enunciado es obligatorio.', en: 'The prompt is required.' },
  invalidType: { es: 'Tipo de pregunta inválido.', en: 'Invalid question type.' },
  invalidPayload: { es: 'La pregunta está incompleta o mal formada.', en: 'The question is incomplete or malformed.' },
  needOptions: { es: 'Agrega al menos dos opciones con texto.', en: 'Add at least two options with text.' },
  needCorrect: { es: 'Marca al menos una opción correcta.', en: 'Mark at least one correct option.' },
  needAccepted: { es: 'Agrega al menos una respuesta aceptada.', en: 'Add at least one accepted answer.' },
  needPairs: { es: 'Agrega al menos dos parejas completas.', en: 'Add at least two complete pairs.' },
  notYours: { es: 'Esta pregunta no es tuya.', en: 'Not your question.' },
  questionNotFound: { es: 'Pregunta no encontrada.', en: 'Question not found.' },
  titleRequired: { es: 'El título es obligatorio.', en: 'Title is required.' },
  quizNotFound: { es: 'Quiz no encontrado.', en: 'Quiz not found.' },
  noQuestions: { es: 'Agrega al menos una pregunta antes de publicar.', en: 'Add at least one question before publishing.' },
  noBooking: { es: 'No tienes ninguna reserva con este estudiante.', en: 'You have no booking with this student.' },
  notPublished: { es: 'Publica el quiz antes de asignarlo.', en: 'Publish the quiz before assigning it.' },
  alreadyAssigned: { es: 'Este quiz ya está asignado a este estudiante.', en: 'This quiz is already assigned to this student.' },
  assignmentNotFound: { es: 'Asignación no encontrada.', en: 'Assignment not found.' },
  studentNotFound: { es: 'No se encontró tu perfil de estudiante.', en: 'Student record not found.' },
  assignmentClosed: { es: 'Este quiz ya no está disponible.', en: 'This quiz is no longer available.' },
  alreadyAttempted: { es: 'Ya enviaste este quiz.', en: 'You already submitted this quiz.' },
  attemptsExhausted: { es: 'Ya usaste todos tus intentos en este quiz.', en: 'You have used all your attempts on this quiz.' },
  attemptNotFound: { es: 'Envío no encontrado.', en: 'Submission not found.' },
  nothingToGrade: { es: 'Escribe una nota o ajusta una respuesta.', en: 'Write a note or adjust an answer.' },
  fileRequired: { es: 'Selecciona un archivo.', en: 'Select a file.' },
  fileTooLarge: { es: 'El archivo supera el límite de 25 MB.', en: 'The file exceeds the 25 MB limit.' },
  fileType: { es: 'Tipo de archivo no permitido.', en: 'File type not allowed.' },
  fileNotFound: { es: 'Archivo no encontrado.', en: 'File not found.' },
  urlFailed: { es: 'No se pudo abrir el archivo. Inténtalo de nuevo.', en: 'Could not open the file. Please try again.' },
  saveFailed: { es: 'No se pudo guardar. Inténtalo de nuevo.', en: 'Could not save. Please try again.' },
  tooManyUploads: { es: 'Demasiadas subidas en poco tiempo. Espera unos minutos.', en: 'Too many uploads in a short time. Wait a few minutes.' },
} as const
const lm = (k: keyof typeof L_MSG, lang: string) => L_MSG[k][lang === 'en' ? 'en' : 'es']

// ── Gates (cloned from assignments.ts) ───────────────────────────────────
async function requireTeacher(lang: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: lm('notAuth', lang) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'teacher') return { error: lm('teacherRole', lang) }
  const admin = createAdminClient()
  const { data: teacher } = await admin.from('teachers').select('id, is_active').eq('profile_id', user.id).single()
  if (!teacher?.id) return { error: lm('teacherNotFound', lang) }
  if (!teacher.is_active) return { error: lm('teacherInactive', lang) }
  return { admin, teacherId: teacher.id as string, userId: user.id }
}

// ── Untrusted-input coercers (no `any` — that rule is build-fatal here) ───
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const bool = (v: unknown): boolean => v === true

const QUESTION_TYPES = ['mcq_single', 'mcq_multi', 'true_false', 'short_answer', 'matching', 'essay'] as const
type QuestionType = (typeof QUESTION_TYPES)[number]
function isQuestionType(t: string): t is QuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(t)
}

type ValidQuestion = { type: QuestionType; prompt: string; payload: Record<string, unknown> }

// Validate + NORMALIZE an untrusted question payload per type. The DB stores
// free-form jsonb, so this is the only structural guarantee — the renderer +
// auto-grader (STEP 3) trust this shape. Bounds counts + field lengths.
function validateQuestion(type: string, prompt: string, rawPayload: unknown, lang: string): { error: string } | ValidQuestion {
  if (!isQuestionType(type)) return { error: lm('invalidType', lang) }
  const p = str(prompt, 2000)
  if (!p) return { error: lm('promptRequired', lang) }
  const payload = asRecord(rawPayload)

  if (type === 'mcq_single' || type === 'mcq_multi') {
    const options = asArray(payload.options)
      .map((o) => {
        const r = asRecord(o)
        return { text: str(r.text, 500), correct: bool(r.correct), feedback: str(r.feedback, 500) }
      })
      .filter((o) => o.text.length > 0)
      .slice(0, 20)
    if (options.length < 2) return { error: lm('needOptions', lang) }
    if (options.filter((o) => o.correct).length < 1) return { error: lm('needCorrect', lang) }
    // Enforce single-correct for mcq_single: keep only the first correct flag.
    if (type === 'mcq_single') {
      let seen = false
      for (const o of options) {
        if (o.correct && seen) o.correct = false
        else if (o.correct) seen = true
      }
    }
    return { type, prompt: p, payload: { options } }
  }

  if (type === 'true_false') {
    if (typeof payload.answer !== 'boolean') return { error: lm('invalidPayload', lang) }
    return { type, prompt: p, payload: { answer: payload.answer, feedback: str(payload.feedback, 500) } }
  }

  if (type === 'short_answer') {
    const accepted = asArray(payload.accepted)
      .map((a) => {
        const r = asRecord(a)
        return { text: str(r.text, 200), caseSensitive: bool(r.caseSensitive) }
      })
      .filter((a) => a.text.length > 0)
      .slice(0, 20)
    if (accepted.length < 1) return { error: lm('needAccepted', lang) }
    return { type, prompt: p, payload: { accepted, feedback: str(payload.feedback, 500) } }
  }

  if (type === 'matching') {
    const pairs = asArray(payload.pairs)
      .map((x) => {
        const r = asRecord(x)
        return { left: str(r.left, 200), right: str(r.right, 200) }
      })
      .filter((x) => x.left.length > 0 && x.right.length > 0)
      .slice(0, 50)
    if (pairs.length < 2) return { error: lm('needPairs', lang) }
    return { type, prompt: p, payload: { pairs } }
  }

  // essay — manual grade, no correct answer; optional guidance.
  return { type: 'essay', prompt: p, payload: { guidance: str(payload.guidance, 2000) } }
}

function cleanTags(v: unknown): string[] {
  return asArray(v)
    .map((t) => str(t, 40))
    .filter((t) => t.length > 0)
    .slice(0, 20)
}

// ── Question bank actions (STEP 2) ───────────────────────────────────────
export async function createBankQuestion(input: {
  type: string
  prompt: string
  payload: unknown
  generalFeedback?: string
  tags?: unknown
  lang?: string
}) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const v = validateQuestion(input.type, input.prompt, input.payload, lang)
  if ('error' in v) return { error: v.error }

  const { data, error } = await admin
    .from('lab_question_bank')
    .insert({
      teacher_id: teacherId,
      type: v.type,
      prompt: v.prompt,
      payload: v.payload,
      general_feedback: str(input.generalFeedback, 1000) || null,
      tags: cleanTags(input.tags),
    })
    .select('id')
    .single()
  if (error) {
    console.error('createBankQuestion insert failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const, id: data.id }
}

export async function updateBankQuestion(input: {
  id: string
  type: string
  prompt: string
  payload: unknown
  generalFeedback?: string
  tags?: unknown
  lang?: string
}) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const { data: owner } = await admin.from('lab_question_bank').select('teacher_id').eq('id', input.id).maybeSingle()
  if (!owner) return { error: lm('questionNotFound', lang) }
  if (owner.teacher_id !== teacherId) return { error: lm('notYours', lang) }

  const v = validateQuestion(input.type, input.prompt, input.payload, lang)
  if ('error' in v) return { error: v.error }

  const { error } = await admin
    .from('lab_question_bank')
    .update({
      type: v.type,
      prompt: v.prompt,
      payload: v.payload,
      general_feedback: str(input.generalFeedback, 1000) || null,
      tags: cleanTags(input.tags),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .eq('teacher_id', teacherId)
  if (error) {
    console.error('updateBankQuestion update failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

// Soft archive (never hard-delete — a question may be referenced by a past quiz
// snapshot; archiving just hides it from the active bank).
export async function archiveBankQuestion(input: { id: string; archived: boolean; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const { data: owner } = await admin.from('lab_question_bank').select('teacher_id').eq('id', input.id).maybeSingle()
  if (!owner) return { error: lm('questionNotFound', lang) }
  if (owner.teacher_id !== teacherId) return { error: lm('notYours', lang) }

  const { error } = await admin
    .from('lab_question_bank')
    .update({ archived_at: input.archived ? new Date().toISOString() : null })
    .eq('id', input.id)
    .eq('teacher_id', teacherId)
  if (error) {
    console.error('archiveBankQuestion update failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

// ── Quiz builder actions (STEP 3, Slice A) ───────────────────────────────
const GRADING_METHODS = ['greatest', 'average', 'first', 'last'] as const
type GradingMethod = (typeof GRADING_METHODS)[number]

interface NormalizedSettings {
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  attemptsAllowed: number
  gradingMethod: GradingMethod
  reviewAfter: boolean
}
function normalizeSettings(v: unknown): NormalizedSettings {
  const r = asRecord(v)
  const gm = typeof r.gradingMethod === 'string' && (GRADING_METHODS as readonly string[]).includes(r.gradingMethod)
    ? (r.gradingMethod as GradingMethod)
    : 'greatest'
  let attempts = typeof r.attemptsAllowed === 'number' && Number.isFinite(r.attemptsAllowed) ? Math.floor(r.attemptsAllowed) : 1
  if (attempts < 1) attempts = 1
  if (attempts > 20) attempts = 20
  return {
    shuffleQuestions: r.shuffleQuestions === true,
    shuffleAnswers: r.shuffleAnswers === true,
    attemptsAllowed: attempts,
    gradingMethod: gm,
    reviewAfter: r.reviewAfter !== false,
  }
}

// Keep only ids of NON-archived questions owned by this teacher, preserving the
// caller's order (de-duped, capped). Stops a teacher embedding another teacher's
// questions in a quiz.
async function ownedQuestionIds(admin: ReturnType<typeof createAdminClient>, teacherId: string, raw: unknown): Promise<string[]> {
  const ids = asArray(raw).map((x) => (typeof x === 'string' ? x : '')).filter((x) => x.length > 0)
  const unique = [...new Set(ids)].slice(0, 100)
  if (unique.length === 0) return []
  const { data } = await admin
    .from('lab_question_bank')
    .select('id')
    .eq('teacher_id', teacherId)
    .is('archived_at', null)
    .in('id', unique)
  const ok = new Set((data || []).map((q: { id: string }) => q.id as string))
  return unique.filter((id) => ok.has(id))
}

export async function createQuiz(input: { title: string; intro?: string; questionIds: unknown; settings?: unknown; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx
  const title = str(input.title, 120)
  if (!title) return { error: lm('titleRequired', lang) }
  const question_ids = await ownedQuestionIds(admin, teacherId, input.questionIds)
  const { data, error } = await admin
    .from('lab_quizzes')
    .insert({ teacher_id: teacherId, title, intro: str(input.intro, 2000), question_ids, settings: normalizeSettings(input.settings), status: 'draft' })
    .select('id')
    .single()
  if (error) {
    console.error('createQuiz insert failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const, id: data.id }
}

export async function updateQuiz(input: { id: string; title: string; intro?: string; questionIds: unknown; settings?: unknown; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx
  const { data: owner } = await admin.from('lab_quizzes').select('teacher_id').eq('id', input.id).maybeSingle()
  if (!owner) return { error: lm('quizNotFound', lang) }
  if (owner.teacher_id !== teacherId) return { error: lm('notYours', lang) }
  const title = str(input.title, 120)
  if (!title) return { error: lm('titleRequired', lang) }
  const question_ids = await ownedQuestionIds(admin, teacherId, input.questionIds)
  const { error } = await admin
    .from('lab_quizzes')
    .update({ title, intro: str(input.intro, 2000), question_ids, settings: normalizeSettings(input.settings), updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('teacher_id', teacherId)
  if (error) {
    console.error('updateQuiz update failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function publishQuiz(input: { id: string; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx
  const { data: quiz } = await admin.from('lab_quizzes').select('teacher_id, question_ids').eq('id', input.id).maybeSingle()
  if (!quiz) return { error: lm('quizNotFound', lang) }
  if (quiz.teacher_id !== teacherId) return { error: lm('notYours', lang) }
  const qids = Array.isArray(quiz.question_ids) ? quiz.question_ids : []
  if (qids.length === 0) return { error: lm('noQuestions', lang) }
  const { error } = await admin
    .from('lab_quizzes')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('teacher_id', teacherId)
  if (error) {
    console.error('publishQuiz update failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function cancelQuiz(input: { id: string; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx
  const { data: owner } = await admin.from('lab_quizzes').select('teacher_id').eq('id', input.id).maybeSingle()
  if (!owner) return { error: lm('quizNotFound', lang) }
  if (owner.teacher_id !== teacherId) return { error: lm('notYours', lang) }
  const { error } = await admin
    .from('lab_quizzes')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('teacher_id', teacherId)
  if (error) {
    console.error('cancelQuiz update failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

// ── Assign actions (STEP 3, Slice B) ─────────────────────────────────────
// Non-cancelled-booking IDOR gate (cloned from createAssignment) so a teacher
// can only assign to a student they actually teach.
async function hasBookingWith(admin: ReturnType<typeof createAdminClient>, teacherId: string, studentId: string): Promise<boolean> {
  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .neq('status', 'cancelled')
  return !!count
}

export async function assignQuizToStudent(input: { quizId: string; studentId: string; dueAt?: string | null; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const { data: quiz } = await admin.from('lab_quizzes').select('teacher_id, status').eq('id', input.quizId).maybeSingle()
  if (!quiz) return { error: lm('quizNotFound', lang) }
  if (quiz.teacher_id !== teacherId) return { error: lm('notYours', lang) }
  if (quiz.status !== 'published') return { error: lm('notPublished', lang) }
  if (!(await hasBookingWith(admin, teacherId, input.studentId))) return { error: lm('noBooking', lang) }

  // Don't stack duplicate OPEN assignments of the same quiz to the same student.
  const { data: existing } = await admin
    .from('lab_quiz_assignments')
    .select('id')
    .eq('quiz_id', input.quizId)
    .eq('student_id', input.studentId)
    .eq('status', 'open')
    .maybeSingle()
  if (existing) return { error: lm('alreadyAssigned', lang) }

  const dueAt = input.dueAt && !Number.isNaN(new Date(input.dueAt).getTime()) ? input.dueAt : null
  const { error } = await admin
    .from('lab_quiz_assignments')
    .insert({ quiz_id: input.quizId, teacher_id: teacherId, student_id: input.studentId, due_at: dueAt, status: 'open' })
  if (error) {
    console.error('assignQuizToStudent insert failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function cancelLabAssignment(input: { id: string; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx
  const { data: owner } = await admin.from('lab_quiz_assignments').select('teacher_id').eq('id', input.id).maybeSingle()
  if (!owner) return { error: lm('assignmentNotFound', lang) }
  if (owner.teacher_id !== teacherId) return { error: lm('notYours', lang) }
  const { error } = await admin
    .from('lab_quiz_assignments')
    .update({ status: 'cancelled' })
    .eq('id', input.id)
    .eq('teacher_id', teacherId)
  if (error) {
    console.error('cancelLabAssignment update failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

// ── Student attempt (STEP 3c) ────────────────────────────────────────────
async function requireStudent(lang: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: lm('notAuth', lang) }
  const admin = createAdminClient()
  const { data: student } = await admin.from('students').select('id').eq('profile_id', user.id).single()
  if (!student?.id) return { error: lm('studentNotFound', lang) }
  return { admin, studentId: student.id as string, userId: user.id }
}

// Bound an untrusted answer value before it's stored. Keeps the persisted blob
// small and predictable: strings capped, arrays trimmed to scalar members.
function clampAnswer(v: unknown): unknown {
  if (typeof v === 'string') return v.slice(0, 5000)
  if (typeof v === 'number' || typeof v === 'boolean') return v
  if (Array.isArray(v)) {
    // The only array answers are matching (≤50 pairs) and mcq_multi (≤20 opts);
    // cap to the validator's bounds so a hand-built payload can't bloat the row.
    return v
      .slice(0, 50)
      .map((x) => (typeof x === 'string' ? x.slice(0, 200) : typeof x === 'number' ? x : null))
  }
  return null
}

// Student submits a quiz. Re-reads the quiz + its UNSANITIZED questions
// server-side and auto-grades from that source of truth — the client's answers
// are the only thing trusted, never a client-computed score (no-show lesson).
// One attempt per assignment (UNIQUE on assignment_id, 23505-guarded). The frozen
// snapshot keeps answer keys ONLY when the quiz allows review-after, so even a
// direct REST read of the student-readable attempt can't reveal a key otherwise.
export async function submitQuizAttempt(input: { assignmentId: string; answers: unknown; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireStudent(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, studentId } = ctx

  // 1. Assignment must exist, be open, and target THIS student.
  const { data: assignment } = await admin
    .from('lab_quiz_assignments')
    .select('id, quiz_id, student_id, status')
    .eq('id', input.assignmentId)
    .maybeSingle()
  if (!assignment || assignment.student_id !== studentId) return { error: lm('assignmentNotFound', lang) }
  if (assignment.status !== 'open') return { error: lm('assignmentClosed', lang) }

  // 2. Re-read the quiz first (its settings gate how many attempts are allowed).
  const { data: quiz } = await admin
    .from('lab_quizzes')
    .select('id, question_ids, settings, status')
    .eq('id', assignment.quiz_id)
    .maybeSingle()
  if (!quiz) return { error: lm('quizNotFound', lang) }
  if (quiz.status === 'cancelled') return { error: lm('assignmentClosed', lang) }
  const settings = normalizeSettings(quiz.settings)

  // 3. Retake-always-allowed UP TO attempts_allowed (PLAN-01). Count prior attempts;
  //    the composite UNIQUE(assignment_id, attempt_number) is the real race guard.
  const { data: priorAttempts } = await admin
    .from('lab_quiz_attempts')
    .select('attempt_number')
    .eq('assignment_id', assignment.id)
    .order('attempt_number', { ascending: false })
  const priorList = (priorAttempts as { attempt_number: number }[] | null) || []
  if (priorList.length >= settings.attemptsAllowed) return { error: lm('attemptsExhausted', lang) }
  const nextNumber = (priorList[0]?.attempt_number || 0) + 1

  // 4. Read the quiz's UNSANITIZED questions, in the quiz's question order.
  const orderedIds = (Array.isArray(quiz.question_ids) ? quiz.question_ids : []).filter(
    (x): x is string => typeof x === 'string',
  )
  const { data: rows } = await admin
    .from('lab_question_bank')
    .select('id, type, prompt, payload')
    .in('id', orderedIds.length ? orderedIds : ['00000000-0000-0000-0000-000000000000'])
  const byId = new Map((rows || []).map((r) => [r.id as string, r as BankQuestionRow]))
  const questions: BankQuestionRow[] = orderedIds
    .map((id) => byId.get(id))
    .filter((q): q is BankQuestionRow => !!q)

  // 5. Keep only answers for real questions, bounded; then auto-grade server-side.
  const raw = asRecord(input.answers)
  const answers: Record<string, unknown> = {}
  for (const q of questions) if (q.id in raw) answers[q.id] = clampAnswer(raw[q.id])
  const graded = gradeAttempt(questions, answers)

  // 6. Frozen snapshot — keys present only if reviewAfter (defense in depth).
  const snapshot = questions
    .map((q) => {
      const sani = sanitizeQuestion(q, settings.reviewAfter)
      return sani ? { ...sani, outcome: graded.outcomes[q.id] } : null
    })
    .filter((x) => x !== null)

  // 7. Insert. The composite UNIQUE(assignment_id, attempt_number) is the real
  //    concurrency guard: on a race two submits compute the same number, one wins,
  //    the loser bumps + retries once (and re-checks the cap so it can't exceed it).
  let inserted: { id: string } | null = null
  let usedNumber = nextNumber
  for (let i = 0; i < 2 && !inserted; i++) {
    usedNumber = nextNumber + i
    if (usedNumber > settings.attemptsAllowed) return { error: lm('attemptsExhausted', lang) }
    const { data, error } = await admin
      .from('lab_quiz_attempts')
      .insert({
        assignment_id: assignment.id,
        attempt_number: usedNumber,
        questions_snapshot: snapshot,
        answers,
        auto_score: graded.autoScore,
        max_score: graded.maxScore,
      })
      .select('id')
      .single()
    if (!error) { inserted = data; break }
    if (isUniqueViolation(error)) continue // race on attempt_number — bump + retry
    console.error('submitQuizAttempt insert failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  if (!inserted) return { error: lm('attemptsExhausted', lang) }

  revalidatePath('/', 'layout')
  return {
    success: true as const,
    attemptId: inserted.id,
    autoScore: graded.autoScore,
    maxScore: graded.maxScore,
    pendingCount: graded.pendingCount,
    attemptNumber: usedNumber,
    attemptsRemaining: Math.max(0, settings.attemptsAllowed - usedNumber),
  }
}

// ── Teacher attempt review (STEP 3d) ─────────────────────────────────────
// Teacher reviews a submitted attempt: writes overall feedback and/or overrides
// per-question outcomes (the essays + short-answers that auto-grading left
// 'pending'). Authoritatively re-grades from the live questions, applies the
// teacher's overrides on top, recomputes the score, and updates the frozen
// snapshot's outcomes so the student's review reflects the human grade.
// Ownership: attempt → assignment → must belong to this teacher.
export async function gradeQuizAttempt(input: {
  attemptId: string
  feedback?: string
  overrides?: Record<string, string> // questionId -> 'correct' | 'incorrect'
  lang?: string
}) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const { data: attempt } = await admin
    .from('lab_quiz_attempts')
    .select('id, assignment_id, questions_snapshot, answers, manual_adjusted')
    .eq('id', input.attemptId)
    .maybeSingle()
  if (!attempt) return { error: lm('attemptNotFound', lang) }

  const { data: assignment } = await admin
    .from('lab_quiz_assignments')
    .select('teacher_id')
    .eq('id', attempt.assignment_id)
    .maybeSingle()
  if (!assignment || assignment.teacher_id !== teacherId) return { error: lm('notYours', lang) }

  const feedback = str(input.feedback, 4000)
  const overridesRaw = asRecord(input.overrides)

  // Grade from the FROZEN snapshot, never the live quiz/bank — migration 054's
  // whole point is that later bank/template edits can't mutate a graded attempt.
  // submitQuizAttempt already froze the authoritative per-question outcome here;
  // the teacher only layers correct/incorrect overrides on top.
  const snapArr = Array.isArray(attempt.questions_snapshot) ? attempt.questions_snapshot : []
  const ids: string[] = []
  const finalOutcomes: Record<string, 'correct' | 'incorrect' | 'pending'> = {}
  for (const entry of snapArr) {
    const e = asRecord(entry)
    const id = typeof e.id === 'string' ? e.id : ''
    if (!id) continue
    ids.push(id)
    const o = e.outcome
    finalOutcomes[id] = o === 'correct' || o === 'incorrect' || o === 'pending' ? o : 'pending'
  }

  // Apply teacher overrides (only the two explicit verdicts are accepted).
  let requestAdjusted = false
  for (const id of ids) {
    const ov = overridesRaw[id]
    if (ov === 'correct' || ov === 'incorrect') {
      if (finalOutcomes[id] !== ov) requestAdjusted = true
      finalOutcomes[id] = ov
    }
  }

  // Require an actual grading action so the student isn't locked into a graded
  // state with nothing useful (mirrors gradeSubmission's feedbackOrScore guard).
  if (!feedback && !requestAdjusted) return { error: lm('nothingToGrade', lang) }

  // manual_adjusted is STICKY: a later feedback-only re-grade sends no overrides,
  // but a prior override is still baked into the snapshot outcome + score, so the
  // flag must stay true once set (REVIEW-01).
  const manualAdjusted = attempt.manual_adjusted === true || requestAdjusted

  let autoScore = 0
  let maxScore = 0
  for (const id of ids) {
    const o = finalOutcomes[id]
    if (o !== 'pending') {
      maxScore++
      if (o === 'correct') autoScore++
    }
  }

  // Update the stored snapshot outcomes in place — never re-reveal keys (the
  // snapshot already holds keys only if reviewAfter was on at submit).
  const snapshot = snapArr.map((entry) => {
    const e = asRecord(entry)
    const id = typeof e.id === 'string' ? e.id : ''
    return id && finalOutcomes[id] ? { ...e, outcome: finalOutcomes[id] } : e
  })

  const { error } = await admin
    .from('lab_quiz_attempts')
    .update({
      teacher_feedback: feedback || null,
      auto_score: autoScore,
      max_score: maxScore,
      manual_adjusted: manualAdjusted,
      questions_snapshot: snapshot,
      graded_at: new Date().toISOString(),
    })
    .eq('id', attempt.id)
  if (error) {
    console.error('gradeQuizAttempt update failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

// ── Teacher folder + file share (STEP 5, §8.4) ───────────────────────────
// Private 'lab-files' bucket (migration 054). Direct URLs 404; downloads go
// through a service-role-minted short-lived signed URL AFTER an entitlement
// gate (the LIB-05 lesson: getBookSignedUrl was ungated). Credit-neutral. The
// upload constants + content-type allowlist + magic-byte check live in the
// shared @/lib/lab/files module (also used by assignment attachments).

export async function uploadLabFile(formData: FormData) {
  const lang = (formData.get('lang') as string | null) || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  // Storage uploads cost real money if looped — cap per teacher (allowlisted
  // in auth_attempts via migration 058; without that the limit no-ops).
  const rl = await checkUserActionLimit(ctx.userId, 'uploadLabFile', 20)
  if (!rl.ok) return { error: lm('tooManyUploads', lang) }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: lm('fileRequired', lang) }
  if (file.size > MAX_FILE_BYTES) return { error: lm('fileTooLarge', lang) }
  const contentType = file.type || 'application/octet-stream'
  if (!ALLOWED_FILE_TYPES.has(contentType)) return { error: lm('fileType', lang) }

  const rawName = str(formData.get('fileName'), 200) || file.name || 'archivo'
  const description = str(formData.get('description'), 1000)
  const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  const slug = rawName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60) || 'archivo'
  // Path is namespaced by teacher_id (service-role writes only, bucket private);
  // a random token guarantees uniqueness (no same-millisecond collisions) and
  // doesn't leak an upload timestamp.
  const storagePath = `${teacherId}/${randomUUID()}-${slug}${ext ? '.' + ext : ''}`

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!magicMatches(buffer, contentType)) return { error: lm('fileType', lang) }
  const { error: upErr } = await admin.storage
    .from(LAB_FILES_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: false })
  if (upErr) {
    console.error('uploadLabFile storage upload failed:', upErr.message)
    return { error: lm('saveFailed', lang) }
  }
  const { error: insErr } = await admin.from('lab_teacher_files').insert({
    teacher_id: teacherId,
    file_name: rawName,
    description,
    storage_path: storagePath,
    mime_type: contentType,
    size_bytes: file.size,
  })
  if (insErr) {
    // Roll the orphaned object back so the bucket can't drift from the table.
    await admin.storage.from(LAB_FILES_BUCKET).remove([storagePath])
    console.error('uploadLabFile insert failed:', insErr.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function deleteLabFile(input: { id: string; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const { data: f } = await admin
    .from('lab_teacher_files')
    .select('teacher_id, storage_path')
    .eq('id', input.id)
    .maybeSingle()
  if (!f) return { error: lm('fileNotFound', lang) }
  if (f.teacher_id !== teacherId) return { error: lm('notYours', lang) }

  // Row first (shares cascade via FK), then the object — an orphaned object is
  // harmless, an orphaned row points at a missing file (mirrors deleteBook).
  const { error } = await admin.from('lab_teacher_files').delete().eq('id', input.id).eq('teacher_id', teacherId)
  if (error) {
    console.error('deleteLabFile delete failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  const { error: rmErr } = await admin.storage.from(LAB_FILES_BUCKET).remove([f.storage_path])
  if (rmErr) console.error('deleteLabFile: storage remove failed', f.storage_path, rmErr.message)
  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function shareLabFile(input: { fileId: string; studentId: string; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const { data: f } = await admin.from('lab_teacher_files').select('teacher_id').eq('id', input.fileId).maybeSingle()
  if (!f) return { error: lm('fileNotFound', lang) }
  if (f.teacher_id !== teacherId) return { error: lm('notYours', lang) }
  // Same booking-IDOR gate as quizzes/assignments — only share with a student
  // you actually teach.
  if (!(await hasBookingWith(admin, teacherId, input.studentId))) return { error: lm('noBooking', lang) }

  const { error } = await admin.from('lab_file_shares').insert({ file_id: input.fileId, student_id: input.studentId })
  if (error) {
    if (isUniqueViolation(error)) return { success: true as const } // already shared — idempotent
    console.error('shareLabFile insert failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function unshareLabFile(input: { fileId: string; studentId: string; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  // Only the owning teacher can unshare (verify ownership via the file).
  const { data: f } = await admin.from('lab_teacher_files').select('teacher_id').eq('id', input.fileId).maybeSingle()
  if (!f) return { error: lm('fileNotFound', lang) }
  if (f.teacher_id !== teacherId) return { error: lm('notYours', lang) }

  const { error } = await admin
    .from('lab_file_shares')
    .delete()
    .eq('file_id', input.fileId)
    .eq('student_id', input.studentId)
  if (error) {
    console.error('unshareLabFile delete failed:', error.message)
    return { error: lm('saveFailed', lang) }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

// Entitlement-gated signed URL. Allowed callers: the owning teacher, a student
// the file is shared with, or an admin. (The LIB-05 lesson — never mint a URL
// for any authenticated session.) Role-agnostic: a single endpoint both the
// teacher folder and the student feed call.
export async function getLabFileSignedUrl(input: { fileId: string; lang?: string }) {
  const lang = input.lang || 'es'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: lm('notAuth', lang) }
  const admin = createAdminClient()

  const { data: f } = await admin
    .from('lab_teacher_files')
    .select('teacher_id, storage_path')
    .eq('id', input.fileId)
    .maybeSingle()
  if (!f) return { error: lm('fileNotFound', lang) }

  let entitled = false
  const { data: teacher } = await admin.from('teachers').select('id').eq('profile_id', user.id).maybeSingle()
  if (teacher && teacher.id === f.teacher_id) entitled = true
  if (!entitled) {
    const { data: student } = await admin.from('students').select('id').eq('profile_id', user.id).maybeSingle()
    if (student) {
      const { data: share } = await admin
        .from('lab_file_shares')
        .select('id')
        .eq('file_id', input.fileId)
        .eq('student_id', student.id)
        .maybeSingle()
      if (share) entitled = true
    }
  }
  if (!entitled) {
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role === 'admin') entitled = true
  }
  if (!entitled) return { error: lm('notYours', lang) }

  const { data, error } = await admin.storage.from(LAB_FILES_BUCKET).createSignedUrl(f.storage_path, FILE_URL_TTL)
  if (error || !data) {
    console.error('getLabFileSignedUrl sign failed:', error?.message)
    return { error: lm('urlFailed', lang) }
  }
  return { success: true as const, url: data.signedUrl }
}
