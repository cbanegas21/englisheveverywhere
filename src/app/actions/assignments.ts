'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  LAB_FILES_BUCKET,
  FILE_URL_TTL,
  ALLOWED_FILE_TYPES,
  checkUpload,
  magicMatches,
  safeSlug,
  safeExt,
} from '@/lib/lab/files'

const VALID_SCORES = new Set(['A1','A2','B1','B2','C1','C2','needs_work','good','excellent'])

// Localized, user-safe assignment errors (ASSIGN-05). Raw Postgres/Supabase
// error strings are logged server-side and never reflected to the user.
const A_MSG = {
  notAuth: { es: 'No autenticado.', en: 'Not authenticated.' },
  teacherRole: { es: 'Se requiere una cuenta de maestro.', en: 'Teacher account required.' },
  teacherNotFound: { es: 'No se encontró el registro de maestro.', en: 'Teacher record not found.' },
  teacherInactive: { es: 'Tu cuenta de maestro no está activa.', en: 'Teacher account is not active.' },
  studentNotFound: { es: 'No se encontró tu perfil de estudiante.', en: 'Student record not found.' },
  titleRequired: { es: 'El título es obligatorio.', en: 'Title is required.' },
  titleTooLong: { es: 'El título es muy largo (máx. 120 caracteres).', en: 'Title is too long (max 120 characters).' },
  instrRequired: { es: 'Las instrucciones son obligatorias.', en: 'Instructions are required.' },
  instrTooLong: { es: 'Las instrucciones son muy largas (máx. 4000 caracteres).', en: 'Instructions are too long (max 4000 characters).' },
  invalidDue: { es: 'Fecha de entrega inválida.', en: 'Invalid due date.' },
  noBooking: { es: 'No tienes ninguna reserva con este estudiante.', en: 'You have no booking with this student.' },
  notYours: { es: 'Esta tarea no es tuya.', en: 'Not your assignment.' },
  emptySubmission: { es: 'La entrega no puede estar vacía.', en: 'Submission cannot be empty.' },
  assignmentNotFound: { es: 'Tarea no encontrada.', en: 'Assignment not found.' },
  notOpen: { es: 'Esta tarea ya no está abierta.', en: 'This assignment is no longer open.' },
  alreadyGraded: { es: 'Esta tarea ya fue calificada.', en: 'This assignment has already been graded.' },
  alreadySubmitted: { es: 'Tu entrega ya fue recibida.', en: 'Your submission was already received.' },
  invalidScore: { es: 'Valor de calificación inválido.', en: 'Invalid score value.' },
  feedbackOrScore: { es: 'Proporciona retroalimentación o una calificación.', en: 'Provide feedback or a score.' },
  feedbackTooLong: { es: 'La retroalimentación es muy larga (máx. 4000 caracteres).', en: 'Feedback is too long (max 4000 characters).' },
  noSubmission: { es: 'Aún no hay entrega para calificar.', en: 'No submission to grade yet.' },
  rubricTooLong: { es: 'La guía de evaluación es muy larga (máx. 4000 caracteres).', en: 'The rubric is too long (max 4000 characters).' },
  fileRequired: { es: 'Selecciona un archivo.', en: 'Select a file.' },
  fileTooLarge: { es: 'El archivo supera el límite de 25 MB.', en: 'The file exceeds the 25 MB limit.' },
  fileType: { es: 'Tipo de archivo no permitido.', en: 'File type not allowed.' },
  fileNotFound: { es: 'Archivo no encontrado.', en: 'File not found.' },
  urlFailed: { es: 'No se pudo abrir el archivo. Inténtalo de nuevo.', en: 'Could not open the file. Please try again.' },
  saveFailed: { es: 'No se pudo guardar. Inténtalo de nuevo.', en: 'Could not save. Please try again.' },
} as const
const am = (k: keyof typeof A_MSG, lang: string) => A_MSG[k][lang === 'en' ? 'en' : 'es']

// Postgres unique-violation — surfaced when a concurrent submit races the same
// assignment's single-submission unique index.
function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '23505' || !!error?.message?.toLowerCase().includes('duplicate')
}

async function requireTeacher(lang: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: am('notAuth', lang) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'teacher') return { error: am('teacherRole', lang) }
  const admin = createAdminClient()
  const { data: teacher } = await admin.from('teachers').select('id, is_active').eq('profile_id', user.id).single()
  if (!teacher?.id) return { error: am('teacherNotFound', lang) }
  // A deactivated or not-yet-approved teacher (is_active=false) must not
  // create/grade/cancel assignments.
  if (!teacher.is_active) return { error: am('teacherInactive', lang) }
  return { admin, teacherId: teacher.id as string, userId: user.id }
}

async function requireStudent(lang: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: am('notAuth', lang) }
  const admin = createAdminClient()
  const { data: student } = await admin.from('students').select('id').eq('profile_id', user.id).single()
  if (!student?.id) return { error: am('studentNotFound', lang) }
  return { admin, studentId: student.id as string, userId: user.id }
}

export async function createAssignment(input: {
  studentId: string
  title: string
  instructions: string
  dueAt: string | null
  rubric?: string
  lang?: string
}) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const title = input.title.trim()
  if (!title) return { error: am('titleRequired', lang) }
  if (title.length > 120) return { error: am('titleTooLong', lang) }
  const instructions = input.instructions.trim()
  if (!instructions) return { error: am('instrRequired', lang) }
  if (instructions.length > 4000) return { error: am('instrTooLong', lang) }
  const rubric = (input.rubric || '').trim()
  if (rubric.length > 4000) return { error: am('rubricTooLong', lang) }
  if (input.dueAt && isNaN(new Date(input.dueAt).getTime())) return { error: am('invalidDue', lang) }

  // Must have a non-cancelled booking with this student — same gate as
  // teacherSetStudentLevel so teachers can't assign to random students.
  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('student_id', input.studentId)
    .neq('status', 'cancelled')
  if (!count) return { error: am('noBooking', lang) }

  const { data, error } = await admin
    .from('assignments')
    .insert({
      teacher_id: teacherId,
      student_id: input.studentId,
      title,
      instructions,
      rubric: rubric || null,
      due_at: input.dueAt,
      status: 'open',
    })
    .select('id')
    .single()
  if (error) {
    console.error('createAssignment insert failed:', error.message)
    return { error: am('saveFailed', lang) }
  }

  revalidatePath('/', 'layout')
  return { success: true as const, id: data.id }
}

export async function cancelAssignment(assignmentId: string, lang: string = 'es') {
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const { data: owner } = await admin
    .from('assignments')
    .select('teacher_id')
    .eq('id', assignmentId)
    .single()
  if (!owner || owner.teacher_id !== teacherId) return { error: am('notYours', lang) }

  const { error } = await admin
    .from('assignments')
    .update({ status: 'cancelled' })
    .eq('id', assignmentId)
  if (error) {
    console.error('cancelAssignment update failed:', error.message)
    return { error: am('saveFailed', lang) }
  }

  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function submitAssignment(input: { assignmentId: string; text: string; lang?: string }) {
  const lang = input.lang || 'es'
  const ctx = await requireStudent(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, studentId } = ctx

  const text = input.text.trim()
  if (!text) return { error: am('emptySubmission', lang) }

  // Verify the assignment targets this student AND is still open.
  const { data: a } = await admin
    .from('assignments')
    .select('student_id, status')
    .eq('id', input.assignmentId)
    .single()
  if (!a || a.student_id !== studentId) return { error: am('assignmentNotFound', lang) }
  if (a.status !== 'open') return { error: am('notOpen', lang) }

  // Upsert on assignment_id — each assignment has a single submission that
  // can be revised until the teacher grades it.
  const { data: existing } = await admin
    .from('assignment_submissions')
    .select('id, graded_at')
    .eq('assignment_id', input.assignmentId)
    .maybeSingle()

  if (existing?.graded_at) {
    return { error: am('alreadyGraded', lang) }
  }

  if (existing) {
    const { error } = await admin
      .from('assignment_submissions')
      .update({ submitted_text: text, submitted_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) {
      console.error('submitAssignment update failed:', error.message)
      return { error: am('saveFailed', lang) }
    }
  } else {
    const { error } = await admin
      .from('assignment_submissions')
      .insert({
        assignment_id: input.assignmentId,
        submitted_text: text,
      })
    if (error) {
      // A concurrent submit grabbed the single-submission slot first.
      if (isUniqueViolation(error)) return { error: am('alreadySubmitted', lang) }
      console.error('submitAssignment insert failed:', error.message)
      return { error: am('saveFailed', lang) }
    }
  }

  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function gradeSubmission(input: {
  assignmentId: string
  feedback: string
  score: string | null
  lang?: string
}) {
  const lang = input.lang || 'es'
  const ctx = await requireTeacher(lang)
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  if (input.score !== null && !VALID_SCORES.has(input.score)) {
    return { error: am('invalidScore', lang) }
  }

  // Require something to grade with — empty feedback AND no score would lock the
  // student into read-only with nothing useful (ASSIGN-03).
  const feedback = input.feedback.trim()
  if (!feedback && !input.score) return { error: am('feedbackOrScore', lang) }
  if (feedback.length > 4000) return { error: am('feedbackTooLong', lang) }

  const { data: a } = await admin
    .from('assignments')
    .select('teacher_id, status')
    .eq('id', input.assignmentId)
    .single()
  if (!a || a.teacher_id !== teacherId) return { error: am('notYours', lang) }
  // Don't grade a cancelled assignment (ASSIGN-04).
  if (a.status !== 'open') return { error: am('notOpen', lang) }

  const { data: submission } = await admin
    .from('assignment_submissions')
    .select('id')
    .eq('assignment_id', input.assignmentId)
    .maybeSingle()
  if (!submission) return { error: am('noSubmission', lang) }

  const { error } = await admin
    .from('assignment_submissions')
    .update({
      teacher_feedback: feedback,
      score: input.score,
      graded_at: new Date().toISOString(),
    })
    .eq('id', submission.id)
  if (error) {
    console.error('gradeSubmission update failed:', error.message)
    return { error: am('saveFailed', lang) }
  }

  revalidatePath('/', 'layout')
  return { success: true as const }
}

// ── Assignment file attachments (STEP 4) ─────────────────────────────────
// Files live in the private 'lab-files' bucket (migration 054); downloads go
// through getAssignmentFileSignedUrl after an entitlement check. Three kinds:
//   'assignment' — a file the teacher attaches to the assignment (teacher writes)
//   'submission' — a file the student attaches to their submission (student writes)
//   'audio'      — the teacher's audio feedback on the submission (teacher writes)
type FileKind = 'assignment' | 'submission' | 'audio'
function isFileKind(k: string): k is FileKind {
  return k === 'assignment' || k === 'submission' || k === 'audio'
}
function assignmentFilePath(assignmentId: string, kind: FileKind, fileName: string): string {
  const ext = safeExt(fileName)
  return `assignments/${assignmentId}/${kind}-${randomUUID()}-${safeSlug(fileName)}${ext ? '.' + ext : ''}`
}

export async function attachAssignmentFile(formData: FormData) {
  const lang = (formData.get('lang') as string | null) || 'es'
  const kindRaw = (formData.get('kind') as string | null) || ''
  const assignmentId = (formData.get('assignmentId') as string | null) || ''
  if (!isFileKind(kindRaw)) return { error: am('saveFailed', lang) }
  const kind: FileKind = kindRaw

  const file = formData.get('file')
  const bad = checkUpload(file)
  if (bad) return { error: am(bad, lang) }
  const f = file as File
  const contentType = f.type || 'application/octet-stream'
  if (!ALLOWED_FILE_TYPES.has(contentType)) return { error: am('fileType', lang) }

  const admin = createAdminClient()
  const { data: a } = await admin
    .from('assignments')
    .select('id, teacher_id, student_id, status')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!a) return { error: am('assignmentNotFound', lang) }
  if (a.status !== 'open') return { error: am('notOpen', lang) }

  // Role + ownership per kind.
  if (kind === 'assignment' || kind === 'audio') {
    const ctx = await requireTeacher(lang)
    if ('error' in ctx) return { error: ctx.error }
    if (ctx.teacherId !== a.teacher_id) return { error: am('notYours', lang) }
  } else {
    const ctx = await requireStudent(lang)
    if ('error' in ctx) return { error: ctx.error }
    if (ctx.studentId !== a.student_id) return { error: am('assignmentNotFound', lang) }
  }

  const buffer = Buffer.from(await f.arrayBuffer())
  if (!magicMatches(buffer, contentType)) return { error: am('fileType', lang) }
  const path = assignmentFilePath(assignmentId, kind, f.name)
  const fileName = (f.name || 'archivo').slice(0, 200)
  const { error: upErr } = await admin.storage.from(LAB_FILES_BUCKET).upload(path, buffer, { contentType, upsert: false })
  if (upErr) {
    console.error('attachAssignmentFile upload failed:', upErr.message)
    return { error: am('saveFailed', lang) }
  }
  const rollback = async () => {
    await admin.storage.from(LAB_FILES_BUCKET).remove([path])
  }

  let oldPath: string | null = null
  if (kind === 'assignment') {
    const { data: prev } = await admin.from('assignments').select('attachment_path').eq('id', assignmentId).maybeSingle()
    oldPath = (prev?.attachment_path as string | null) ?? null
    const { error } = await admin
      .from('assignments')
      .update({ attachment_path: path, attachment_name: fileName })
      .eq('id', assignmentId)
      .eq('teacher_id', a.teacher_id)
    if (error) { await rollback(); console.error('attach assignment update failed:', error.message); return { error: am('saveFailed', lang) } }
  } else if (kind === 'submission') {
    const { data: sub } = await admin
      .from('assignment_submissions')
      .select('id, graded_at, attachment_path')
      .eq('assignment_id', assignmentId)
      .maybeSingle()
    if (sub?.graded_at) { await rollback(); return { error: am('alreadyGraded', lang) } }
    if (sub) {
      oldPath = (sub.attachment_path as string | null) ?? null
      const { error } = await admin
        .from('assignment_submissions')
        .update({ attachment_path: path, attachment_name: fileName, submitted_at: new Date().toISOString() })
        .eq('id', sub.id)
      if (error) { await rollback(); console.error('attach submission update failed:', error.message); return { error: am('saveFailed', lang) } }
    } else {
      const { error } = await admin
        .from('assignment_submissions')
        .insert({ assignment_id: assignmentId, submitted_text: '', attachment_path: path, attachment_name: fileName })
      if (error) {
        await rollback()
        if (isUniqueViolation(error)) return { error: am('alreadySubmitted', lang) }
        console.error('attach submission insert failed:', error.message)
        return { error: am('saveFailed', lang) }
      }
    }
  } else {
    // audio feedback — requires an existing submission to attach to.
    const { data: sub } = await admin
      .from('assignment_submissions')
      .select('id, audio_feedback_path')
      .eq('assignment_id', assignmentId)
      .maybeSingle()
    if (!sub) { await rollback(); return { error: am('noSubmission', lang) } }
    oldPath = (sub.audio_feedback_path as string | null) ?? null
    const { error } = await admin
      .from('assignment_submissions')
      .update({ audio_feedback_path: path, audio_feedback_name: fileName })
      .eq('id', sub.id)
    if (error) { await rollback(); console.error('attach audio update failed:', error.message); return { error: am('saveFailed', lang) } }
  }

  // Best-effort cleanup of the replaced object.
  if (oldPath && oldPath !== path) {
    const { error: rmErr } = await admin.storage.from(LAB_FILES_BUCKET).remove([oldPath])
    if (rmErr) console.error('attachAssignmentFile: old object remove failed', oldPath, rmErr.message)
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function removeAssignmentFile(input: { assignmentId: string; kind: string; lang?: string }) {
  const lang = input.lang || 'es'
  if (!isFileKind(input.kind)) return { error: am('saveFailed', lang) }
  const kind: FileKind = input.kind
  const admin = createAdminClient()
  const { data: a } = await admin
    .from('assignments')
    .select('teacher_id, student_id')
    .eq('id', input.assignmentId)
    .maybeSingle()
  if (!a) return { error: am('assignmentNotFound', lang) }

  if (kind === 'assignment' || kind === 'audio') {
    const ctx = await requireTeacher(lang)
    if ('error' in ctx) return { error: ctx.error }
    if (ctx.teacherId !== a.teacher_id) return { error: am('notYours', lang) }
  } else {
    const ctx = await requireStudent(lang)
    if ('error' in ctx) return { error: ctx.error }
    if (ctx.studentId !== a.student_id) return { error: am('assignmentNotFound', lang) }
  }

  let path: string | null = null
  if (kind === 'assignment') {
    const { data: row } = await admin.from('assignments').select('attachment_path').eq('id', input.assignmentId).maybeSingle()
    path = (row?.attachment_path as string | null) ?? null
    await admin.from('assignments').update({ attachment_path: null, attachment_name: null }).eq('id', input.assignmentId)
  } else if (kind === 'submission') {
    const { data: sub } = await admin.from('assignment_submissions').select('id, graded_at, attachment_path').eq('assignment_id', input.assignmentId).maybeSingle()
    if (!sub) return { error: am('noSubmission', lang) }
    if (sub.graded_at) return { error: am('alreadyGraded', lang) }
    path = (sub.attachment_path as string | null) ?? null
    await admin.from('assignment_submissions').update({ attachment_path: null, attachment_name: null }).eq('id', sub.id)
  } else {
    const { data: sub } = await admin.from('assignment_submissions').select('id, audio_feedback_path').eq('assignment_id', input.assignmentId).maybeSingle()
    if (!sub) return { error: am('noSubmission', lang) }
    path = (sub.audio_feedback_path as string | null) ?? null
    await admin.from('assignment_submissions').update({ audio_feedback_path: null, audio_feedback_name: null }).eq('id', sub.id)
  }
  if (path) {
    const { error: rmErr } = await admin.storage.from(LAB_FILES_BUCKET).remove([path])
    if (rmErr) console.error('removeAssignmentFile remove failed', path, rmErr.message)
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

// Entitlement-gated signed URL: the assignment's teacher, its student, or an
// admin may view ANY of its files. (Same posture as getLabFileSignedUrl.)
export async function getAssignmentFileSignedUrl(input: { assignmentId: string; kind: string; lang?: string }) {
  const lang = input.lang || 'es'
  if (!isFileKind(input.kind)) return { error: am('fileNotFound', lang) }
  const kind: FileKind = input.kind
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: am('notAuth', lang) }
  const admin = createAdminClient()
  const { data: a } = await admin
    .from('assignments')
    .select('teacher_id, student_id')
    .eq('id', input.assignmentId)
    .maybeSingle()
  if (!a) return { error: am('fileNotFound', lang) }

  let entitled = false
  const { data: teacher } = await admin.from('teachers').select('id').eq('profile_id', user.id).maybeSingle()
  if (teacher && teacher.id === a.teacher_id) entitled = true
  if (!entitled) {
    const { data: student } = await admin.from('students').select('id').eq('profile_id', user.id).maybeSingle()
    if (student && student.id === a.student_id) entitled = true
  }
  if (!entitled) {
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role === 'admin') entitled = true
  }
  if (!entitled) return { error: am('notYours', lang) }

  let path: string | null = null
  if (kind === 'assignment') {
    const { data: row } = await admin.from('assignments').select('attachment_path').eq('id', input.assignmentId).maybeSingle()
    path = (row?.attachment_path as string | null) ?? null
  } else if (kind === 'submission') {
    const { data: sub } = await admin.from('assignment_submissions').select('attachment_path').eq('assignment_id', input.assignmentId).maybeSingle()
    path = (sub?.attachment_path as string | null) ?? null
  } else {
    const { data: sub } = await admin.from('assignment_submissions').select('audio_feedback_path').eq('assignment_id', input.assignmentId).maybeSingle()
    path = (sub?.audio_feedback_path as string | null) ?? null
  }
  if (!path) return { error: am('fileNotFound', lang) }

  const { data, error } = await admin.storage.from(LAB_FILES_BUCKET).createSignedUrl(path, FILE_URL_TTL)
  if (error || !data) {
    console.error('getAssignmentFileSignedUrl sign failed:', error?.message)
    return { error: am('urlFailed', lang) }
  }
  return { success: true as const, url: data.signedUrl }
}
