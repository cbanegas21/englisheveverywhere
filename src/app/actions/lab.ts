'use server'

// The Lab — server actions. Mirrors src/app/actions/assignments.ts exactly:
// RLS-read + service-role-write, every mutation gated by auth + role + ownership,
// raw PG errors logged (never reflected), localized {error} returned (never
// thrown). Credit-neutral: nothing here touches credits/Stripe/payouts/bookings/
// sessions. STEP 2 = the teacher question bank; quiz engine + folder land in
// later steps in this same file.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  saveFailed: { es: 'No se pudo guardar. Inténtalo de nuevo.', en: 'Could not save. Please try again.' },
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
