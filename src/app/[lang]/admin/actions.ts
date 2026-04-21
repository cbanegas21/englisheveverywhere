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

// Signed URL for a teacher's uploaded CV. 10-min TTL is enough for admin
// review; the bucket is private, so the URL is the only way in.
export async function getTeacherCvSignedUrl(teacherId: string): Promise<
  { success: true; url: string; filename: string | null }
  | { success: false; error: string }
> {
  await assertAdmin()
  const admin = createAdminClient()

  const { data: teacher, error } = await admin
    .from('teachers')
    .select('cv_storage_path, cv_original_filename')
    .eq('id', teacherId)
    .single()
  if (error || !teacher) return { success: false, error: 'Teacher not found' }
  if (!teacher.cv_storage_path) return { success: false, error: 'No CV on file' }

  const { data, error: signErr } = await admin.storage
    .from('teacher-docs')
    .createSignedUrl(teacher.cv_storage_path, 600)
  if (signErr || !data) return { success: false, error: signErr?.message || 'Could not sign URL' }

  return { success: true, url: data.signedUrl, filename: teacher.cv_original_filename || null }
}

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

export async function assignAndConfirmBooking(
  bookingId: string,
  teacherId: string,
  options: { force?: boolean } = {},
) {
  await assertAdmin()
  const admin = createAdminClient()

  // Availability guard: block assignments outside the teacher's stated
  // availability unless the admin explicitly forces. Availability is stored
  // in America/Tegucigalpa (Honduras) per the teacher-side UI.
  if (!options.force) {
    const { data: booking } = await admin
      .from('bookings')
      .select('scheduled_at, duration_minutes')
      .eq('id', bookingId)
      .single()
    if (booking) {
      const available = await isTeacherAvailable(
        teacherId,
        booking.scheduled_at,
        booking.duration_minutes ?? 60,
      )
      if (!available) {
        throw new Error(
          'Teacher is not available at this time. Ask them to add the slot to their availability or retry with force=true.',
        )
      }
    }
  }

  const { error } = await admin
    .from('bookings')
    .update({ teacher_id: teacherId, status: 'confirmed' })
    .eq('id', bookingId)

  if (error) throw new Error(error.message)

  // Fire-and-forget student + teacher emails so both sides know the class is locked in.
  sendAssignmentEmail(bookingId)

  revalidatePath('/', 'layout')
}

// Checks teacher availability_slots against a booking's scheduled window.
// Times in availability_slots are stored in Honduras local time (America/Tegucigalpa),
// day_of_week 0=Sunday per JS/Postgres convention.
async function isTeacherAvailable(
  teacherId: string,
  scheduledAtIso: string,
  durationMinutes: number,
): Promise<boolean> {
  const admin = createAdminClient()
  const scheduled = new Date(scheduledAtIso)
  // Extract HN wall-clock components via Intl — same tz used everywhere else
  // in the app for business time.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Tegucigalpa',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(scheduled)
  const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? 'Sun'
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '00'
  const minuteStr = parts.find(p => p.type === 'minute')?.value ?? '00'
  const DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const
  const dow = DAYS[weekdayStr as keyof typeof DAYS] ?? 0
  const startMinutes = parseInt(hourStr) * 60 + parseInt(minuteStr)
  const endMinutes = startMinutes + durationMinutes

  const { data: slots } = await admin
    .from('availability_slots')
    .select('start_time, end_time')
    .eq('teacher_id', teacherId)
    .eq('day_of_week', dow)
    .eq('is_active', true)

  if (!slots || slots.length === 0) return false

  return slots.some(slot => {
    const [sh, sm] = slot.start_time.split(':').map(Number)
    const [eh, em] = slot.end_time.split(':').map(Number)
    const slotStart = sh * 60 + sm
    const slotEnd = eh * 60 + em
    return slotStart <= startMinutes && slotEnd >= endMinutes
  })
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

export async function adminUpdateStudentProfile(
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
    primary_teacher_id?: string | null
  }
) {
  await assertAdmin()
  const admin = createAdminClient()
  const profileFields: Record<string, string> = {}
  const studentFields: Record<string, string | null> = {}
  if (fields.full_name !== undefined) profileFields.full_name = fields.full_name
  if (fields.timezone !== undefined) profileFields.timezone = fields.timezone
  if (fields.preferred_language !== undefined) profileFields.preferred_language = fields.preferred_language
  if (fields.learning_goal !== undefined) studentFields.learning_goal = fields.learning_goal
  if (fields.work_description !== undefined) studentFields.work_description = fields.work_description
  if (fields.learning_style !== undefined) studentFields.learning_style = fields.learning_style
  if (fields.age_range !== undefined) studentFields.age_range = fields.age_range
  if (fields.primary_teacher_id !== undefined) studentFields.primary_teacher_id = fields.primary_teacher_id
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

export async function setPrimaryTeacher(studentId: string, teacherId: string | null) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('students')
    .update({ primary_teacher_id: teacherId })
    .eq('id', studentId)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function completeBooking(bookingId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  const { data: booking, error: fetchError } = await admin
    .from('bookings')
    .select('student_id, type')
    .eq('id', bookingId)
    .single()
  if (fetchError || !booking) throw new Error('Booking not found')

  const { error } = await admin.from('bookings').update({ status: 'completed' }).eq('id', bookingId)
  if (error) throw new Error(error.message)

  // When a placement call is completed, mark the student as placement-done so the
  // onboarding flow advances. An accidental click is recoverable via the student
  // row edit — but without this the student is silently stranded.
  if (booking.type === 'placement_test') {
    await admin
      .from('students')
      .update({ placement_test_done: true, placement_scheduled: false })
      .eq('id', booking.student_id)
  }

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
  if (booking?.type === 'class') {
    // Atomic SQL increment — a read-then-update loses concurrent refunds
    // under load. increment_classes is SECURITY DEFINER (migration 012).
    await admin.rpc('increment_classes', { p_student_id: booking.student_id })
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
        subject: 'Reset your password — EnglishKolab',
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

// ── Teacher profile CRM actions ───────────────────────────────────────────────

export async function adminUpdateTeacherProfile(
  teacherId: string,
  profileId: string,
  fields: {
    bio?: string
    specializations?: string[]
    certifications?: string[]
    timezone?: string
    full_name?: string
  }
) {
  await assertAdmin()
  const admin = createAdminClient()
  const teacherFields: Record<string, unknown> = {}
  const profileFields: Record<string, string> = {}
  if (fields.bio !== undefined) teacherFields.bio = fields.bio
  if (fields.specializations !== undefined) teacherFields.specializations = fields.specializations
  if (fields.certifications !== undefined) teacherFields.certifications = fields.certifications
  if (fields.timezone !== undefined) profileFields.timezone = fields.timezone
  if (fields.full_name !== undefined) profileFields.full_name = fields.full_name
  if (Object.keys(teacherFields).length > 0) {
    const { error } = await admin.from('teachers').update(teacherFields).eq('id', teacherId)
    if (error) throw new Error(error.message)
  }
  if (Object.keys(profileFields).length > 0) {
    const { error } = await admin.from('profiles').update(profileFields).eq('id', profileId)
    if (error) throw new Error(error.message)
  }
  revalidatePath('/', 'layout')
}

export async function saveTeacherAdminNotes(teacherId: string, notes: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('teachers').update({ admin_notes: notes }).eq('id', teacherId)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function deleteTeacher(teacherId: string, profileId: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('teachers').delete().eq('id', teacherId)
  if (error) throw new Error(error.message)
  await admin.from('profiles').update({ role: 'student' }).eq('id', profileId)
  revalidatePath('/', 'layout')
}

// ── Meeting scheduler action ───────────────────────────────────────────────────

export async function createAdminBooking(
  studentId: string,
  teacherId: string | null,
  scheduledAt: string,
  type: string,
  durationMinutes: number,
  notes: string
) {
  await assertAdmin()
  const admin = createAdminClient()
  const { data: booking, error } = await admin
    .from('bookings')
    .insert({
      student_id: studentId,
      teacher_id: teacherId || null,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      status: 'confirmed',
      type,
      meeting_notes: notes || null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  // Send email notifications (non-blocking)
  sendBookingEmails({ studentId, teacherId, scheduledAt, type, bookingId: booking.id })

  revalidatePath('/', 'layout')
  return { success: true, bookingId: booking.id }
}

function sendBookingEmails(params: {
  studentId: string
  teacherId: string | null
  scheduledAt: string
  type: string
  bookingId: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  if (!apiKey || apiKey === 're_placeholder') return

  const admin = createAdminClient()
  const formatted = new Date(params.scheduledAt).toLocaleString('es-HN', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Tegucigalpa',
  })

  const headers: Record<string, string> = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  // Get student email
  void Promise.resolve(
    admin.from('students').select('profile:profiles(email, full_name)').eq('id', params.studentId).single()
  ).then(({ data }) => {
    const rawProfile = data?.profile
    let email: string | null = null
    let name: string | null = null
    if (Array.isArray(rawProfile)) {
      email = (rawProfile as { email: string | null; full_name: string | null }[])[0]?.email ?? null
      name = (rawProfile as { email: string | null; full_name: string | null }[])[0]?.full_name ?? null
    } else if (rawProfile && typeof rawProfile === 'object') {
      email = (rawProfile as { email: string | null; full_name: string | null }).email
      name = (rawProfile as { email: string | null; full_name: string | null }).full_name
    }
    if (email) {
      void fetch('https://api.resend.com/emails', {
        method: 'POST', headers,
        body: JSON.stringify({
          from: fromEmail, to: email,
          subject: 'Sesión agendada — EnglishKolab',
          html: `<p>Hola ${name || ''},</p><p>Tienes una sesión agendada para el <strong>${formatted}</strong> (hora de Honduras).</p><p>— EnglishKolab</p>`,
        }),
      }).catch(() => {})
    }
  }).catch(() => {})

  // Get teacher email (if assigned)
  if (params.teacherId) {
    void Promise.resolve(
      admin.from('teachers').select('profile:profiles(email, full_name)').eq('id', params.teacherId).single()
    ).then(({ data }) => {
      const rawProfile = data?.profile
      let email: string | null = null
      let name: string | null = null
      if (Array.isArray(rawProfile)) {
        email = (rawProfile as { email: string | null; full_name: string | null }[])[0]?.email ?? null
        name = (rawProfile as { email: string | null; full_name: string | null }[])[0]?.full_name ?? null
      } else if (rawProfile && typeof rawProfile === 'object') {
        email = (rawProfile as { email: string | null; full_name: string | null }).email
        name = (rawProfile as { email: string | null; full_name: string | null }).full_name
      }
      if (email) {
        void fetch('https://api.resend.com/emails', {
          method: 'POST', headers,
          body: JSON.stringify({
            from: fromEmail, to: email,
            subject: 'Nueva sesión asignada — EnglishKolab',
            html: `<p>Hola ${name || ''},</p><p>Tienes una sesión agendada para el <strong>${formatted}</strong> (hora de Honduras).</p><p>— EnglishKolab</p>`,
          }),
        }).catch(() => {})
      }
    }).catch(() => {})
  }
}

// ── Welcome / rejection emails (for approve/reject teacher) ───────────────────

export async function approveTeacherWithEmail(teacherId: string, profileId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  // Get teacher name + email for the welcome email
  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', profileId).single()

  const { error } = await admin.from('teachers').update({ is_active: true }).eq('id', teacherId)
  if (error) throw new Error(error.message)

  // Send welcome email (non-blocking)
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  if (apiKey && apiKey !== 're_placeholder' && profile?.email) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: profile.email,
        subject: `¡Bienvenida a EnglishKolab, ${profile.full_name?.split(' ')[0] || ''}!`,
        html: `
          <h2>¡Bienvenida al equipo!</h2>
          <p>Tu perfil ha sido aprobado. Ya puedes acceder a tu dashboard:</p>
          <p><a href="${appUrl}/es/maestro/dashboard">Acceder a mi dashboard →</a></p>
          <p>Aquí podrás configurar tu disponibilidad y ver tus clases asignadas.</p>
          <p>— El equipo de EnglishKolab</p>
        `,
      }),
    }).catch(() => {})
  }

  revalidatePath('/', 'layout')
}

export async function rejectTeacherWithEmail(teacherId: string, profileId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', profileId).single()

  const { error: delError } = await admin.from('teachers').delete().eq('id', teacherId)
  if (delError) throw new Error(delError.message)

  await admin.from('profiles').update({ role: 'student' }).eq('id', profileId)

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  if (apiKey && apiKey !== 're_placeholder' && profile?.email) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: profile.email,
        subject: 'Actualización sobre tu solicitud — EnglishKolab',
        html: `
          <p>Gracias por tu interés en EnglishKolab.</p>
          <p>Después de revisar tu perfil, no podemos continuar con tu solicitud en este momento.</p>
          <p>Si tienes preguntas, contáctanos en <a href="mailto:hola@englishkolab.com">hola@englishkolab.com</a>.</p>
          <p>— El equipo de EnglishKolab</p>
        `,
      }),
    }).catch(() => {})
  }

  revalidatePath('/', 'layout')
}

export async function bulkAssignTeacher(bookingIds: string[], teacherId: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('bookings')
    .update({ teacher_id: teacherId, status: 'confirmed' })
    .in('id', bookingIds)
  if (error) throw new Error(error.message)

  // Fan out assignment emails (fire-and-forget, same envelope for each student)
  for (const id of bookingIds) sendAssignmentEmail(id)

  revalidatePath('/', 'layout')
}

// ── Assignment email helper ───────────────────────────────────────────────────
//
// Sent when admin assigns a teacher to a pending booking (via assign button or
// drag-drop). The student already got a "booking received" email at creation
// time in `src/app/actions/booking.ts`, but that one said "our team will assign
// a teacher shortly" — this one closes the loop.

function sendAssignmentEmail(bookingId: string) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  if (!apiKey || apiKey === 're_placeholder') return

  const admin = createAdminClient()

  void Promise.resolve(
    admin
      .from('bookings')
      .select(`
        scheduled_at, type,
        student:students(profile:profiles(email, full_name)),
        teacher:teachers(profile:profiles(email, full_name))
      `)
      .eq('id', bookingId)
      .single()
  ).then(({ data }) => {
    if (!data) return

    const pickProfile = (raw: unknown): { email: string | null; full_name: string | null } | null => {
      const obj = Array.isArray(raw) ? raw[0] : raw
      if (!obj || typeof obj !== 'object') return null
      const profileRaw = (obj as { profile: unknown }).profile
      const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
      if (!profile || typeof profile !== 'object') return null
      const p = profile as { email?: string | null; full_name?: string | null }
      return { email: p.email ?? null, full_name: p.full_name ?? null }
    }

    const student = pickProfile(data.student)
    const teacher = pickProfile(data.teacher)

    const formatted = new Date(data.scheduled_at).toLocaleString('es-HN', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Tegucigalpa',
    })
    const salaUrl = `${appUrl}/es/sala/${bookingId}`

    const studentFirst = student?.full_name?.split(' ')[0] || ''
    const teacherFirst = teacher?.full_name?.split(' ')[0] || 'tu maestro'
    const isPlacement = data.type === 'placement_test'

    // Student email
    if (student?.email) {
      const subject = isPlacement
        ? 'Tu llamada de diagnóstico ha sido confirmada — EnglishKolab'
        : 'Tu clase ha sido confirmada — EnglishKolab'
      const lead = isPlacement
        ? `Tu llamada de diagnóstico con <strong>${teacherFirst}</strong> está confirmada.`
        : `Tu clase con <strong>${teacherFirst}</strong> está confirmada.`
      void fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: student.email,
          subject,
          html: `
            <p>Hola ${studentFirst},</p>
            <p>${lead}</p>
            <p><strong>Cuándo:</strong> ${formatted} (hora de Honduras).</p>
            <p><a href="${salaUrl}">Unirse al aula</a> (se abre 15 minutos antes).</p>
            <p>— EnglishKolab</p>
          `,
        }),
      }).catch(() => {})
    }

    // Teacher email — was missing before. Teachers need the booking details
    // and the sala link to prep and join on time.
    if (teacher?.email) {
      const studentLabel = student?.full_name || 'un estudiante'
      const teacherSubject = isPlacement
        ? 'Nueva llamada de diagnóstico asignada — EnglishKolab'
        : 'Nueva clase asignada — EnglishKolab'
      const teacherLead = isPlacement
        ? `Te asignamos una llamada de diagnóstico con <strong>${studentLabel}</strong>.`
        : `Te asignamos una clase con <strong>${studentLabel}</strong>.`
      void fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: teacher.email,
          subject: teacherSubject,
          html: `
            <p>Hola ${teacherFirst},</p>
            <p>${teacherLead}</p>
            <p><strong>Cuándo:</strong> ${formatted} (hora de Honduras).</p>
            <p><a href="${salaUrl}">Entrar al aula</a> (se abre 15 minutos antes).</p>
            <p>— EnglishKolab</p>
          `,
        }),
      }).catch(() => {})
    }
  }).catch(() => {})
}
