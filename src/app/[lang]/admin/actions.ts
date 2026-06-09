'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scheduleBookingReminders, cancelBookingReminders } from '@/lib/reminders'
import { escapeHtml, EMAIL_FROM, APP_URL } from '@/lib/email'

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
  const force = options.force ?? false

  // Load the booking once — both guards need it.
  const { data: booking } = await admin
    .from('bookings')
    .select('student_id, scheduled_at, duration_minutes')
    .eq('id', bookingId)
    .single()

  // Accepting-students gate: a paused teacher (accepting_students=false) is
  // excluded from NEW student assignments, but can still be re-assigned to a
  // student they already serve. Not force-overridable — pausing intake is the
  // teacher's own boundary, not an availability hint. See TE-01.
  if (booking?.student_id) {
    await assertTeacherAcceptsNewStudent(booking.student_id, teacherId)
  }

  // Primary-teacher continuity guard: once a student is locked to a teacher,
  // admin must force=true to switch them. Protects 1-teacher-per-student.
  if (booking?.student_id) {
    await assertPrimaryTeacherOk(booking.student_id, teacherId, force)
  }

  // Availability guard: block assignments outside the teacher's stated
  // availability unless the admin explicitly forces. Availability is stored
  // in America/Tegucigalpa (Honduras) per the teacher-side UI.
  if (!force && booking) {
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

  // Slot-conflict guard: don't drop this teacher onto a slot they've already
  // been confirmed for with a different student. Two students booking the
  // same wall-clock time stays legal at booking time (teacher_id is null);
  // it only becomes a problem here, when admin picks who gets the slot.
  if (!force && booking?.scheduled_at) {
    const conflict = await teacherHasConflict(teacherId, booking.scheduled_at, bookingId)
    if (conflict) {
      throw new Error(
        'Teacher already has a confirmed class at this time. Pick a different time or retry with force=true.',
      )
    }
  }

  const { error } = await admin
    .from('bookings')
    .update({ teacher_id: teacherId, status: 'confirmed' })
    .eq('id', bookingId)

  if (error) {
    // 23505 = unique_violation on bookings_teacher_time_unique (migration 027):
    // a concurrent assign confirmed this teacher onto the same slot first.
    // Surface the same human-readable message as the pre-check guard above.
    if (error.code === '23505') {
      throw new Error(
        'Teacher already has a confirmed class at this time. Pick a different time or retry with force=true.',
      )
    }
    throw new Error(error.message)
  }

  // First-class continuity lock: if the student has no primary teacher yet,
  // set it to the teacher we just assigned.
  if (booking?.student_id) await lockInPrimaryTeacher(booking.student_id, teacherId)

  // Fire-and-forget student + teacher emails so both sides know the class is locked in.
  sendAssignmentEmail(bookingId)

  // Schedule the 24h + 1h reminder emails on Resend's native scheduled-delivery.
  // Idempotent: cancels any existing scheduled emails for this booking first,
  // so re-running the admin "assign" action (e.g. force-switching teachers)
  // won't leave dangling scheduled sends.
  scheduleBookingReminders(bookingId).catch(() => {})

  revalidatePath('/', 'layout')
}

// Throws if the teacher has paused new-student intake (accepting_students=false)
// AND this would be a *new* student for them. A teacher who already serves this
// student — as their primary teacher or via an existing booking — can always be
// re-assigned, because pausing only gates NEW assignments, not the continuation
// of an established relationship. is_active (admin approval) is enforced
// separately and is not affected here. See TE-01.
async function assertTeacherAcceptsNewStudent(
  studentId: string,
  teacherId: string,
): Promise<void> {
  const admin = createAdminClient()

  const { data: teacher } = await admin
    .from('teachers')
    .select('accepting_students')
    .eq('id', teacherId)
    .single()

  // Default to accepting when the flag is missing/null — never block on absence.
  if (teacher?.accepting_students !== false) return

  // Teacher is paused. Allow only if a relationship already exists.
  const { data: student } = await admin
    .from('students')
    .select('primary_teacher_id')
    .eq('id', studentId)
    .single()
  if (student?.primary_teacher_id === teacherId) return

  const { data: priorBooking } = await admin
    .from('bookings')
    .select('id')
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .limit(1)
  if (priorBooking && priorBooking.length > 0) return

  throw new Error(
    'This teacher has paused new-student bookings and is not currently accepting new assignments.',
  )
}

// Throws if the student already has a different primary teacher (unless forced).
// The rule is a soft guarantee: the first teacher assigned becomes the primary,
// and subsequent switches require an explicit admin override to avoid accidental
// teacher-hopping across bookings. See `students.primary_teacher_id`.
async function assertPrimaryTeacherOk(
  studentId: string,
  teacherId: string,
  force: boolean,
): Promise<void> {
  const admin = createAdminClient()
  const { data: student } = await admin
    .from('students')
    .select('primary_teacher_id')
    .eq('id', studentId)
    .single()
  const existing = student?.primary_teacher_id ?? null
  if (existing && existing !== teacherId && !force) {
    throw new Error(
      'This student already has a primary teacher. Pass force=true to override the continuity rule.',
    )
  }
}

// True if the teacher already has a confirmed booking at this exact time
// for a different booking. Distinct from isTeacherAvailable, which only
// checks stated working hours — not other students already on the calendar.
async function teacherHasConflict(
  teacherId: string,
  scheduledAt: string,
  excludeBookingId: string,
): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('bookings')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('scheduled_at', scheduledAt)
    .eq('status', 'confirmed')
    .neq('id', excludeBookingId)
    .limit(1)
  return !!(data && data.length > 0)
}

// ── Reschedule-request actions (admin side) ──────────────────────────────────

export async function approveRescheduleRequest(
  requestId: string,
  adminNote: string = '',
) {
  const admin = await assertAdminAndClient()

  const { data: request } = await admin
    .from('reschedule_requests')
    .select('id, booking_id, proposed_scheduled_at, status')
    .eq('id', requestId)
    .single()
  if (!request) throw new Error('Request not found')
  if (request.status !== 'pending') throw new Error('Request already resolved')

  // Move the booking to the proposed time first; only record the approval if
  // the booking update succeeded so we never end up with an "approved" request
  // whose booking didn't actually move.
  const { error: bookingErr } = await admin
    .from('bookings')
    .update({ scheduled_at: request.proposed_scheduled_at })
    .eq('id', request.booking_id)
  if (bookingErr) throw new Error(bookingErr.message)

  const { error: updateErr } = await admin
    .from('reschedule_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      admin_note: adminNote.trim() || null,
    })
    .eq('id', requestId)
  if (updateErr) throw new Error(updateErr.message)

  // Re-schedule the reminder emails against the new time. `scheduleBookingReminders`
  // is idempotent: it cancels the existing Resend sends (which were queued
  // against the old `scheduled_at`) and queues fresh ones.
  scheduleBookingReminders(request.booking_id).catch(() => {})

  revalidatePath('/', 'layout')
}

export async function rejectRescheduleRequest(
  requestId: string,
  adminNote: string = '',
) {
  const admin = await assertAdminAndClient()

  const { data: request } = await admin
    .from('reschedule_requests')
    .select('id, status')
    .eq('id', requestId)
    .single()
  if (!request) throw new Error('Request not found')
  if (request.status !== 'pending') throw new Error('Request already resolved')

  const { error } = await admin
    .from('reschedule_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      admin_note: adminNote.trim() || null,
    })
    .eq('id', requestId)
  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
}

// Small helper: gate-then-client so the two reschedule actions don't repeat.
async function assertAdminAndClient() {
  await assertAdmin()
  return createAdminClient()
}

// Writes primary_teacher_id only if currently null — never silently reassigns.
async function lockInPrimaryTeacher(studentId: string, teacherId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: student } = await admin
    .from('students')
    .select('primary_teacher_id')
    .eq('id', studentId)
    .single()
  if (!student?.primary_teacher_id) {
    await admin
      .from('students')
      .update({ primary_teacher_id: teacherId })
      .eq('id', studentId)
  }
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

// Note: admin booking cancellation always goes through cancelBookingWithRefund
// (below) so the student's class credit — decremented at booking time — is
// returned. There is no no-refund admin cancel path (see audit EK-013).

// ── Student CRM actions ───────────────────────────────────────────────────────

export async function updateStudentLevel(studentId: string, level: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('students').update({ level }).eq('id', studentId)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function addStudentClasses(studentId: string, count: number) {
  await assertAdmin()
  const admin = createAdminClient()
  // Bound + integer-coerce: a negative count would covertly DECREMENT credits and
  // a huge one would grant unlimited classes. Use the atomic add_classes RPC
  // (SECURITY DEFINER, migration 015) — the old read-then-write lost concurrent
  // grants under load.
  const n = Math.trunc(Number(count))
  if (!Number.isFinite(n) || n < 1 || n > 100) {
    throw new Error('Class count must be between 1 and 100')
  }
  // add_classes no-ops silently on a non-existent id; keep the old 'Student not
  // found' behavior so a bad id surfaces instead of a false success toast.
  const { data: exists } = await admin.from('students').select('id').eq('id', studentId).maybeSingle()
  if (!exists) throw new Error('Student not found')
  const { error } = await admin.rpc('add_classes', { p_student_id: studentId, p_count: n })
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
    .select('student_id, type, status')
    .eq('id', bookingId)
    .single()
  if (fetchError || !booking) throw new Error('Booking not found')
  // Status guard: only a live (pending/confirmed) booking can be completed.
  // Without it, completing a cancelled booking resurrects it and re-fires the
  // placement side-effects below, corrupting counts. Throw (not silent no-op) so
  // the admin gets real feedback instead of a misleading success toast.
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    throw new Error('Only a pending or confirmed booking can be completed')
  }

  const { data: completedRows, error } = await admin
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId)
    .in('status', ['pending', 'confirmed'])
    .select('id')
  if (error) throw new Error(error.message)
  if (!completedRows || completedRows.length === 0) {
    // Lost a race to another completer — booking is already terminal.
    throw new Error('Only a pending or confirmed booking can be completed')
  }

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
  // Status-gated cancel: only refund when THIS call actually flips a live booking
  // to cancelled. Without the guard, repeated/raced admin cancels each re-credit
  // the student (credit inflation). Class bookings only — placements cost no credit.
  const { data: cancelledRows, error } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .in('status', ['pending', 'confirmed'])
    .select('id')
  if (error) throw new Error(error.message)
  if (cancelledRows && cancelledRows.length > 0 && booking?.type === 'class') {
    // Atomic SQL increment — a read-then-update loses concurrent refunds
    // under load. increment_classes is SECURITY DEFINER (migration 012).
    await admin.rpc('increment_classes', { p_student_id: booking.student_id })
  }

  cancelBookingReminders(bookingId).catch(() => {})

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
  if (apiKey && apiKey !== 're_placeholder' && data?.properties?.action_link) {
    const actionLink = data.properties.action_link
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject: 'Reset your password — EnglishKolab',
        html: `<p>Click below to reset your password:</p><a href="${actionLink}">Reset password</a>`,
        text: `Reset your password — EnglishKolab\n\nClick the link below to reset your password:\n${actionLink}\n\n— EnglishKolab`,
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

// Deactivate (or reactivate) an account by banning it at the auth layer, so a
// deactivated user genuinely cannot log in. profiles.id === auth.users.id.
// ban_duration 'none' lifts the ban. (Previously this set an invalid
// role='deactivated' that was silently ignored — audit EK-017.)
export async function setStudentDeactivated(profileId: string, deactivated: boolean) {
  await assertAdmin()
  const { createClient: createSupabaseAdmin } = await import('@supabase/supabase-js')
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
    ban_duration: deactivated ? '876000h' : 'none',
  })
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
  notes: string,
  options: { force?: boolean } = {},
) {
  await assertAdmin()
  const admin = createAdminClient()

  // Accepting-students gate + continuity guard: only apply when a teacher is
  // being pre-assigned here. The accepting-students gate excludes a paused
  // teacher from a NEW student but still permits an established relationship.
  if (teacherId) {
    await assertTeacherAcceptsNewStudent(studentId, teacherId)
    await assertPrimaryTeacherOk(studentId, teacherId, options.force ?? false)
  }

  // A class booking consumes one student credit (same as a self-served booking)
  // so a later cancel-refund returns a credit that was actually paid for. Without
  // this, an admin-created class would mint a free credit on cancel. Non-class
  // meetings (interviews / placement) cost no credit and skip this.
  let creditConsumed = false
  if (type === 'class') {
    const { data: ok } = await admin.rpc('decrement_classes', { p_student_id: studentId })
    if (!ok) throw new Error('Student has no class credits — grant classes before booking a class.')
    creditConsumed = true
  }

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
  if (error) {
    if (creditConsumed) await admin.rpc('increment_classes', { p_student_id: studentId })
    throw new Error(error.message)
  }

  if (teacherId) await lockInPrimaryTeacher(studentId, teacherId)

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
      const greeting = name ? `Hola ${escapeHtml(name)}` : 'Hola'
      const greetingText = name ? `Hola ${name}` : 'Hola'
      void fetch('https://api.resend.com/emails', {
        method: 'POST', headers,
        body: JSON.stringify({
          from: EMAIL_FROM, to: email,
          subject: 'Sesión agendada — EnglishKolab',
          html: `<p>${greeting},</p><p>Tienes una sesión agendada para el <strong>${formatted}</strong> (hora de Honduras).</p><p>— EnglishKolab</p>`,
          text: `${greetingText},\n\nTienes una sesión agendada para el ${formatted} (hora de Honduras).\n\n— EnglishKolab`,
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
        const greeting = name ? `Hola ${escapeHtml(name)}` : 'Hola'
        const greetingText = name ? `Hola ${name}` : 'Hola'
        void fetch('https://api.resend.com/emails', {
          method: 'POST', headers,
          body: JSON.stringify({
            from: EMAIL_FROM, to: email,
            subject: 'Nueva sesión asignada — EnglishKolab',
            html: `<p>${greeting},</p><p>Tienes una sesión agendada para el <strong>${formatted}</strong> (hora de Honduras).</p><p>— EnglishKolab</p>`,
            text: `${greetingText},\n\nTienes una sesión agendada para el ${formatted} (hora de Honduras).\n\n— EnglishKolab`,
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
  if (apiKey && apiKey !== 're_placeholder' && profile?.email) {
    const dashboardUrl = `${APP_URL}/es/maestro/dashboard`
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: profile.email,
        subject: `¡Bienvenida a EnglishKolab, ${profile.full_name?.split(' ')[0] || ''}!`,
        html: `
          <h2>¡Bienvenida al equipo!</h2>
          <p>Tu perfil ha sido aprobado. Ya puedes acceder a tu dashboard:</p>
          <p><a href="${dashboardUrl}">Acceder a mi dashboard →</a></p>
          <p>Aquí podrás configurar tu disponibilidad y ver tus clases asignadas.</p>
          <p>— El equipo de EnglishKolab</p>
        `,
        text: `¡Bienvenida al equipo!\n\nTu perfil ha sido aprobado. Ya puedes acceder a tu dashboard:\n${dashboardUrl}\n\nAquí podrás configurar tu disponibilidad y ver tus clases asignadas.\n\n— El equipo de EnglishKolab`,
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
  if (apiKey && apiKey !== 're_placeholder' && profile?.email) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: profile.email,
        subject: 'Actualización sobre tu solicitud — EnglishKolab',
        html: `
          <p>Gracias por tu interés en EnglishKolab.</p>
          <p>Después de revisar tu perfil, no podemos continuar con tu solicitud en este momento.</p>
          <p>Si tienes preguntas, contáctanos en <a href="mailto:hola@englishkolab.com">hola@englishkolab.com</a>.</p>
          <p>— El equipo de EnglishKolab</p>
        `,
        text: `Gracias por tu interés en EnglishKolab.\n\nDespués de revisar tu perfil, no podemos continuar con tu solicitud en este momento.\n\nSi tienes preguntas, contáctanos en hola@englishkolab.com.\n\n— El equipo de EnglishKolab`,
      }),
    }).catch(() => {})
  }

  revalidatePath('/', 'layout')
}

export async function bulkAssignTeacher(
  bookingIds: string[],
  teacherId: string,
  options: { force?: boolean } = {},
) {
  await assertAdmin()
  const admin = createAdminClient()
  const force = options.force ?? false

  // Collect every student touched by this bulk assignment and validate each —
  // if any student is locked to a different primary teacher we abort the whole
  // batch unless force=true.
  const { data: touched } = await admin
    .from('bookings')
    .select('student_id')
    .in('id', bookingIds)
  const studentIds = Array.from(
    new Set((touched ?? []).map(b => b.student_id).filter((x): x is string => !!x)),
  )
  for (const sid of studentIds) {
    // Accepting-students gate per student — a paused teacher can only receive
    // students they already serve, even in a bulk assignment. See TE-01.
    await assertTeacherAcceptsNewStudent(sid, teacherId)
    await assertPrimaryTeacherOk(sid, teacherId, force)
  }

  // Slot-conflict guards: (a) two bookings in this batch can't share the
  // same wall-clock time on one teacher, (b) none of these times can already
  // be held by an existing confirmed booking for this teacher.
  if (!force) {
    const { data: batch } = await admin
      .from('bookings')
      .select('id, scheduled_at')
      .in('id', bookingIds)

    const seen = new Set<string>()
    for (const b of batch ?? []) {
      if (!b.scheduled_at) continue
      if (seen.has(b.scheduled_at)) {
        throw new Error(
          'This batch contains two bookings at the same time — assigning them to one teacher would double-book.',
        )
      }
      seen.add(b.scheduled_at)
    }

    for (const b of batch ?? []) {
      if (!b.scheduled_at) continue
      const conflict = await teacherHasConflict(teacherId, b.scheduled_at, b.id)
      if (conflict) {
        throw new Error(
          `Teacher already has a confirmed class at ${b.scheduled_at}. Adjust the batch or retry with force=true.`,
        )
      }
    }
  }

  const { error } = await admin
    .from('bookings')
    .update({ teacher_id: teacherId, status: 'confirmed' })
    .in('id', bookingIds)
  if (error) throw new Error(error.message)

  // Lock in primary teacher for any student that didn't have one yet.
  for (const sid of studentIds) await lockInPrimaryTeacher(sid, teacherId)

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
    const salaUrl = `${APP_URL}/es/sala/${bookingId}`

    const studentFirst = student?.full_name?.split(' ')[0] || ''
    const teacherFirst = teacher?.full_name?.split(' ')[0] || 'tu maestro'
    const studentLabel = student?.full_name || 'un estudiante'
    const isPlacement = data.type === 'placement_test'

    // Student email
    if (student?.email) {
      const subject = isPlacement
        ? 'Tu llamada de diagnóstico ha sido confirmada — EnglishKolab'
        : 'Tu clase ha sido confirmada — EnglishKolab'
      const lead = isPlacement
        ? `Tu llamada de diagnóstico con <strong>${escapeHtml(teacherFirst)}</strong> está confirmada.`
        : `Tu clase con <strong>${escapeHtml(teacherFirst)}</strong> está confirmada.`
      const leadText = isPlacement
        ? `Tu llamada de diagnóstico con ${teacherFirst} está confirmada.`
        : `Tu clase con ${teacherFirst} está confirmada.`
      void fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: student.email,
          subject,
          html: `
            <p>Hola ${escapeHtml(studentFirst)},</p>
            <p>${lead}</p>
            <p><strong>Cuándo:</strong> ${formatted} (hora de Honduras).</p>
            <p><a href="${salaUrl}">Unirse al aula</a> (se abre 15 minutos antes).</p>
            <p>— EnglishKolab</p>
          `,
          text: `Hola ${studentFirst},\n\n${leadText}\n\nCuándo: ${formatted} (hora de Honduras).\n\nUnirse al aula (se abre 15 minutos antes):\n${salaUrl}\n\n— EnglishKolab`,
        }),
      }).catch(() => {})
    }

    // Teacher email — was missing before. Teachers need the booking details
    // and the sala link to prep and join on time.
    if (teacher?.email) {
      const teacherSubject = isPlacement
        ? 'Nueva llamada de diagnóstico asignada — EnglishKolab'
        : 'Nueva clase asignada — EnglishKolab'
      const teacherLead = isPlacement
        ? `Te asignamos una llamada de diagnóstico con <strong>${escapeHtml(studentLabel)}</strong>.`
        : `Te asignamos una clase con <strong>${escapeHtml(studentLabel)}</strong>.`
      const teacherLeadText = isPlacement
        ? `Te asignamos una llamada de diagnóstico con ${studentLabel}.`
        : `Te asignamos una clase con ${studentLabel}.`
      void fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: teacher.email,
          subject: teacherSubject,
          html: `
            <p>Hola ${escapeHtml(teacherFirst)},</p>
            <p>${teacherLead}</p>
            <p><strong>Cuándo:</strong> ${formatted} (hora de Honduras).</p>
            <p><a href="${salaUrl}">Entrar al aula</a> (se abre 15 minutos antes).</p>
            <p>— EnglishKolab</p>
          `,
          text: `Hola ${teacherFirst},\n\n${teacherLeadText}\n\nCuándo: ${formatted} (hora de Honduras).\n\nEntrar al aula (se abre 15 minutos antes):\n${salaUrl}\n\n— EnglishKolab`,
        }),
      }).catch(() => {})
    }
  }).catch(() => {})
}
