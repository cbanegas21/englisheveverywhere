'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scheduleBookingReminders, cancelBookingReminders } from '@/lib/reminders'

async function sendAdminBookingEmail(params: {
  bookingId: string
  studentName: string
  studentEmail: string
  scheduledAt: string
  lang: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@englishkolab.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!apiKey || apiKey === 're_placeholder') return

  const scheduled = new Date(params.scheduledAt).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'noreply@englishkolab.com',
      to: adminEmail,
      subject: `Class needs a teacher — ${params.studentName}`,
      html: `
        <p>A student booked a class. Assign a teacher in the admin queue.</p>
        <table>
          <tr><td><strong>Student</strong></td><td>${params.studentName} (${params.studentEmail})</td></tr>
          <tr><td><strong>Scheduled</strong></td><td>${scheduled}</td></tr>
        </table>
        <p>
          <a href="${appUrl}/${params.lang}/admin/bookings">
            Assign teacher →
          </a>
        </p>
      `,
    }),
  }).catch(() => {})
}

export async function createBooking(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const scheduledAt = formData.get('scheduled_at') as string
  const durationMinutes = parseInt(formData.get('duration_minutes') as string) || 60
  const lang = (formData.get('lang') as string) || 'es'

  // ── 24-hour advance notice enforcement ───────────────────────
  const scheduledDate = new Date(scheduledAt)
  const minAllowed = new Date(Date.now() + 24 * 60 * 60 * 1000)
  if (scheduledDate < minAllowed) {
    return {
      error: lang === 'es'
        ? 'Las reservas requieren al menos 24 horas de anticipación.'
        : 'Bookings require at least 24 hours advance notice.',
    }
  }

  // Auth validated. Admin client for all DB access (RLS-edge fix).
  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id, classes_remaining')
    .eq('profile_id', user.id)
    .single()

  if (!student) return { error: 'Student profile not found' }
  if (student.classes_remaining <= 0) {
    return {
      error: lang === 'es'
        ? 'No tienes clases disponibles. Adquiere un plan.'
        : 'No classes remaining. Get a plan.',
    }
  }

  // ── Conflict check ───────────────────────────────────────────
  const { data: conflicting } = await admin
    .from('bookings')
    .select('id')
    .eq('student_id', student.id)
    .eq('scheduled_at', scheduledAt)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (conflicting) {
    return {
      error: lang === 'es'
        ? 'Ya tienes una clase agendada para ese horario.'
        : 'You already have a class booked for that time slot.',
    }
  }

  // ── Create booking — teacher assigned later by admin ─────────
  const { data: booking, error } = await admin
    .from('bookings')
    .insert({
      student_id: student.id,
      teacher_id: null,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      status: 'pending',
      type: 'class',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await admin.rpc('decrement_classes', { p_student_id: student.id })

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  sendAdminBookingEmail({
    bookingId: booking.id,
    studentName: profile?.full_name || user.email || 'Student',
    studentEmail: user.email || '',
    scheduledAt,
    lang,
  })

  revalidatePath('/', 'layout')
  return { success: true, bookingId: booking.id }
}

export async function confirmBooking(bookingId: string, lang: string = 'es') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) return { error: 'Teacher profile not found' }

  const { error } = await admin
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)
    .eq('teacher_id', teacher.id)

  if (error) return { error: error.message }

  // Schedule Resend reminder emails for T-24h and T-1h. Fire-and-forget —
  // we never want a Resend hiccup to fail the teacher's confirm action.
  scheduleBookingReminders(bookingId).catch(() => {})

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function declineBooking(bookingId: string, lang: string = 'es') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) return { error: 'Teacher profile not found' }

  // Fetch student_id before cancelling so we can restore their class
  const { data: booking } = await admin
    .from('bookings')
    .select('student_id')
    .eq('id', bookingId)
    .eq('teacher_id', teacher.id)
    .single()

  if (!booking) return { error: 'Booking not found' }

  const { error } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('teacher_id', teacher.id)

  if (error) return { error: error.message }

  // Restore the student's class
  await admin.rpc('increment_classes', { p_student_id: booking.student_id })

  // Cancel any already-scheduled reminder emails (no-op if booking was still
  // pending when declined and no reminders had been scheduled yet).
  cancelBookingReminders(bookingId).catch(() => {})

  revalidatePath('/', 'layout')
  return { success: true }
}

// ── Reschedule requests (teacher → admin) ───────────────────────────────────
//
// Teachers cannot move a confirmed class unilaterally — that would shift a
// student's locked-in slot without warning. They file a request here; the
// admin reviews it in /admin/bookings and approves or rejects. See
// `src/app/[lang]/admin/actions.ts` for the admin side (approve/reject).

export async function requestReschedule(
  bookingId: string,
  proposedScheduledAtIso: string,
  reason: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // Confirm the requester actually owns the booking as a teacher and capture
  // the original scheduled_at for the audit trail.
  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!teacher) return { error: 'Teacher profile not found' }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, scheduled_at, teacher_id, status')
    .eq('id', bookingId)
    .single()
  if (!booking) return { error: 'Booking not found' }
  if (booking.teacher_id !== teacher.id) return { error: 'Not your booking' }
  if (booking.status !== 'confirmed' && booking.status !== 'pending') {
    return { error: 'Cannot reschedule a completed or cancelled booking' }
  }

  const proposed = new Date(proposedScheduledAtIso)
  if (isNaN(proposed.getTime())) return { error: 'Invalid proposed time' }
  // Don't let teachers propose a past time.
  if (proposed.getTime() < Date.now()) return { error: 'Proposed time is in the past' }

  const { error: insertErr } = await admin.from('reschedule_requests').insert({
    booking_id: bookingId,
    requested_by: user.id,
    requested_by_role: 'teacher',
    original_scheduled_at: booking.scheduled_at,
    proposed_scheduled_at: proposed.toISOString(),
    reason: reason.trim() || null,
    status: 'pending',
  })
  if (insertErr) {
    // Unique index violation → there's already a pending request.
    if (insertErr.message.toLowerCase().includes('duplicate')) {
      return { error: 'A reschedule request is already pending for this booking' }
    }
    return { error: insertErr.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function cancelRescheduleRequest(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: request } = await admin
    .from('reschedule_requests')
    .select('id, status, requested_by')
    .eq('id', requestId)
    .single()
  if (!request) return { error: 'Request not found' }
  if (request.requested_by !== user.id) return { error: 'Not your request' }
  if (request.status !== 'pending') return { error: 'Only pending requests can be cancelled' }

  const { error } = await admin
    .from('reschedule_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

// ── Student-initiated cancel / reschedule / no-show report ─────────────────
//
// Pricing copy promises "Cancel anytime" but also "Classes cancelled with
// less than 24-hour notice are forfeited." These three actions implement that
// rule + give students a way to recover credit when the teacher no-shows.
//
// Audit fields (`cancelled_by`, `cancellation_reason`, `cancelled_at`) come
// from migration 025 — they make refund eligibility deterministic instead of
// inferred from timing after the fact.

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

async function notifyAdminOfCancel(params: {
  bookingId: string
  studentName: string
  reason: string
  scheduledAt: string
  refundIssued: boolean
}) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@englishkolab.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  if (!apiKey || apiKey === 're_placeholder') return

  const scheduled = new Date(params.scheduledAt).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'noreply@englishkolab.com',
      to: adminEmail,
      subject: `Booking cancelled — ${params.studentName} (${params.reason})`,
      html: `
        <p>${params.studentName} cancelled a class.</p>
        <table>
          <tr><td><strong>Reason</strong></td><td>${params.reason}</td></tr>
          <tr><td><strong>Originally scheduled</strong></td><td>${scheduled}</td></tr>
          <tr><td><strong>Class credit refunded</strong></td><td>${params.refundIssued ? 'Yes' : 'No'}</td></tr>
        </table>
        <p><a href="${appUrl}/es/admin/bookings">Review →</a></p>
      `,
    }),
  }).catch(() => {})
}

export async function studentCancelBooking(bookingId: string, lang: string = 'es') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!student) return { error: 'Student profile not found' }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, scheduled_at, status, type, student_id, teacher_id')
    .eq('id', bookingId)
    .single()
  if (!booking) return { error: 'Booking not found' }
  if (booking.student_id !== student.id) return { error: 'Not your booking' }
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    return { error: lang === 'es' ? 'Esta clase ya no se puede cancelar.' : 'This class can no longer be cancelled.' }
  }

  const startMs = new Date(booking.scheduled_at).getTime()
  const isLate = startMs - Date.now() < DAY_MS
  const reason = isLate ? 'late' : 'early'

  const { error: updErr } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: 'student',
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
  if (updErr) return { error: updErr.message }

  // Refund credit only if cancelled with ≥24h notice — matches the pricing
  // copy ("classes cancelled with less than 24-hour notice are forfeited").
  if (!isLate) {
    await admin.rpc('increment_classes', { p_student_id: student.id })
  }

  cancelBookingReminders(bookingId).catch(() => {})

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  notifyAdminOfCancel({
    bookingId,
    studentName: profile?.full_name || user.email || 'Student',
    reason,
    scheduledAt: booking.scheduled_at,
    refundIssued: !isLate,
  }).catch(() => {})

  revalidatePath('/', 'layout')
  return {
    success: true,
    refunded: !isLate,
    message: isLate
      ? (lang === 'es'
          ? 'Clase cancelada. Por estar dentro de las 24h, no se restituye el crédito.'
          : 'Class cancelled. Cancelled within 24h — credit not restored.')
      : (lang === 'es'
          ? 'Clase cancelada y crédito restituido a tu cuenta.'
          : 'Class cancelled and credit restored to your account.'),
  }
}

export async function studentRescheduleBooking(
  bookingId: string,
  newScheduledAtIso: string,
  lang: string = 'es',
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!student) return { error: 'Student profile not found' }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, scheduled_at, status, type, student_id, teacher_id')
    .eq('id', bookingId)
    .single()
  if (!booking) return { error: 'Booking not found' }
  if (booking.student_id !== student.id) return { error: 'Not your booking' }
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    return { error: lang === 'es' ? 'Esta clase ya no se puede reagendar.' : 'This class can no longer be rescheduled.' }
  }

  const oldStartMs = new Date(booking.scheduled_at).getTime()
  if (oldStartMs - Date.now() < DAY_MS) {
    return {
      error: lang === 'es'
        ? 'Solo puedes reagendar con al menos 24h de anticipación. Para cambios de último momento, cancela y agenda una nueva.'
        : 'You can only reschedule with 24+ hours notice. For last-minute changes, cancel and book a new class.',
    }
  }

  const newDate = new Date(newScheduledAtIso)
  if (isNaN(newDate.getTime())) return { error: 'Invalid new time' }
  if (newDate.getTime() - Date.now() < DAY_MS) {
    return {
      error: lang === 'es'
        ? 'El nuevo horario debe ser al menos 24h en el futuro.'
        : 'The new time must be at least 24h in the future.',
    }
  }

  // Conflict check against this student's other live bookings.
  const { data: conflicting } = await admin
    .from('bookings')
    .select('id')
    .eq('student_id', student.id)
    .eq('scheduled_at', newDate.toISOString())
    .neq('id', bookingId)
    .neq('status', 'cancelled')
    .maybeSingle()
  if (conflicting) {
    return {
      error: lang === 'es'
        ? 'Ya tienes una clase agendada para ese horario.'
        : 'You already have a class booked for that time slot.',
    }
  }

  // Move the booking. Status drops back to 'pending' so the teacher (if one
  // was already assigned) re-confirms — the original confirmation was for the
  // old time and shouldn't carry over silently.
  const { error: updErr } = await admin
    .from('bookings')
    .update({
      scheduled_at: newDate.toISOString(),
      status: 'pending',
    })
    .eq('id', bookingId)
  if (updErr) return { error: updErr.message }

  // Wipe stale reminders. New ones get scheduled when the teacher re-confirms.
  cancelBookingReminders(bookingId).catch(() => {})

  revalidatePath('/', 'layout')
  return {
    success: true,
    message: lang === 'es'
      ? 'Clase reagendada. Tu maestro confirmará el nuevo horario pronto.'
      : 'Class rescheduled. Your teacher will reconfirm the new time shortly.',
  }
}

export async function reportTeacherNoShow(bookingId: string, lang: string = 'es') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!student) return { error: 'Student profile not found' }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, scheduled_at, duration_minutes, status, student_id, teacher_id')
    .eq('id', bookingId)
    .single()
  if (!booking) return { error: 'Booking not found' }
  if (booking.student_id !== student.id) return { error: 'Not your booking' }
  if (booking.status === 'completed' || booking.status === 'cancelled') {
    return { error: lang === 'es' ? 'Esta clase ya está cerrada.' : 'This class is already closed.' }
  }

  // Only allow reporting after the class window has fully passed — gives the
  // teacher the full duration to show up + a 5-minute grace buffer.
  const startMs = new Date(booking.scheduled_at).getTime()
  const endMs = startMs + (booking.duration_minutes || 60) * 60_000
  if (Date.now() < endMs + 5 * 60_000) {
    return {
      error: lang === 'es'
        ? 'Espera a que termine el horario de la clase antes de reportar.'
        : 'Wait until the class window has ended before reporting.',
    }
  }

  // Cross-check the session row — if the teacher's track was published,
  // started_at would be set and a no-show claim is invalid.
  const { data: session } = await admin
    .from('sessions')
    .select('started_at')
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (session?.started_at) {
    return {
      error: lang === 'es'
        ? 'Esta clase parece haberse iniciado. Si hay un problema, contáctanos.'
        : 'This class appears to have started. If there is an issue, please contact support.',
    }
  }

  const { error: updErr } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: 'student',
      cancellation_reason: 'no_show_teacher',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
  if (updErr) return { error: updErr.message }

  await admin.rpc('increment_classes', { p_student_id: student.id })

  cancelBookingReminders(bookingId).catch(() => {})

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  notifyAdminOfCancel({
    bookingId,
    studentName: profile?.full_name || user.email || 'Student',
    reason: 'no_show_teacher',
    scheduledAt: booking.scheduled_at,
    refundIssued: true,
  }).catch(() => {})

  revalidatePath('/', 'layout')
  return {
    success: true,
    message: lang === 'es'
      ? 'Reporte recibido. El crédito fue restituido y notificamos al equipo.'
      : 'Report received. Credit restored and the team has been notified.',
  }
}

export async function saveAvailabilitySlots(
  slots: { day_of_week: number; start_time: string; end_time: string }[],
  lang: string = 'es'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) return { error: 'Teacher profile not found' }

  // Delete existing recurring slots
  await admin
    .from('availability_slots')
    .delete()
    .eq('teacher_id', teacher.id)

  if (slots.length === 0) {
    revalidatePath('/', 'layout')
    return { success: true }
  }

  const toInsert = slots.map((s) => ({
    teacher_id: teacher.id,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
  }))

  const { error } = await admin.from('availability_slots').insert(toInsert)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
