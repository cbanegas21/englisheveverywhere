'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scheduleBookingReminders, cancelBookingReminders } from '@/lib/reminders'
import { escapeHtml, brandedEmail, EMAIL_FROM, APP_URL } from '@/lib/email'
import { isValidTimeZone } from '@/lib/timezone'
import { studentHasTimeConflict } from '@/lib/bookingConflict'

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
  // it only becomes a problem here, when admin picks who gets the slot. This is
  // a hard invariant also enforced by bookings_teacher_time_unique, so it runs
  // even under force — force only relaxes the stated-hours availability guard
  // above. The message therefore never offers "force=true".
  if (booking?.scheduled_at) {
    const conflict = await teacherHasConflict(teacherId, booking.scheduled_at, bookingId)
    if (conflict) {
      throw new Error(
        'Teacher already has a confirmed class at this time. Pick a different time.',
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
        'Teacher already has a confirmed class at this time. Pick a different time.',
      )
    }
    throw new Error(error.message)
  }

  // First-class continuity lock: if the student has no primary teacher yet,
  // set it to the teacher we just assigned. Non-blocking — the booking is
  // already confirmed, so a continuity-hint failure must not surface as an error.
  if (booking?.student_id) await lockInPrimaryTeacher(booking.student_id, teacherId).catch(() => {})

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
  excludeBookingId?: string,
): Promise<boolean> {
  const admin = createAdminClient()
  let query = admin
    .from('bookings')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('scheduled_at', scheduledAt)
    .eq('status', 'confirmed')
  // Exclude the booking being moved/assigned when one already exists. For a
  // brand-new booking (createAdminBooking) there's no id yet, and `.neq('id', '')`
  // would be an invalid-uuid error — so we just skip the exclusion in that case.
  if (excludeBookingId) query = query.neq('id', excludeBookingId)
  const { data } = await query.limit(1)
  return !!(data && data.length > 0)
}

// ── Reschedule-request actions (admin side) ──────────────────────────────────

export async function approveRescheduleRequest(
  requestId: string,
  adminNote: string = '',
  options: { force?: boolean } = {},
) {
  const admin = await assertAdminAndClient()
  const force = options.force ?? false

  const { data: request } = await admin
    .from('reschedule_requests')
    .select('id, booking_id, proposed_scheduled_at, original_scheduled_at, status')
    .eq('id', requestId)
    .single()
  if (!request) throw new Error('Request not found')
  if (request.status !== 'pending') throw new Error('Request already resolved')

  // Re-check the teacher against the PROPOSED time before moving the booking —
  // a reschedule can land outside the teacher's stated hours or collide with
  // another confirmed class, same as a fresh assignment (ADMIN-04). Only
  // meaningful once a teacher is assigned. Stated-hours availability is admin-
  // overridable (force) and only constrains real classes; the slot conflict is
  // a hard invariant (also DB-enforced by bookings_teacher_time_unique) so it
  // is NOT force-overridable.
  const { data: booking } = await admin
    .from('bookings')
    .select('teacher_id, duration_minutes, type, status, scheduled_at')
    .eq('id', request.booking_id)
    .single()

  // Backstop for orphaned requests (BOOK-04): if the underlying booking was
  // cancelled or completed (by a student cancel/reschedule, a no-show report, a
  // teacher decline, etc.) the request is stale — never move a dead booking. The
  // student-side paths also proactively cancel open requests, but this guard
  // closes every other source at the point of approval.
  if (!booking) throw new Error('Booking not found')
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    throw new Error('This booking can no longer be rescheduled — it was cancelled or completed.')
  }

  // Freshness guard (BOOK-04): a student reschedule leaves the booking 'pending'
  // (so the status backstop above can't catch it) but MOVES its scheduled_at.
  // The teacher's request proposed a time relative to the OLD slot, so approving
  // it would silently overwrite the student's newer time. If the booking has
  // moved since the request was filed, treat the request as stale. This holds
  // even when the proactive request-cancel in studentRescheduleBooking failed.
  if (
    request.original_scheduled_at && booking.scheduled_at &&
    new Date(booking.scheduled_at).getTime() !== new Date(request.original_scheduled_at).getTime()
  ) {
    throw new Error('This booking has moved since the request was filed — the request is stale.')
  }

  if (booking?.teacher_id) {
    if (!force && booking.type === 'class') {
      const available = await isTeacherAvailable(
        booking.teacher_id,
        request.proposed_scheduled_at,
        booking.duration_minutes ?? 60,
      )
      if (!available) {
        throw new Error(
          'Teacher is not available at the proposed time. Ask them to add the slot to their availability or retry with force=true.',
        )
      }
    }
    const conflict = await teacherHasConflict(
      booking.teacher_id,
      request.proposed_scheduled_at,
      request.booking_id,
    )
    if (conflict) {
      throw new Error('Teacher already has a confirmed class at the proposed time. Pick a different time.')
    }
  }

  // Move the booking to the proposed time first; only record the approval if
  // the booking update succeeded so we never end up with an "approved" request
  // whose booking didn't actually move.
  const { error: bookingErr } = await admin
    .from('bookings')
    .update({ scheduled_at: request.proposed_scheduled_at })
    .eq('id', request.booking_id)
  if (bookingErr) {
    // 23505 = the teacher's confirmed-slot unique index — a concurrent assign
    // grabbed the proposed time first. Surface the same human-readable message.
    if (bookingErr.code === '23505') {
      throw new Error('Teacher already has a confirmed class at the proposed time. Pick a different time.')
    }
    throw new Error(bookingErr.message)
  }

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

// Direct admin reschedule (AD-03 drag-to-reschedule). Admin has the authority to
// move a booking's time without the teacher request-and-approve flow, so this
// commits immediately — but it mirrors EVERY guard in approveRescheduleRequest /
// createAdminBooking so a drag can never persist a state the DB or business rules
// would reject. Keeps the booking's current status (a student reschedule drops to
// 'pending' for re-confirmation; an admin move is authoritative and does not).
export async function adminRescheduleBooking(
  bookingId: string,
  newScheduledAt: string,
  options: { force?: boolean } = {},
) {
  await assertAdmin()
  const admin = createAdminClient()
  const force = options.force ?? false

  const { data: booking } = await admin
    .from('bookings')
    .select('student_id, teacher_id, scheduled_at, duration_minutes, type, status')
    .eq('id', bookingId)
    .single()
  if (!booking) throw new Error('Booking not found')
  // Never move a dead booking (mirrors approveRescheduleRequest C3).
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    throw new Error('This booking can no longer be rescheduled — it was cancelled or completed.')
  }

  // Validate + bound the new time (admin window: −24h … +180d, same as createAdminBooking).
  const when = new Date(newScheduledAt)
  if (isNaN(when.getTime())) throw new Error('Invalid date/time for the booking.')
  const nowMs = Date.now()
  if (when.getTime() < nowMs - 24 * 60 * 60 * 1000) throw new Error('Scheduled time is in the past.')
  if (when.getTime() > nowMs + 180 * 24 * 60 * 60 * 1000) {
    throw new Error('Scheduled time is too far in the future (max 180 days).')
  }
  // No-op move — nothing to do.
  if (new Date(booking.scheduled_at).getTime() === when.getTime()) return

  const duration = booking.duration_minutes ?? 60

  // Student interval-overlap (BOOKING-05), excluding the booking being moved.
  if (await studentHasTimeConflict(admin, booking.student_id, newScheduledAt, duration, bookingId)) {
    throw new Error('That time overlaps another class for this student. Pick a different time.')
  }

  if (booking.teacher_id) {
    // Stated-hours availability: force-overridable, real classes only.
    if (!force && booking.type === 'class') {
      const available = await isTeacherAvailable(booking.teacher_id, newScheduledAt, duration)
      if (!available) {
        throw new Error(
          'Teacher is not available at this time. Ask them to add the slot to their availability or retry with force=true.',
        )
      }
    }
    // Confirmed-slot conflict: hard invariant (also DB-enforced), runs even under force.
    const conflict = await teacherHasConflict(booking.teacher_id, newScheduledAt, bookingId)
    if (conflict) {
      throw new Error('Teacher already has a confirmed class at this time. Pick a different time.')
    }
  }

  const { error } = await admin
    .from('bookings')
    .update({ scheduled_at: newScheduledAt })
    .eq('id', bookingId)
  if (error) {
    // 23505 = a unique index grabbed the slot first. This can be either the
    // teacher confirmed-slot index OR the student non-cancelled-slot index (which
    // also covers a pending booking), so keep the message neutral rather than
    // claiming a "confirmed" clash that may not be the real cause.
    if (error.code === '23505') {
      throw new Error('That time is no longer available — pick a different time.')
    }
    throw new Error(error.message)
  }

  // Re-queue reminders ONLY for a confirmed class that has a teacher — that's the
  // one shape scheduleBookingReminders has correct copy for (it sends a "class
  // confirmed" email + T-24h/T-1h class reminders). For a still-pending/teacherless
  // booking (a false "confirmed" email) or a non-class meeting (wrong copy), wipe
  // any stale scheduled sends instead, mirroring studentRescheduleBooking.
  if (booking.status === 'confirmed' && booking.teacher_id && booking.type === 'class') {
    scheduleBookingReminders(bookingId).catch(() => {})
  } else {
    cancelBookingReminders(bookingId).catch(() => {})
  }

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
  if (fields.timezone !== undefined) {
    if (!isValidTimeZone(fields.timezone)) throw new Error('Invalid timezone')
    profileFields.timezone = fields.timezone
  }
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
  // Send via Resend, in the recipient's own language (was ES-agnostic English).
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey && apiKey !== 're_placeholder' && data?.properties?.action_link) {
    const actionLink = data.properties.action_link
    const { data: prof } = await supabaseAdmin.from('profiles').select('preferred_language').eq('email', email).maybeSingle()
    const lang: 'es' | 'en' = prof?.preferred_language === 'en' ? 'en' : 'es'
    const subject = lang === 'es' ? 'Restablece tu contraseña — EnglishKolab' : 'Reset your password — EnglishKolab'
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject,
        html: brandedEmail({
          heading: lang === 'es' ? 'Restablece tu contraseña' : 'Reset your password',
          bodyHtml: lang === 'es'
            ? '<p>Recibimos una solicitud para restablecer tu contraseña. Toca el botón para crear una nueva.</p>'
            : '<p>We received a request to reset your password. Tap the button to create a new one.</p>',
          ctaLabel: lang === 'es' ? 'Restablecer contraseña' : 'Reset password',
          ctaUrl: actionLink,
          footnote: lang === 'es'
            ? 'Si no solicitaste esto, puedes ignorar este correo.'
            : "If you didn't request this, you can safely ignore this email.",
          lang,
        }),
        text: lang === 'es'
          ? `Restablece tu contraseña — EnglishKolab\n\nToca el enlace para crear una nueva contraseña:\n${actionLink}\n\nSi no solicitaste esto, ignora este correo.`
          : `Reset your password — EnglishKolab\n\nTap the link to create a new password:\n${actionLink}\n\nIf you didn't request this, you can safely ignore this email.`,
      }),
    })
  }
  revalidatePath('/', 'layout')
}

export async function updateStudentRole(profileId: string, role: string) {
  const acting = await assertAdmin()
  // Allowlist — never write an arbitrary role string to profiles.role.
  if (!['student', 'teacher', 'admin'].includes(role)) {
    throw new Error('Invalid role')
  }
  // An admin must not demote themselves out of admin — that's a one-click lockout.
  if (profileId === acting.id && role !== 'admin') {
    throw new Error('You cannot change your own admin role')
  }
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
  const acting = await assertAdmin()
  // An admin must not ban themselves out of the platform.
  if (profileId === acting.id && deactivated) {
    throw new Error('You cannot deactivate your own account')
  }
  // Don't let one admin ban another admin (or the last admin) from this CRM
  // action — admin lifecycle is an out-of-band/service-role concern.
  if (deactivated) {
    const adminDb = createAdminClient()
    const { data: target } = await adminDb.from('profiles').select('role').eq('id', profileId).single()
    if (target?.role === 'admin') {
      throw new Error('Admin accounts cannot be deactivated here')
    }
  }
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
  if (fields.timezone !== undefined) {
    if (!isValidTimeZone(fields.timezone)) throw new Error('Invalid timezone')
    profileFields.timezone = fields.timezone
  }
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

  // Reject a malformed / out-of-range schedule BEFORE any availability check or
  // credit decrement (ADMIN-05). A NaN/past/far-future date or an unbounded
  // duration would otherwise persist a junk booking (and a NaN sails past the
  // availability math). Messages stay English by design (admin-only surface).
  const when = new Date(scheduledAt)
  if (isNaN(when.getTime())) {
    throw new Error('Invalid date/time for the booking.')
  }
  const nowMs = Date.now()
  if (when.getTime() < nowMs - 24 * 60 * 60 * 1000) {
    throw new Error('Scheduled time is in the past.')
  }
  if (when.getTime() > nowMs + 180 * 24 * 60 * 60 * 1000) {
    throw new Error('Scheduled time is too far in the future (max 180 days).')
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
    throw new Error('Duration must be an integer between 15 and 240 minutes.')
  }
  // Whitelist the booking type server-side — the UI offers exactly these four,
  // but the action must not trust an arbitrary caller-supplied string (ADMIN-05
  // defense-in-depth; partial ADMIN-03).
  const ALLOWED_BOOKING_TYPES = ['placement_test', 'class', 'teacher_interview', 'admin_checkin']
  if (!ALLOWED_BOOKING_TYPES.includes(type)) {
    throw new Error('Invalid booking type.')
  }

  // Accepting-students gate + continuity guard: only apply when a teacher is
  // being pre-assigned here. The accepting-students gate excludes a paused
  // teacher from a NEW student but still permits an established relationship.
  if (teacherId) {
    await assertTeacherAcceptsNewStudent(studentId, teacherId)
    await assertPrimaryTeacherOk(studentId, teacherId, options.force ?? false)

    // Availability + slot-conflict guards when a teacher is pre-assigned (same
    // as assignAndConfirmBooking) — run BEFORE consuming a credit so a blocked
    // booking never leaves the student short a class (ADMIN-05). Stated-hours
    // availability is admin-overridable and only constrains real classes;
    // interviews/check-ins/placement happen outside the teacher's student-facing
    // slots. The slot conflict (two confirmed bookings on one wall-clock time) is
    // a hard invariant also enforced by bookings_teacher_time_unique, so it is
    // NOT force-overridable and is checked for every type.
    if (!(options.force ?? false) && type === 'class') {
      const available = await isTeacherAvailable(teacherId, scheduledAt, durationMinutes ?? 60)
      if (!available) {
        throw new Error(
          'Teacher is not available at this time. Ask them to add the slot to their availability or retry with force=true.',
        )
      }
    }
    const conflict = await teacherHasConflict(teacherId, scheduledAt)
    if (conflict) {
      throw new Error('Teacher already has a confirmed class at this time. Pick a different time.')
    }
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
    // 23505 = a confirmed-slot unique index (teacher or student) — the slot was
    // taken between the pre-check and the insert. Hard invariant; not forceable.
    if (error.code === '23505') {
      throw new Error('This time slot is already taken by a confirmed booking. Pick a different time.')
    }
    throw new Error(error.message)
  }

  // Non-blocking — the booking is already confirmed and the credit consumed, so
  // a continuity-hint failure must not surface as an error to the admin.
  if (teacherId) await lockInPrimaryTeacher(studentId, teacherId).catch(() => {})

  // Send email notifications (non-blocking)
  sendBookingEmails({ studentId, teacherId, scheduledAt, type, bookingId: booking.id })

  revalidatePath('/', 'layout')
  return { success: true, bookingId: booking.id }
}

// ── Shared helpers for admin notification emails (E8) ─────────────────────────
//
// Supabase embeds a to-one relation as either an object or a single-element
// array depending on the query, so normalize both. preferred_language drives the
// per-recipient language so a student and teacher each get their own locale.

type EmailProfile = { email: string | null; name: string | null; lang: 'es' | 'en' }

function pickEmailProfile(raw: unknown): EmailProfile {
  const obj = Array.isArray(raw) ? raw[0] : raw
  if (!obj || typeof obj !== 'object') return { email: null, name: null, lang: 'es' }
  const p = obj as { email?: string | null; full_name?: string | null; preferred_language?: string | null }
  return {
    email: p.email ?? null,
    name: p.full_name ?? null,
    lang: p.preferred_language === 'en' ? 'en' : 'es',
  }
}

function formatSessionTime(scheduledAt: string, lang: 'es' | 'en'): string {
  return new Date(scheduledAt).toLocaleString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Tegucigalpa',
  })
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
  const headers: Record<string, string> = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  // Send one notification in the recipient's own language.
  const send = (p: EmailProfile, role: 'student' | 'teacher') => {
    if (!p.email) return
    const formatted = formatSessionTime(params.scheduledAt, p.lang)
    const hi = p.lang === 'es' ? 'Hola' : 'Hi'
    const greeting = p.name ? `${hi} ${escapeHtml(p.name)}` : hi
    const greetingText = p.name ? `${hi} ${p.name}` : hi
    const subject = role === 'student'
      ? (p.lang === 'es' ? 'Sesión agendada — EnglishKolab' : 'Session scheduled — EnglishKolab')
      : (p.lang === 'es' ? 'Nueva sesión asignada — EnglishKolab' : 'New session assigned — EnglishKolab')
    const line = p.lang === 'es'
      ? `Tienes una sesión agendada para el <strong>${formatted}</strong> (hora de Honduras).`
      : `You have a session scheduled for <strong>${formatted}</strong> (Honduras time).`
    const lineText = p.lang === 'es'
      ? `Tienes una sesión agendada para el ${formatted} (hora de Honduras).`
      : `You have a session scheduled for ${formatted} (Honduras time).`
    const heading = role === 'student'
      ? (p.lang === 'es' ? 'Sesión agendada' : 'Session scheduled')
      : (p.lang === 'es' ? 'Nueva sesión asignada' : 'New session assigned')
    void fetch('https://api.resend.com/emails', {
      method: 'POST', headers,
      body: JSON.stringify({
        from: EMAIL_FROM, to: p.email,
        subject,
        html: brandedEmail({ heading, bodyHtml: `<p>${greeting},</p><p>${line}</p>`, lang: p.lang }),
        text: `${greetingText},\n\n${lineText}\n\n— EnglishKolab`,
      }),
    }).catch(() => {})
  }

  // Student
  void Promise.resolve(
    admin.from('students').select('profile:profiles(email, full_name, preferred_language)').eq('id', params.studentId).single()
  ).then(({ data }) => send(pickEmailProfile(data?.profile), 'student')).catch(() => {})

  // Teacher (if assigned)
  if (params.teacherId) {
    void Promise.resolve(
      admin.from('teachers').select('profile:profiles(email, full_name, preferred_language)').eq('id', params.teacherId).single()
    ).then(({ data }) => send(pickEmailProfile(data?.profile), 'teacher')).catch(() => {})
  }
}

// ── Welcome / rejection emails (for approve/reject teacher) ───────────────────

export async function approveTeacherWithEmail(teacherId: string, profileId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  // Get teacher name + email + locale for the welcome email (E9 — was ES-only).
  const { data: profile } = await admin.from('profiles').select('full_name, email, preferred_language').eq('id', profileId).single()

  const { error } = await admin.from('teachers').update({ is_active: true }).eq('id', teacherId)
  if (error) throw new Error(error.message)

  // Send welcome email (non-blocking), in the teacher's own language.
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey && apiKey !== 're_placeholder' && profile?.email) {
    const lang = profile.preferred_language === 'en' ? 'en' : 'es'
    const firstName = profile.full_name?.split(' ')[0] || ''
    const dashboardUrl = `${APP_URL}/${lang}/maestro/dashboard`
    const subject = lang === 'es'
      ? `¡Bienvenida a EnglishKolab, ${firstName}!`
      : `Welcome to EnglishKolab, ${firstName}!`
    const html = brandedEmail({
      heading: lang === 'es' ? '¡Bienvenida al equipo!' : 'Welcome to the team!',
      bodyHtml: lang === 'es'
        ? '<p>Tu perfil ha sido aprobado. Ya puedes acceder a tu panel de maestro.</p><p>Ahí podrás configurar tu disponibilidad y ver tus clases asignadas.</p>'
        : '<p>Your profile has been approved. You can now access your teacher dashboard.</p><p>There you can set your availability and see your assigned classes.</p>',
      ctaLabel: lang === 'es' ? 'Acceder a mi panel' : 'Go to my dashboard',
      ctaUrl: dashboardUrl,
      lang,
    })
    const text = lang === 'es'
      ? `¡Bienvenida al equipo!\n\nTu perfil ha sido aprobado. Ya puedes acceder a tu dashboard:\n${dashboardUrl}\n\nAquí podrás configurar tu disponibilidad y ver tus clases asignadas.\n\n— El equipo de EnglishKolab`
      : `Welcome to the team!\n\nYour profile has been approved. You can now access your dashboard:\n${dashboardUrl}\n\nThere you can set your availability and see your assigned classes.\n\n— The EnglishKolab team`
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: profile.email,
        subject,
        html,
        text,
      }),
    }).catch(() => {})
  }

  revalidatePath('/', 'layout')
}

export async function rejectTeacherWithEmail(teacherId: string, profileId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('full_name, email, preferred_language').eq('id', profileId).single()

  const { error: delError } = await admin.from('teachers').delete().eq('id', teacherId)
  if (delError) throw new Error(delError.message)

  await admin.from('profiles').update({ role: 'student' }).eq('id', profileId)

  const apiKey = process.env.RESEND_API_KEY
  if (apiKey && apiKey !== 're_placeholder' && profile?.email) {
    // Send the rejection notice in the applicant's own language (E9 — was ES-only).
    const lang = profile.preferred_language === 'en' ? 'en' : 'es'
    const subject = lang === 'es'
      ? 'Actualización sobre tu solicitud — EnglishKolab'
      : 'Update on your application — EnglishKolab'
    const html = brandedEmail({
      heading: lang === 'es' ? 'Sobre tu solicitud' : 'About your application',
      bodyHtml: lang === 'es'
        ? '<p>Gracias por tu interés en EnglishKolab.</p><p>Después de revisar tu perfil, no podemos continuar con tu solicitud en este momento.</p><p>Si tienes preguntas, escríbenos a <a href="mailto:hola@englishkolab.com" style="color:#C41E3A;">hola@englishkolab.com</a>.</p>'
        : '<p>Thank you for your interest in EnglishKolab.</p><p>After reviewing your profile, we\'re unable to move forward with your application at this time.</p><p>If you have any questions, contact us at <a href="mailto:hola@englishkolab.com" style="color:#C41E3A;">hola@englishkolab.com</a>.</p>',
      lang,
    })
    const text = lang === 'es'
      ? `Gracias por tu interés en EnglishKolab.\n\nDespués de revisar tu perfil, no podemos continuar con tu solicitud en este momento.\n\nSi tienes preguntas, contáctanos en hola@englishkolab.com.\n\n— El equipo de EnglishKolab`
      : `Thank you for your interest in EnglishKolab.\n\nAfter reviewing your profile, we're unable to move forward with your application at this time.\n\nIf you have any questions, contact us at hola@englishkolab.com.\n\n— The EnglishKolab team`
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: profile.email,
        subject,
        html,
        text,
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
  // be held by an existing confirmed booking for this teacher. Both are hard
  // invariants also enforced by bookings_teacher_time_unique, so they run even
  // under force (force only relaxes primary-teacher continuity above) and their
  // messages never offer "force=true".
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
        `Teacher already has a confirmed class at ${b.scheduled_at}. Adjust the batch and pick a different time.`,
      )
    }
  }

  const { error } = await admin
    .from('bookings')
    .update({ teacher_id: teacherId, status: 'confirmed' })
    .in('id', bookingIds)
  if (error) {
    // 23505 = a concurrent assign grabbed one of these slots first (hard invariant).
    if (error.code === '23505') {
      throw new Error('One of these times is already taken by a confirmed booking for this teacher. Adjust the batch and try again.')
    }
    throw new Error(error.message)
  }

  // Lock in primary teacher for any student that didn't have one yet. Non-blocking —
  // the bookings are already confirmed, so a continuity-hint failure must not throw.
  for (const sid of studentIds) await lockInPrimaryTeacher(sid, teacherId).catch(() => {})

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
        student:students(profile:profiles(email, full_name, preferred_language)),
        teacher:teachers(profile:profiles(email, full_name, preferred_language))
      `)
      .eq('id', bookingId)
      .single()
  ).then(({ data }) => {
    if (!data) return

    // Unwrap the students/teachers → profiles embed, then normalize to an
    // EmailProfile (handles object-vs-array shape + per-recipient locale).
    const unwrapProfile = (raw: unknown): unknown => {
      const obj = Array.isArray(raw) ? raw[0] : raw
      if (!obj || typeof obj !== 'object') return null
      return (obj as { profile: unknown }).profile
    }
    const student = pickEmailProfile(unwrapProfile(data.student))
    const teacher = pickEmailProfile(unwrapProfile(data.teacher))

    const isPlacement = data.type === 'placement_test'
    const studentFirst = student.name?.split(' ')[0] || ''
    const teacherFirstRaw = teacher.name?.split(' ')[0] || null

    // Student email — in the student's language.
    if (student.email) {
      const lang = student.lang
      const formatted = formatSessionTime(data.scheduled_at, lang)
      const salaUrl = `${APP_URL}/${lang}/sala/${bookingId}`
      const teacherFirst = teacherFirstRaw || (lang === 'es' ? 'tu maestro' : 'your teacher')
      const subject = lang === 'es'
        ? (isPlacement ? 'Tu llamada de diagnóstico ha sido confirmada — EnglishKolab' : 'Tu clase ha sido confirmada — EnglishKolab')
        : (isPlacement ? 'Your placement call is confirmed — EnglishKolab' : 'Your class is confirmed — EnglishKolab')
      const lead = lang === 'es'
        ? (isPlacement
            ? `Tu llamada de diagnóstico con <strong>${escapeHtml(teacherFirst)}</strong> está confirmada.`
            : `Tu clase con <strong>${escapeHtml(teacherFirst)}</strong> está confirmada.`)
        : (isPlacement
            ? `Your placement call with <strong>${escapeHtml(teacherFirst)}</strong> is confirmed.`
            : `Your class with <strong>${escapeHtml(teacherFirst)}</strong> is confirmed.`)
      const leadText = lang === 'es'
        ? (isPlacement ? `Tu llamada de diagnóstico con ${teacherFirst} está confirmada.` : `Tu clase con ${teacherFirst} está confirmada.`)
        : (isPlacement ? `Your placement call with ${teacherFirst} is confirmed.` : `Your class with ${teacherFirst} is confirmed.`)
      const html = brandedEmail({
        heading: lang === 'es'
          ? (isPlacement ? 'Tu llamada está confirmada' : 'Tu clase está confirmada')
          : (isPlacement ? 'Your placement call is confirmed' : 'Your class is confirmed'),
        bodyHtml: lang === 'es'
          ? `<p style="margin:0 0 12px;">Hola ${escapeHtml(studentFirst)},</p><p style="margin:0 0 12px;">${lead}</p><p style="margin:0;"><strong>Cuándo:</strong> ${formatted} (hora de Honduras).</p>`
          : `<p style="margin:0 0 12px;">Hi ${escapeHtml(studentFirst)},</p><p style="margin:0 0 12px;">${lead}</p><p style="margin:0;"><strong>When:</strong> ${formatted} (Honduras time).</p>`,
        ctaLabel: lang === 'es' ? 'Unirse al aula' : 'Join the classroom',
        ctaUrl: salaUrl,
        footnote: lang === 'es' ? 'El aula se abre 15 minutos antes de la hora de inicio.' : 'The classroom opens 15 minutes before the start time.',
        lang,
      })
      const text = lang === 'es'
        ? `Hola ${studentFirst},\n\n${leadText}\n\nCuándo: ${formatted} (hora de Honduras).\n\nUnirse al aula (se abre 15 minutos antes):\n${salaUrl}\n\n— EnglishKolab`
        : `Hi ${studentFirst},\n\n${leadText}\n\nWhen: ${formatted} (Honduras time).\n\nJoin the classroom (opens 15 minutes early):\n${salaUrl}\n\n— EnglishKolab`
      void fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: EMAIL_FROM, to: student.email, subject, html, text }),
      }).catch(() => {})
    }

    // Teacher email — in the teacher's language.
    if (teacher.email) {
      const lang = teacher.lang
      const formatted = formatSessionTime(data.scheduled_at, lang)
      const salaUrl = `${APP_URL}/${lang}/sala/${bookingId}`
      const teacherFirst = teacherFirstRaw || (lang === 'es' ? 'maestro' : 'teacher')
      const studentLabel = student.name || (lang === 'es' ? 'un estudiante' : 'a student')
      const subject = lang === 'es'
        ? (isPlacement ? 'Nueva llamada de diagnóstico asignada — EnglishKolab' : 'Nueva clase asignada — EnglishKolab')
        : (isPlacement ? 'New placement call assigned — EnglishKolab' : 'New class assigned — EnglishKolab')
      const lead = lang === 'es'
        ? (isPlacement
            ? `Te asignamos una llamada de diagnóstico con <strong>${escapeHtml(studentLabel)}</strong>.`
            : `Te asignamos una clase con <strong>${escapeHtml(studentLabel)}</strong>.`)
        : (isPlacement
            ? `You've been assigned a placement call with <strong>${escapeHtml(studentLabel)}</strong>.`
            : `You've been assigned a class with <strong>${escapeHtml(studentLabel)}</strong>.`)
      const leadText = lang === 'es'
        ? (isPlacement ? `Te asignamos una llamada de diagnóstico con ${studentLabel}.` : `Te asignamos una clase con ${studentLabel}.`)
        : (isPlacement ? `You've been assigned a placement call with ${studentLabel}.` : `You've been assigned a class with ${studentLabel}.`)
      const html = brandedEmail({
        heading: lang === 'es'
          ? (isPlacement ? 'Nueva llamada asignada' : 'Nueva clase asignada')
          : (isPlacement ? 'New placement call assigned' : 'New class assigned'),
        bodyHtml: lang === 'es'
          ? `<p style="margin:0 0 12px;">Hola ${escapeHtml(teacherFirst)},</p><p style="margin:0 0 12px;">${lead}</p><p style="margin:0;"><strong>Cuándo:</strong> ${formatted} (hora de Honduras).</p>`
          : `<p style="margin:0 0 12px;">Hi ${escapeHtml(teacherFirst)},</p><p style="margin:0 0 12px;">${lead}</p><p style="margin:0;"><strong>When:</strong> ${formatted} (Honduras time).</p>`,
        ctaLabel: lang === 'es' ? 'Entrar al aula' : 'Enter the classroom',
        ctaUrl: salaUrl,
        footnote: lang === 'es' ? 'El aula se abre 15 minutos antes de la hora de inicio.' : 'The classroom opens 15 minutes before the start time.',
        lang,
      })
      const text = lang === 'es'
        ? `Hola ${teacherFirst},\n\n${leadText}\n\nCuándo: ${formatted} (hora de Honduras).\n\nEntrar al aula (se abre 15 minutos antes):\n${salaUrl}\n\n— EnglishKolab`
        : `Hi ${teacherFirst},\n\n${leadText}\n\nWhen: ${formatted} (Honduras time).\n\nEnter the classroom (opens 15 minutes early):\n${salaUrl}\n\n— EnglishKolab`
      void fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: EMAIL_FROM, to: teacher.email, subject, html, text }),
      }).catch(() => {})
    }
  }).catch(() => {})
}
