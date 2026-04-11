'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Auth guard ────────────────────────────────────────────────────────────────

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Forbidden')
  return user
}

// ── Teacher actions ───────────────────────────────────────────────────────────

export async function approveTeacher(teacherId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('teachers')
    .update({ is_active: true })
    .eq('id', teacherId)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function rejectTeacher(teacherId: string, profileId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  // Delete teacher record first (FK cascade removes availability_slots)
  const { error: delError } = await admin
    .from('teachers')
    .delete()
    .eq('id', teacherId)

  if (delError) throw new Error(delError.message)

  // Downgrade profile back to student so they can re-register
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: 'student' })
    .eq('id', profileId)

  if (profileError) throw new Error(profileError.message)
  revalidatePath('/', 'layout')
}

export async function toggleTeacherActive(teacherId: string, isActive: boolean) {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('teachers')
    .update({ is_active: isActive })
    .eq('id', teacherId)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

// ── Booking actions ───────────────────────────────────────────────────────────

export async function assignAndConfirmBooking(bookingId: string, teacherId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('bookings')
    .update({ teacher_id: teacherId, status: 'confirmed' })
    .eq('id', bookingId)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function setTeacherRate(teacherId: string, rate: number) {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('teachers')
    .update({ hourly_rate: rate })
    .eq('id', teacherId)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function cancelBooking(bookingId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

// ── Student CRM actions ───────────────────────────────────────────────────────

export async function updateStudentLevel(studentId: string, level: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('students').update({ level }).eq('id', studentId)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function updateStudentTeacher(studentId: string, teacherId: string) {
  await assertAdmin()
  const admin = createAdminClient()
  // Update teacher on the most recent confirmed class booking
  const { data: booking } = await admin
    .from('bookings')
    .select('id')
    .eq('student_id', studentId)
    .eq('type', 'class')
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (booking) {
    const { error } = await admin.from('bookings').update({ teacher_id: teacherId }).eq('id', booking.id)
    if (error) throw new Error(error.message)
  }
  revalidatePath('/', 'layout')
}

export async function addStudentClasses(studentId: string, count: number) {
  await assertAdmin()
  const admin = createAdminClient()
  const { data: student, error: fetchError } = await admin
    .from('students')
    .select('classes_remaining')
    .eq('id', studentId)
    .single()
  if (fetchError || !student) throw new Error('Student not found')
  const { error } = await admin
    .from('students')
    .update({ classes_remaining: (student.classes_remaining || 0) + count })
    .eq('id', studentId)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function updateStudentProfile(
  profileId: string,
  studentId: string,
  fields: {
    full_name?: string
    timezone?: string
    preferred_language?: string
    learning_goal?: string
    work_description?: string
    learning_style?: string
    age_range?: string
  }
) {
  await assertAdmin()
  const admin = createAdminClient()
  const profileFields: Record<string, string> = {}
  const studentFields: Record<string, string> = {}
  if (fields.full_name !== undefined) profileFields.full_name = fields.full_name
  if (fields.timezone !== undefined) profileFields.timezone = fields.timezone
  if (fields.preferred_language !== undefined) profileFields.preferred_language = fields.preferred_language
  if (fields.learning_goal !== undefined) studentFields.learning_goal = fields.learning_goal
  if (fields.work_description !== undefined) studentFields.work_description = fields.work_description
  if (fields.learning_style !== undefined) studentFields.learning_style = fields.learning_style
  if (fields.age_range !== undefined) studentFields.age_range = fields.age_range
  if (Object.keys(profileFields).length > 0) {
    const { error } = await admin.from('profiles').update(profileFields).eq('id', profileId)
    if (error) throw new Error(error.message)
  }
  if (Object.keys(studentFields).length > 0) {
    const { error } = await admin.from('students').update(studentFields).eq('id', studentId)
    if (error) throw new Error(error.message)
  }
  revalidatePath('/', 'layout')
}

export async function completeBooking(bookingId: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('bookings').update({ status: 'completed' }).eq('id', bookingId)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function cancelBookingWithRefund(bookingId: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('student_id, type')
    .eq('id', bookingId)
    .single()
  const { error } = await admin.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
  if (error) throw new Error(error.message)
  // Restore class credit if it was a class booking
  if (booking?.type === 'class') {
    const { data: student } = await admin
      .from('students')
      .select('classes_remaining')
      .eq('id', booking.student_id)
      .single()
    if (student) {
      await admin
        .from('students')
        .update({ classes_remaining: (student.classes_remaining || 0) + 1 })
        .eq('id', booking.student_id)
    }
  }
  revalidatePath('/', 'layout')
}

export async function saveAdminNotes(studentId: string, notes: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('students').update({ admin_notes: notes }).eq('id', studentId)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function resetStudentPassword(email: string) {
  await assertAdmin()
  const { createClient: createSupabaseAdmin } = await import('@supabase/supabase-js')
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
  })
  if (error) throw new Error(error.message)
  // Send via Resend
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  if (apiKey && apiKey !== 're_placeholder' && data?.properties?.action_link) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: 'Reset your password — English Everywhere',
        html: `<p>Click below to reset your password:</p><a href="${data.properties.action_link}">Reset password</a>`,
      }),
    })
  }
  revalidatePath('/', 'layout')
}

export async function updateStudentRole(profileId: string, role: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ role }).eq('id', profileId)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}
