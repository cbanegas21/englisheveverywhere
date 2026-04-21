'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_SCORES = new Set(['A1','A2','B1','B2','C1','C2','needs_work','good','excellent'])

type ActionResult<T = undefined> = T extends undefined
  ? { error: string } | { success: true }
  : { error: string } | { success: true; data: T }

async function requireTeacher() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'teacher') return { error: 'Teacher role required' as const }
  const admin = createAdminClient()
  const { data: teacher } = await admin.from('teachers').select('id').eq('profile_id', user.id).single()
  if (!teacher?.id) return { error: 'Teacher record not found' as const }
  return { admin, teacherId: teacher.id as string, userId: user.id }
}

async function requireStudent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const admin = createAdminClient()
  const { data: student } = await admin.from('students').select('id').eq('profile_id', user.id).single()
  if (!student?.id) return { error: 'Student record not found' as const }
  return { admin, studentId: student.id as string, userId: user.id }
}

export async function createAssignment(input: {
  studentId: string
  title: string
  instructions: string
  dueAt: string | null
}) {
  const ctx = await requireTeacher()
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const title = input.title.trim()
  if (!title) return { error: 'Title is required' }

  // Must have a non-cancelled booking with this student — same gate as
  // teacherSetStudentLevel so teachers can't assign to random students.
  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('student_id', input.studentId)
    .neq('status', 'cancelled')
  if (!count) return { error: 'You have no booking with this student' }

  const { data, error } = await admin
    .from('assignments')
    .insert({
      teacher_id: teacherId,
      student_id: input.studentId,
      title,
      instructions: input.instructions,
      due_at: input.dueAt,
      status: 'open',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true as const, id: data.id }
}

export async function cancelAssignment(assignmentId: string) {
  const ctx = await requireTeacher()
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  const { data: owner } = await admin
    .from('assignments')
    .select('teacher_id')
    .eq('id', assignmentId)
    .single()
  if (!owner || owner.teacher_id !== teacherId) return { error: 'Not your assignment' }

  const { error } = await admin
    .from('assignments')
    .update({ status: 'cancelled' })
    .eq('id', assignmentId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function submitAssignment(input: { assignmentId: string; text: string }) {
  const ctx = await requireStudent()
  if ('error' in ctx) return { error: ctx.error }
  const { admin, studentId } = ctx

  const text = input.text.trim()
  if (!text) return { error: 'Submission cannot be empty' }

  // Verify the assignment targets this student AND is still open.
  const { data: a } = await admin
    .from('assignments')
    .select('student_id, status')
    .eq('id', input.assignmentId)
    .single()
  if (!a || a.student_id !== studentId) return { error: 'Assignment not found' }
  if (a.status !== 'open') return { error: 'Assignment is no longer open' }

  // Upsert on assignment_id — each assignment has a single submission that
  // can be revised until the teacher grades it.
  const { data: existing } = await admin
    .from('assignment_submissions')
    .select('id, graded_at')
    .eq('assignment_id', input.assignmentId)
    .maybeSingle()

  if (existing?.graded_at) {
    return { error: 'This assignment has already been graded' }
  }

  if (existing) {
    const { error } = await admin
      .from('assignment_submissions')
      .update({ submitted_text: text, submitted_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin
      .from('assignment_submissions')
      .insert({
        assignment_id: input.assignmentId,
        submitted_text: text,
      })
    if (error) return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function gradeSubmission(input: {
  assignmentId: string
  feedback: string
  score: string | null
}) {
  const ctx = await requireTeacher()
  if ('error' in ctx) return { error: ctx.error }
  const { admin, teacherId } = ctx

  if (input.score !== null && !VALID_SCORES.has(input.score)) {
    return { error: 'Invalid score value' }
  }

  const { data: a } = await admin
    .from('assignments')
    .select('teacher_id')
    .eq('id', input.assignmentId)
    .single()
  if (!a || a.teacher_id !== teacherId) return { error: 'Not your assignment' }

  const { data: submission } = await admin
    .from('assignment_submissions')
    .select('id')
    .eq('assignment_id', input.assignmentId)
    .maybeSingle()
  if (!submission) return { error: 'No submission to grade yet' }

  const { error } = await admin
    .from('assignment_submissions')
    .update({
      teacher_feedback: input.feedback,
      score: input.score,
      graded_at: new Date().toISOString(),
    })
    .eq('id', submission.id)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true as const }
}
