'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scheduleBookingReminders, cancelBookingReminders } from '@/lib/reminders'
import { escapeHtml, brandedEmail, EMAIL_FROM, APP_URL } from '@/lib/email'
import { computeTeacherAvailable } from '@/lib/teacherEarnings'
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

  // 2FA step-up parity with the admin LAYOUT (admin/layout.tsx). Server actions
  // are independently-invokable POSTs — the page gate alone is bypassable by an
  // attacker with a stolen but pre-step-up (aal1) admin session. Require aal2 at
  // the ACTION layer too whenever the admin has a verified TOTP factor
  // (nextLevel==='aal2'). An admin who never enrolled 2FA is never gated (no
  // lockout). Fail-open only if the MFA lookup itself errors (aal is null).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    throw new Error('2FA required')
  }
  return user
}

// Admin booking mutations RETURN a structured result instead of throwing: a
// production build redacts THROWN server-action messages (the client only sees a
// generic "An error occurred in the Server Components render" + digest), which hid
// our friendly guard messages AND broke the force-retry flow. Returning the
// message keeps it intact; `forceable` marks the guards an admin may override.
export type BookingActionResult =
  | { ok: true; bookingId?: string }
  | { ok: false; error: string; forceable?: boolean }
const FORCEABLE_RE = /not available|primary teacher/i
function toBookingError(e: unknown): { ok: false; error: string; forceable?: boolean } {
  // Re-throw Next's control-flow signals (redirect / notFound) — never swallow them.
  const digest = (e as { digest?: unknown } | null)?.digest
  if (typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')) throw e
  const error = e instanceof Error ? e.message : 'Algo salió mal. Inténtalo de nuevo.'
  return { ok: false, error, forceable: FORCEABLE_RE.test(error) }
}

// Cancel a teacher's live (pending/confirmed) bookings and refund the student's
// CLASS credit BEFORE the teacher row is hard-deleted — otherwise the bookings FK
// cascade silently removes students' upcoming classes WITHOUT returning their
// credits. Status-gated + type-guarded (mirrors studentCancelBooking). Shared by
// deleteTeacher + rejectTeacher + rejectTeacherWithEmail so the reject paths can't
// drop credits the delete path correctly returns.
async function cancelAndRefundTeacherLiveBookings(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string,
) {
  const { data: liveBookings } = await admin
    .from('bookings').select('id, student_id, type')
    .eq('teacher_id', teacherId).in('status', ['pending', 'confirmed'])
  for (const b of (liveBookings || []) as { id: string; student_id: string; type: string }[]) {
    const { data: flipped } = await admin
      .from('bookings').update({ status: 'cancelled' })
      .eq('id', b.id).in('status', ['pending', 'confirmed']).select('id')
    if (flipped && flipped.length && b.type === 'class') {
      await admin.rpc('increment_classes', { p_student_id: b.student_id })
    }
    cancelBookingReminders(b.id).catch(() => {})
  }
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

  // Capture the CV path BEFORE the row is gone — otherwise the PII résumé is
  // orphaned in the private 'teacher-docs' bucket forever once the teacher row
  // (and with it cv_storage_path) is deleted.
  const { data: teacherRow } = await admin
    .from('teachers')
    .select('cv_storage_path')
    .eq('id', teacherId)
    .single()
  const cvPath = teacherRow?.cv_storage_path ?? null

  // Refund + cancel any live class bookings BEFORE the delete so the FK cascade
  // can't drop students' upcoming classes without returning their credit (parity
  // with deleteTeacher). A genuine pending applicant has none; this closes the gap.
  await cancelAndRefundTeacherLiveBookings(admin, teacherId)

  // Delete teacher record first (FK cascade removes availability_slots)
  const { error: delError } = await admin
    .from('teachers')
    .delete()
    .eq('id', teacherId)

  if (delError) throw new Error(delError.message)

  // Best-effort purge of the applicant's CV from storage (log-but-don't-fail,
  // mirroring deleteBook in library.ts). A failed object delete only orphans a
  // file; it must not block the rejection.
  if (cvPath) {
    const { error: rmErr } = await admin.storage.from('teacher-docs').remove([cvPath])
    if (rmErr) console.error('rejectTeacher: failed to remove CV from storage', cvPath, rmErr.message)
  }

  // Downgrade profile back to student so they can re-register
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: 'student' })
    .eq('id', profileId)

  if (profileError) throw new Error(profileError.message)
  revalidatePath('/', 'layout')
}

export type ToggleTeacherResult =
  | { ok: true; requeued?: number }
  | { ok: false; needsConfirm: true; liveBookings: number; pendingUsd: number }
  | { ok: false; error: string }

// Activate or deactivate a teacher. Reactivating is always safe. Deactivating is
// the sensitive path: a paused teacher can no longer confirm/decline (booking.ts
// is_active gate) and is excluded from new assignments + the payout sweep, so two
// things must NOT silently fall through the cracks (QA §7.2 SB-01/SB-02):
//  1. Their live student bookings would otherwise be stranded — confirmed in My
//     Classes but unteachable + invisible to the admin unassigned queue (teacher_id
//     still set). We RE-QUEUE them (teacher_id=null, status=pending) so a backup
//     teacher can cover the class (plan B); if none is found the class can still be
//     cancelled/refunded later. (Deactivation is reversible, so we re-queue rather
//     than cancel+refund the way reject/deleteTeacher do for a permanent removal.)
//  2. Any unpaid earnings remain owed (paid manually in Veem). The admin gets a
//     one-time confirm warning before deactivating a teacher who still has live
//     bookings or unpaid money, so it's never a silent surprise.
export async function toggleTeacherActive(
  teacherId: string,
  isActive: boolean,
  opts: { force?: boolean } = {},
): Promise<ToggleTeacherResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    if (isActive) {
      const { error } = await admin.from('teachers').update({ is_active: true }).eq('id', teacherId)
      if (error) throw new Error(error.message)
      revalidatePath('/', 'layout')
      return { ok: true }
    }

    // Deactivating — gather the impact for the confirm warning.
    const { data: liveRows } = await admin
      .from('bookings')
      .select('id, type')
      .eq('teacher_id', teacherId)
      .in('status', ['pending', 'confirmed'])
    const liveBookings = (liveRows || []).length
    const { availableUsd, pendingHoldUsd } = await computeTeacherAvailable(admin, teacherId)
    const pendingUsd = Math.round((availableUsd + pendingHoldUsd) * 100) / 100

    if (!(opts.force ?? false) && (liveBookings > 0 || pendingUsd > 0)) {
      return { ok: false, needsConfirm: true, liveBookings, pendingUsd }
    }

    const { error } = await admin.from('teachers').update({ is_active: false }).eq('id', teacherId)
    if (error) throw new Error(error.message)

    // Re-queue the teacher's live bookings so a student is never left with a class
    // this teacher can no longer teach. Unassigning returns CLASS bookings to the
    // admin "unassigned" queue (pending AND teacher_id IS null) for a backup.
    for (const bRow of (liveRows || []) as { id: string }[]) {
      await admin
        .from('bookings')
        .update({ teacher_id: null, status: 'pending' })
        .eq('id', bRow.id)
        .in('status', ['pending', 'confirmed'])
      cancelBookingReminders(bRow.id).catch(() => {})
    }

    revalidatePath('/', 'layout')
    return { ok: true, requeued: liveBookings }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not update the teacher.' }
  }
}

// ── Booking actions ───────────────────────────────────────────────────────────

export async function assignAndConfirmBooking(
  bookingId: string,
  teacherId: string,
  options: { force?: boolean } = {},
): Promise<BookingActionResult> {
  try {
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

  // Fire-and-forget: send ONE branded confirmation (with the .ics calendar invite,
  // in each recipient's own timezone + language, honoring their email prefs) AND
  // schedule the T-24h/T-1h reminders -- all via scheduleBookingReminders, the single
  // source of truth. (Previously this ALSO called sendAssignmentEmail here, which sent
  // a SECOND near-duplicate confirmation in Honduras time with no .ics -- students and
  // teachers received two confirmation emails per assignment. Consolidated to one.)
  // Idempotent: cancels any existing scheduled emails for this booking first, so
  // re-running "assign" (e.g. force-switching teachers) won't leave dangling sends.
  scheduleBookingReminders(bookingId).catch(() => {})

  revalidatePath('/', 'layout')
  return { ok: true }
  } catch (e) {
    return toBookingError(e)
  }
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
    .select('teacher_id, student_id, duration_minutes, type, status, scheduled_at')
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

  // Also re-check the STUDENT's other live bookings for an interval overlap — the
  // teacher checks above don't cover a clash with the student's other classes
  // (reschedule-1). excludeBookingId keeps the booking being moved from self-conflicting.
  if (
    booking.student_id &&
    (await studentHasTimeConflict(
      admin,
      booking.student_id,
      request.proposed_scheduled_at,
      booking.duration_minutes ?? 60,
      request.booking_id,
    ))
  ) {
    throw new Error('The student already has another class at the proposed time. Pick a different time.')
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
): Promise<BookingActionResult> {
  try {
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
  if (new Date(booking.scheduled_at).getTime() === when.getTime()) return { ok: true }

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
  if (booking.status === 'confirmed' && booking.teacher_id && (booking.type === 'class' || booking.type === 'placement_test')) {
    scheduleBookingReminders(bookingId).catch(() => {})
  } else {
    cancelBookingReminders(bookingId).catch(() => {})
  }

  revalidatePath('/', 'layout')
  return { ok: true }
  } catch (e) {
    return toBookingError(e)
  }
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

  // Bound the rate — it IS the per-class payout. A negative would mint negative
  // payouts; a huge/NaN value would inflate them. (USD/hour, 2-decimals, 0..1000.)
  const n = Math.round(Number(rate) * 100) / 100
  if (!Number.isFinite(n) || n < 0 || n > 1000) {
    throw new Error('Rate must be between 0 and 1000')
  }

  const { error } = await admin
    .from('teachers')
    .update({ hourly_rate: n })
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
  // Truthy (not just !== undefined): the student detail form can submit an empty
  // string when the field wasn't loaded, which would otherwise WIPE the student's
  // saved language (breaking their email/UI locale). Empty = leave unchanged.
  if (fields.preferred_language) profileFields.preferred_language = fields.preferred_language
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
    .select('student_id, teacher_id, duration_minutes, type, status')
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
  } else if (booking.type === 'class' && booking.teacher_id) {
    // Mirror completeSession: pay the teacher + bump their session count when a
    // class is completed by the admin — the manual fallback for when the in-room
    // completeSession never fired (e.g. the teacher's browser dropped). The status
    // flip above is gated so this runs at most once; the payment insert is
    // idempotent via the unique payments.booking_id constraint, and whichever path
    // (in-room vs admin) wins the status flip is the only one that bumps the count.
    //
    // Attendance gate (parity with completeSession, migration 045): pay + count
    // ONLY if the student actually opened the room (sessions.student_joined_at).
    // student_joined_at is stamped on the STUDENT's getRoomAccess — independent of
    // the teacher's browser — so the legit "teacher's browser dropped" case still
    // pays (the student was present). A genuine no-show completes the booking but
    // mints NO payout/session-count, matching the in-room path (closes the second
    // no-show inflation vector). If a class truly happened entirely off-platform,
    // record the payment manually.
    const { data: sess } = await admin
      .from('sessions')
      .select('student_joined_at')
      .eq('booking_id', bookingId)
      .maybeSingle()
    const studentJoined = !!sess?.student_joined_at
    const { data: teacher } = await admin
      .from('teachers')
      .select('id, hourly_rate, total_sessions')
      .eq('id', booking.teacher_id)
      .single()
    if (teacher && !studentJoined) {
      console.info('[completeBooking] no student attendance — payout + session-count withheld', { bookingId, teacherId: teacher.id })
    }
    if (teacher && studentJoined) {
      // Atomic increment (migration 046) — parity with completeSession; avoids a
      // lost update when an admin completion races the in-room one.
      await admin.rpc('increment_teacher_sessions', { p_teacher_id: teacher.id })
      const { data: existingPayment } = await admin.from('payments').select('id').eq('booking_id', bookingId).maybeSingle()
      if (!existingPayment) {
        const rate = Math.round((teacher.hourly_rate || 0) * ((booking.duration_minutes || 60) / 60))
        const { error: payErr } = await admin.from('payments').insert({
          booking_id: bookingId, student_id: booking.student_id, teacher_id: teacher.id,
          amount_usd: rate, teacher_payout_usd: rate, platform_fee_usd: 0, status: 'completed',
        })
        if (payErr && payErr.code !== '23505') console.error('[completeBooking] payment insert error:', payErr.message)
      }
    }
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
  if (cancelledRows && cancelledRows.length > 0) {
    if (booking?.type === 'class') {
      // Atomic SQL increment — a read-then-update loses concurrent refunds
      // under load. increment_classes is SECURITY DEFINER (migration 012).
      await admin.rpc('increment_classes', { p_student_id: booking.student_id })
    } else if (booking?.type === 'placement_test') {
      // Clear the placement flag — otherwise the student is stranded on a blank
      // "scheduled" placement screen with a now-cancelled booking and can't re-book.
      await admin.from('students').update({ placement_scheduled: false }).eq('id', booking.student_id)
    }
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
    }).catch((err) => {
      // Fire-and-forget per the platform convention: a Resend hiccup must never
      // fail the admin action (the recovery link was already generated above).
      console.error('[resetStudentPassword] reset email send failed (non-blocking):', err)
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
  // Last-admin floor: never demote the LAST remaining admin (would lock the whole
  // team out of the admin CRM). Only relevant when the target is currently an admin
  // and the new role isn't admin.
  if (role !== 'admin') {
    const { data: target } = await admin.from('profiles').select('role').eq('id', profileId).single()
    if (target?.role === 'admin') {
      const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
      if ((count ?? 0) <= 1) throw new Error('Cannot demote the last admin')
    }
  }
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

  // Refund + cancel the teacher's live (pending/confirmed) CLASS bookings FIRST —
  // otherwise the bookings ON DELETE CASCADE silently removes students' upcoming
  // classes without returning their credits. (Placements cost no credit.)
  await cancelAndRefundTeacherLiveBookings(admin, teacherId)

  // If the teacher has any payment history, a hard delete violates the
  // (no-cascade) payments_teacher_id_fkey and throws a raw Postgres error. Preserve
  // the financial record — soft-delete (deactivate + downgrade role) instead.
  const { count: payCount } = await admin
    .from('payments').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId)
  if ((payCount ?? 0) > 0) {
    await admin.from('teachers').update({ is_active: false }).eq('id', teacherId)
    await admin.from('profiles').update({ role: 'student' }).eq('id', profileId)
    revalidatePath('/', 'layout')
    return
  }

  // No payment history → safe to hard delete (live bookings already cancelled +
  // refunded; any remaining cancelled rows cascade harmlessly). Fall back to a
  // soft-delete if an unexpected FK still blocks it, rather than leaking a raw error.
  const { error } = await admin.from('teachers').delete().eq('id', teacherId)
  if (error) {
    await admin.from('teachers').update({ is_active: false }).eq('id', teacherId)
  }
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
): Promise<BookingActionResult> {
  try {
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

  // Guard the STUDENT's calendar too — no interval overlap with another live
  // class/placement of the same student (createbooking-overlap-1). Only the
  // student-facing types occupy the student's slot; internal meetings don't.
  if (
    (type === 'class' || type === 'placement_test') &&
    (await studentHasTimeConflict(admin, studentId, scheduledAt, durationMinutes ?? 60))
  ) {
    throw new Error('The student already has a class at this time. Pick a different time.')
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

  // Send the confirmation (+.ics) and schedule the T-24h/T-1h reminders for the
  // student-facing booking types -- same single path as the self-serve assign flow.
  // Internal coordination meetings (teacher_interview / admin_checkin) get no email
  // (matching the prior behavior, where the notifier short-circuited those types).
  // (Previously this called sendBookingEmails: a bare "session scheduled" note in
  // Honduras time with NO calendar invite and NO reminders ever scheduled.)
  if (type === 'class' || type === 'placement_test') {
    scheduleBookingReminders(booking.id).catch(() => {})
  }

  revalidatePath('/', 'layout')
  return { ok: true, bookingId: booking.id }
  } catch (e) {
    return toBookingError(e)
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

  // Capture the CV path BEFORE deleting the row so the PII résumé can be purged
  // from the private teacher-docs bucket (best-effort — never block the rejection).
  const { data: teacherRow } = await admin.from('teachers').select('cv_storage_path').eq('id', teacherId).single()
  const cvPath = (teacherRow as { cv_storage_path?: string | null } | null)?.cv_storage_path ?? null

  // Refund + cancel live class bookings before the FK cascade (parity w/ deleteTeacher).
  await cancelAndRefundTeacherLiveBookings(admin, teacherId)

  const { error: delError } = await admin.from('teachers').delete().eq('id', teacherId)
  if (delError) throw new Error(delError.message)

  if (cvPath) {
    try { await admin.storage.from('teacher-docs').remove([cvPath]) } catch { /* non-fatal — orphaned file only */ }
  }

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

// ── Teacher payouts (TE-04 phase 2c) ─────────────────────────────────────────
// Weekly sweep: for every teacher with a Veem email set, snapshot their
// available (cleared − already-committed) balance into a 'pending' payout the
// admin then pays out wallet-to-wallet in Veem and marks paid. Min $1 so we
// don't create dust rows. Idempotent-ish: re-running the same week just finds
// $0 available (the prior pending payout already counts as committed) and skips.
export async function runWeeklyPayoutSweep() {
  await assertAdmin()
  const admin = createAdminClient()
  // Only ACTIVE teachers with a Veem email — matches the admin "ready" preview.
  const { data: teachers } = await admin
    .from('teachers')
    .select('id, payout_veem_email')
    .not('payout_veem_email', 'is', null)
    .eq('is_active', true)

  let created = 0
  let totalUsd = 0
  let skipped = 0
  const errors: string[] = []
  const now = new Date().toISOString()
  for (const t of teachers || []) {
    const { availableUsd, veemEmail, hasPendingPayout } = await computeTeacherAvailable(admin, t.id)
    // Skip if the email was cleared mid-sweep, an unpaid payout is already queued
    // (resolve it first — one pending per teacher), or there's nothing to pay.
    if (!veemEmail || hasPendingPayout) { skipped++; continue }
    if (availableUsd < 1) continue
    const { error } = await admin.from('teacher_payouts').insert({
      teacher_id: t.id,
      amount_usd: availableUsd,
      veem_email: veemEmail,
      status: 'pending',
      period_end: now,
    })
    if (error) {
      // 23505 = the one-pending-per-teacher unique index — a concurrent sweep beat
      // us to it. Benign: skip. Any other error is surfaced to the admin.
      if (error.code === '23505') { skipped++; continue }
      errors.push(error.message)
      continue
    }
    created++
    totalUsd += availableUsd
  }
  revalidatePath('/', 'layout')
  return { created, totalUsd: Math.round(totalUsd * 100) / 100, skipped, errors }
}

// Admin confirms they sent the money via Veem. Only a 'pending' payout flips; the
// .select() row-count guard surfaces a no-op (already paid / stale click) instead
// of silently succeeding.
export async function markTeacherPayoutPaid(payoutId: string, note?: string) {
  const acting = await assertAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('teacher_payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: acting.id, note: note?.trim() || null })
    .eq('id', payoutId)
    .eq('status', 'pending')
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Payout not found or already processed.')
  revalidatePath('/', 'layout')
  return { success: true as const }
}

// Cancel a pending payout — its amount returns to the teacher's available balance.
export async function cancelTeacherPayout(payoutId: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('teacher_payouts')
    .update({ status: 'cancelled' })
    .eq('id', payoutId)
    .eq('status', 'pending')
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Payout not found or already processed.')
  revalidatePath('/', 'layout')
  return { success: true as const }
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

  // Fan out the confirmation + reminder scheduling per booking (fire-and-forget),
  // same path as single-assign: ONE branded confirmation (+.ics, recipient tz/lang/
  // prefs) plus the T-24h/T-1h reminders. (Previously bulk called sendAssignmentEmail,
  // which sent a confirmation but NEVER scheduled reminders or attached the .ics -- so
  // bulk-assigned students silently missed every reminder. Now consistent with single.)
  for (const id of bookingIds) scheduleBookingReminders(id).catch(() => {})

  revalidatePath('/', 'layout')
}

