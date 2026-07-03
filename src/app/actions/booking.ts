'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scheduleBookingReminders, cancelBookingReminders } from '@/lib/reminders'
import { escapeHtml, brandedEmail, EMAIL_FROM, APP_URL } from '@/lib/email'
import { studentHasTimeConflict } from '@/lib/bookingConflict'
import { checkUserActionLimit } from '@/lib/rateLimit'

// Map the raw cancellation_reason enum to a human-readable label for admin
// notification emails. Keep both languages so the email reads naturally.
const CANCEL_REASON_LABELS: Record<string, { en: string; es: string }> = {
  late: { en: 'Late cancellation (within 24h)', es: 'Cancelación tardía (dentro de 24h)' },
  early: { en: 'Early cancellation (24h+ notice)', es: 'Cancelación anticipada (24h+ de aviso)' },
  no_show_teacher: { en: 'Teacher no-show', es: 'Ausencia del maestro' },
  teacher_decline: { en: 'Teacher declined the assignment', es: 'El maestro rechazó la asignación' },
}

function cancelReasonLabel(reason: string, lang: string): string {
  const entry = CANCEL_REASON_LABELS[reason]
  if (!entry) return reason
  return lang === 'es' ? entry.es : entry.en
}

// Map a Postgres/Supabase error from a booking mutation to a SAFE, localized
// message. A 23505 unique-violation means the slot is already taken; anything
// else is logged server-side and returned as a generic retry message so no raw
// DB string (constraint names, internal detail) ever reaches the UI (money-1).
function bookingActionErrorMsg(
  error: { code?: string; message: string },
  lang: string,
  ctx: string,
): string {
  if (error.code === '23505' || /duplicate key/i.test(error.message)) {
    return lang === 'es'
      ? 'Ya tienes una clase agendada para ese horario.'
      : 'You already have a class booked for that time slot.'
  }
  console.error(`${ctx} failed:`, error.message)
  return lang === 'es'
    ? 'No se pudo completar la acción. Inténtalo de nuevo.'
    : 'Could not complete the action. Please try again.'
}

async function sendAdminBookingEmail(params: {
  bookingId: string
  studentName: string
  studentEmail: string
  scheduledAt: string
  lang: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@englishkolab.com'

  if (!apiKey || apiKey === 're_placeholder') return

  const scheduled = new Date(params.scheduledAt).toLocaleString('es-HN', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    timeZone: 'America/Tegucigalpa',
  })

  const assignUrl = `${APP_URL}/es/admin/bookings`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: adminEmail,
      subject: `Una clase necesita maestro — ${params.studentName}`,
      html: brandedEmail({
        heading: 'Una clase necesita maestro',
        bodyHtml: `
          <p style="margin:0 0 16px;">Un estudiante reservó una clase. Asígnale un maestro en el panel.</p>
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Estudiante</td><td style="padding:4px 0;color:#111111;font-weight:600;">${escapeHtml(params.studentName)}</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Correo</td><td style="padding:4px 0;color:#111111;font-weight:600;">${escapeHtml(params.studentEmail)}</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Horario</td><td style="padding:4px 0;color:#111111;font-weight:600;">${scheduled}</td></tr>
          </table>`,
        ctaLabel: 'Asignar maestro',
        ctaUrl: assignUrl,
        lang: 'es',
      }),
      text: [
        'Un estudiante reservó una clase. Asígnale un maestro en el panel.',
        '',
        `Estudiante: ${params.studentName} (${params.studentEmail})`,
        `Horario: ${scheduled} (hora de Honduras)`,
        '',
        `Asignar maestro: ${assignUrl}`,
      ].join('\n'),
    }),
  }).catch(() => {})
}

export async function createBooking(formData: FormData) {
  const supabase = await createClient()
  // Parse lang up front so even the first guard returns localized copy — the
  // earlier code parsed it later, so a stale-session student saw a raw English
  // "Not authenticated" on a money action even in Spanish (AG-GUARD-06).
  const lang = (formData.get('lang') as string) || 'es'
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: lang === 'es' ? 'Tu sesión expiró. Inicia sesión de nuevo.' : 'Your session expired. Please log in again.' }
  }

  const scheduledAt = formData.get('scheduled_at') as string
  // duration_minutes is client-controlled. The product offers a single
  // 60-minute class = 1 credit; honoring a tampered value (e.g. 90 or 999) would
  // hand the student a longer class — and the teacher a larger payout — for the
  // same one credit. Pin to the allowed set, coercing anything else to 60 (BOOKING-06).
  const ALLOWED_DURATIONS = [60]
  const rawDuration = parseInt(formData.get('duration_minutes') as string, 10)
  const durationMinutes = ALLOWED_DURATIONS.includes(rawDuration) ? rawDuration : 60

  // Per-user throttle (DASH-07) — the credit balance already caps total bookings;
  // this stops scripted hammering of the endpoint. Generous ceiling so a real
  // burst of legit bookings never trips it.
  const rl = await checkUserActionLimit(user.id, 'createBooking', 25)
  if (!rl.ok) {
    return { error: lang === 'es' ? 'Demasiados intentos. Espera unos minutos.' : 'Too many attempts. Please wait a few minutes.' }
  }

  // ── Date validation + 24-hour advance notice ─────────────────
  const scheduledDate = new Date(scheduledAt)
  // Guard Invalid Date first — `NaN < minAllowed` is `false`, so without this an
  // 'Invalid Date' would slip straight past the 24h check and persist.
  if (isNaN(scheduledDate.getTime())) {
    return { error: lang === 'es' ? 'Fecha inválida.' : 'Invalid date.' }
  }
  const minAllowed = new Date(Date.now() + 24 * 60 * 60 * 1000)
  if (scheduledDate < minAllowed) {
    return {
      error: lang === 'es'
        ? 'Las reservas requieren al menos 24 horas de anticipación.'
        : 'Bookings require at least 24 hours advance notice.',
    }
  }
  // Far-future sanity cap — a booking 90+ days out consumes a non-expiring credit
  // with no useful reminders; almost always a typo or abuse.
  const maxAllowed = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  if (scheduledDate > maxAllowed) {
    return {
      error: lang === 'es'
        ? 'Solo puedes agendar hasta 90 días por adelantado.'
        : 'You can only book up to 90 days in advance.',
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
  // Booking is book-first / assign-after: the student picks any slot and the
  // admin assigns an available teacher to the booking afterward. No teacher
  // pre-assignment is required to book.

  // ── Conflict check (interval overlap, not exact-timestamp) ───
  if (await studentHasTimeConflict(admin, student.id, scheduledAt, durationMinutes)) {
    return {
      error: lang === 'es'
        ? 'Ya tienes una clase agendada para ese horario.'
        : 'You already have a class booked for that time slot.',
    }
  }

  // ── Consume a credit FIRST (authoritative atomic gate) ───────
  // decrement_classes returns false when the student has 0 credits. Doing it
  // BEFORE the insert closes the TOCTOU race where two concurrent bookings both
  // pass the read-check above and each book on the same last credit. Only insert
  // once a credit is actually consumed; compensate (refund) if the insert fails.
  const { data: creditConsumed } = await admin.rpc('decrement_classes', { p_student_id: student.id })
  if (!creditConsumed) {
    return {
      error: lang === 'es'
        ? 'No tienes clases disponibles. Adquiere un plan.'
        : 'No classes remaining. Get a plan.',
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

  if (error) {
    // Insert failed after the credit was consumed — give it back.
    await admin.rpc('increment_classes', { p_student_id: student.id })
    // A unique-constraint violation means a concurrent insert already claimed this
    // slot (the pre-check above can lose a race). Surface the same friendly
    // "already booked" copy instead of a raw Postgres string (BOOKING-08).
    if (error.code === '23505' || /duplicate key/i.test(error.message)) {
      return {
        error: lang === 'es'
          ? 'Ya tienes una clase agendada para ese horario.'
          : 'You already have a class booked for that time slot.',
      }
    }
    // Any other DB error: log the raw detail server-side, return a generic
    // localized message so no internal error string leaks to the client.
    console.error('createBooking insert failed:', error.message)
    return {
      error: lang === 'es'
        ? 'No se pudo crear la reserva. Inténtalo de nuevo.'
        : 'Could not create the booking. Please try again.',
    }
  }

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
    .select('id, is_active')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) return { error: 'Teacher profile not found' }
  if (!teacher.is_active) return { error: 'Teacher account is not active' }

  // Status guard: only a PENDING booking can be confirmed. Without `.eq('status',
  // 'pending')` a re-confirm could resurrect a cancelled/declined booking (the
  // student keeps the refunded credit AND gets a live class). The `.select()`
  // asserts a row actually changed — a foreign/stale id no longer returns success.
  const { data: confirmed, error } = await admin
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)
    .eq('teacher_id', teacher.id)
    .eq('status', 'pending')
    .select('id')

  if (error) return { error: bookingActionErrorMsg(error, lang, 'confirmBooking') }
  if (!confirmed || confirmed.length === 0) {
    return { error: lang === 'es' ? 'Esta reserva ya no se puede confirmar.' : 'This booking can no longer be confirmed.' }
  }

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
    .select('id, is_active')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) return { error: 'Teacher profile not found' }
  if (!teacher.is_active) return { error: 'Teacher account is not active' }

  // Status-gated cancel: only a still-live booking can be declined, and the
  // refund fires only when THIS call actually flipped the row — so a double-click
  // or concurrent decline can't double-credit the student. Populate the audit
  // fields (cancelled_by/reason/cancelled_at) like every other cancel path —
  // declineBooking was the lone path leaving them NULL, so a teacher decline was
  // an invisible, credit-affecting cancellation (no admin email, and any
  // cancelled_by='student' analytic missed it) (SB-05).
  const { data: declined, error } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: 'teacher',
      cancellation_reason: 'teacher_decline',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .eq('teacher_id', teacher.id)
    .in('status', ['pending', 'confirmed'])
    .select('student_id, type, scheduled_at')

  if (error) return { error: bookingActionErrorMsg(error, lang, 'declineBooking') }
  if (!declined || declined.length === 0) {
    return { error: lang === 'es' ? 'Esta reserva ya no se puede rechazar.' : 'This booking can no longer be declined.' }
  }

  // Restore the student's class (exactly once) — CLASS bookings only. A
  // placement_test is a FREE call and must never mint a paid credit; declineBooking
  // was the lone refund path missing this guard (studentCancelBooking,
  // reportTeacherNoShow, and both admin cancels all guard type==='class').
  const refundIssued = declined[0].type === 'class'
  if (refundIssued) {
    await admin.rpc('increment_classes', { p_student_id: declined[0].student_id })
  }

  // Cancel any already-scheduled reminder emails (no-op if booking was still
  // pending when declined and no reminders had been scheduled yet).
  cancelBookingReminders(bookingId).catch(() => {})

  // Notify the admin (best-effort) so a teacher decline surfaces in the same
  // channel as student cancels / no-show reports — it frees a slot that needs a
  // new teacher assigned.
  const { data: stuName } = await admin
    .from('students')
    .select('profile:profiles(full_name)')
    .eq('id', declined[0].student_id)
    .maybeSingle()
  const stuProfile = (stuName?.profile ?? null) as
    | { full_name?: string | null }
    | { full_name?: string | null }[]
    | null
  const studentName =
    (Array.isArray(stuProfile) ? stuProfile[0]?.full_name : stuProfile?.full_name) || 'Student'
  notifyAdminOfCancel({
    bookingId,
    studentName,
    reason: 'teacher_decline',
    scheduledAt: declined[0].scheduled_at,
    refundIssued,
    lang,
  }).catch(() => {})

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
    .select('id, is_active')
    .eq('profile_id', user.id)
    .single()
  if (!teacher) return { error: 'Teacher profile not found' }
  if (!teacher.is_active) return { error: 'Teacher account is not active' }

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
  lang?: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@englishkolab.com'
  if (!apiKey || apiKey === 're_placeholder') return

  // Admin notifications go to the owner (Spanish-first), regardless of the
  // student's own language.
  const reasonLabel = cancelReasonLabel(params.reason, 'es')
  const reviewUrl = `${APP_URL}/es/admin/bookings`

  const scheduled = new Date(params.scheduledAt).toLocaleString('es-HN', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    timeZone: 'America/Tegucigalpa',
  })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: adminEmail,
      subject: `Clase cancelada — ${params.studentName} (${reasonLabel})`,
      html: brandedEmail({
        heading: 'Clase cancelada',
        bodyHtml: `
          <p style="margin:0 0 16px;">${escapeHtml(params.studentName)} canceló una clase.</p>
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Motivo</td><td style="padding:4px 0;color:#111111;font-weight:600;">${escapeHtml(reasonLabel)}</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Estaba agendada</td><td style="padding:4px 0;color:#111111;font-weight:600;">${scheduled}</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Crédito restituido</td><td style="padding:4px 0;color:#111111;font-weight:600;">${params.refundIssued ? 'Sí' : 'No'}</td></tr>
          </table>`,
        ctaLabel: 'Revisar',
        ctaUrl: reviewUrl,
        lang: 'es',
      }),
      text: [
        `${params.studentName} canceló una clase.`,
        '',
        `Motivo: ${reasonLabel}`,
        `Estaba agendada: ${scheduled} (hora de Honduras)`,
        `Crédito restituido: ${params.refundIssued ? 'Sí' : 'No'}`,
        '',
        `Revisar: ${reviewUrl}`,
      ].join('\n'),
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

  // Status-gated cancel — only flip a still-live booking, and refund only when
  // THIS call actually changed the row (idempotent under concurrent cancels, so
  // the credit can't be restored twice).
  const { data: cancelledRows, error: updErr } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: 'student',
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .eq('student_id', student.id)
    .in('status', ['pending', 'confirmed'])
    .select('id')
  if (updErr) return { error: bookingActionErrorMsg(updErr, lang, 'studentCancelBooking') }
  if (!cancelledRows || cancelledRows.length === 0) {
    return { error: lang === 'es' ? 'Esta clase ya no se puede cancelar.' : 'This class can no longer be cancelled.' }
  }

  // Refund a credit ONLY for a paid class cancelled with ≥24h notice (the pricing
  // copy: "classes cancelled with less than 24-hour notice are forfeited"). A
  // placement is free — refunding it would mint a class credit from nothing — and
  // a cancelled placement must clear placement_scheduled so the student can re-book
  // instead of being stranded on a blank scheduled screen.
  if (booking.type === 'class') {
    if (!isLate) {
      await admin.rpc('increment_classes', { p_student_id: student.id })
    }
  } else if (booking.type === 'placement_test') {
    await admin.from('students').update({ placement_scheduled: false }).eq('id', student.id)
  }

  // Cancel any still-open reschedule request on this booking — the class is gone,
  // so an admin must not be able to approve a now-orphaned request later (BOOK-04).
  // The admin approve path also status-guards, so a failure here is non-fatal —
  // log it for visibility rather than swallowing silently.
  const { error: rrCancelErr } = await admin
    .from('reschedule_requests')
    .update({ status: 'cancelled' })
    .eq('booking_id', bookingId)
    .eq('status', 'pending')
  if (rrCancelErr) console.error('studentCancelBooking: failed to cancel open reschedule requests for', bookingId, rrCancelErr.message)

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
    lang,
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
    .select('id, scheduled_at, duration_minutes, status, type, student_id, teacher_id')
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

  // Conflict check against this student's OTHER live bookings (interval overlap;
  // excludeBookingId keeps the booking being moved from conflicting with itself).
  const reschedDuration = (booking as { duration_minutes?: number | null }).duration_minutes || 60
  if (await studentHasTimeConflict(admin, student.id, newDate.toISOString(), reschedDuration, bookingId)) {
    return {
      error: lang === 'es'
        ? 'Ya tienes una clase agendada para ese horario.'
        : 'You already have a class booked for that time slot.',
    }
  }

  // Move the booking. Status drops back to 'pending' so the teacher (if one
  // was already assigned) re-confirms — the original confirmation was for the
  // old time and shouldn't carry over silently.
  // Status-gated move: only a still-live booking can be rescheduled, and the
  // write itself re-asserts the status — so a class completed/cancelled between
  // the read above and this write can't be resurrected to 'pending' (money-2).
  const { data: movedRows, error: updErr } = await admin
    .from('bookings')
    .update({
      scheduled_at: newDate.toISOString(),
      status: 'pending',
    })
    .eq('id', bookingId)
    .eq('student_id', student.id)
    .in('status', ['pending', 'confirmed'])
    .select('id')
  if (updErr) return { error: bookingActionErrorMsg(updErr, lang, 'studentRescheduleBooking') }
  if (!movedRows || movedRows.length === 0) {
    return { error: lang === 'es' ? 'Esta clase ya no se puede reagendar.' : 'This class can no longer be rescheduled.' }
  }

  // Cancel any still-open reschedule request on this booking — the student just
  // moved it to a new time, so a teacher's pending request against the old time
  // is now stale and must not stay approvable in the admin queue (BOOK-04). Even
  // if this write fails, approveRescheduleRequest re-checks original_scheduled_at
  // vs the booking's current time and rejects the stale request; log on failure.
  const { error: rrCancelErr } = await admin
    .from('reschedule_requests')
    .update({ status: 'cancelled' })
    .eq('booking_id', bookingId)
    .eq('status', 'pending')
  if (rrCancelErr) console.error('studentRescheduleBooking: failed to cancel open reschedule requests for', bookingId, rrCancelErr.message)

  // A student reschedule ALWAYS drops the booking to 'pending' (line above) — the
  // teacher must re-confirm. scheduleBookingReminders unconditionally sends a
  // "your class is confirmed" email, so calling it here fired a FALSE confirmation
  // for a not-yet-confirmed class (and a duplicate when the teacher re-confirms) —
  // deep-audit EML-1. Instead WIPE the stale reminders/.ics for the old time; the
  // teacher's confirmBooking re-schedules fresh reminders for the new time on
  // re-confirm (mirrors the admin reschedule path's pending branch).
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
    .select('id, scheduled_at, duration_minutes, status, student_id, teacher_id, type')
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

  // A "teacher no-show" means the STUDENT showed up but the teacher never did.
  // Require proof the student actually joined the room (sessions.student_joined_at,
  // migration 045) before refunding. Without this, a student who no-showed THEIR
  // OWN class could self-refund after the window — an infinite-class exploit (book,
  // both parties skip, wait it out, claim "teacher no-show", get a credit back).
  // No attendance record for the student → no refund.
  // (The old gate keyed off sessions.started_at — which getRoomAccess sets the
  // instant ANYONE opens the room — so it actually refunded the no-attendance case
  // and BLOCKED a real teacher-no-show where the student had joined. Inverted.)
  const { data: session } = await admin
    .from('sessions')
    .select('student_joined_at')
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (!session?.student_joined_at) {
    return {
      error: lang === 'es'
        ? 'No tenemos registro de que te hayas unido a esta clase, así que no podemos reportar una ausencia del maestro. Si hubo un problema, contáctanos.'
        : "We have no record that you joined this class, so we can't report a teacher no-show. If something went wrong, please contact support.",
    }
  }

  // Status-gated cancel; refund fires only when THIS call flipped the row
  // (idempotent under races) AND only for paid CLASS bookings — a placement is
  // free, so refunding a no-show placement would mint a credit from nothing.
  const { data: noShowRows, error: updErr } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: 'student',
      cancellation_reason: 'no_show_teacher',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .eq('student_id', student.id)
    .in('status', ['pending', 'confirmed'])
    .select('id')
  if (updErr) return { error: bookingActionErrorMsg(updErr, lang, 'reportTeacherNoShow') }
  if (!noShowRows || noShowRows.length === 0) {
    return { error: lang === 'es' ? 'Esta clase ya está cerrada.' : 'This class is already closed.' }
  }

  const refundIssued = booking.type === 'class'
  if (refundIssued) {
    await admin.rpc('increment_classes', { p_student_id: student.id })
  } else if (booking.type === 'placement_test') {
    // A no-showed placement must clear placement_scheduled so the student can
    // re-book instead of being stranded on a blank scheduled screen.
    await admin.from('students').update({ placement_scheduled: false }).eq('id', student.id)
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
    reason: 'no_show_teacher',
    scheduledAt: booking.scheduled_at,
    refundIssued,
    lang,
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
    .select('id, is_active')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) return { error: 'Teacher profile not found' }
  if (!teacher.is_active) return { error: 'Teacher account is not active' }

  // Validate the WHOLE batch BEFORE the destructive delete — otherwise a bad row
  // wipes the teacher's existing slots and leaves them unbookable.
  if (slots.length > 80) {
    return { error: lang === 'es' ? 'Demasiados horarios.' : 'Too many slots.' }
  }
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
  for (const s of slots) {
    if (typeof s.day_of_week !== 'number' || !Number.isInteger(s.day_of_week) || s.day_of_week < 0 || s.day_of_week > 6) {
      return { error: lang === 'es' ? 'Día de la semana inválido.' : 'Invalid day of week.' }
    }
    if (!timeRe.test(s.start_time) || !timeRe.test(s.end_time) || s.start_time >= s.end_time) {
      return { error: lang === 'es' ? 'Rango de horario inválido.' : 'Invalid time range.' }
    }
  }

  // Server-side overlap/duplicate guard. The AvailabilityClient blocks overlaps in
  // the UI, but the ACTION is the boundary — a crafted/replayed call must not
  // persist overlapping or byte-identical windows (there is no unique index on
  // availability_slots). Times are zero-padded HH:MM, so a lexicographic compare
  // (sliced to HH:MM) detects interval overlap within the same day.
  const hhmm = (t: string) => t.slice(0, 5)
  const slotsByDay = new Map<number, { start: string; end: string }[]>()
  for (const s of slots) {
    const arr = slotsByDay.get(s.day_of_week) ?? []
    const start = hhmm(s.start_time), end = hhmm(s.end_time)
    if (arr.some((e) => start < e.end && end > e.start)) {
      return { error: lang === 'es' ? 'Tienes horarios que se traslapan.' : 'You have overlapping time slots.' }
    }
    arr.push({ start, end })
    slotsByDay.set(s.day_of_week, arr)
  }

  // P3: atomic replace-all (migration 052) — the old delete-then-insert wiped a
  // teacher's slots if the insert failed transiently. One transaction = a failure
  // rolls back and the existing slots survive. Empty list is handled inside (delete
  // all, insert none).
  const { error } = await admin.rpc('replace_availability_slots', {
    p_teacher_id: teacher.id,
    p_slots: slots.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
    })),
  })
  if (error) return { error: bookingActionErrorMsg(error, lang, 'saveAvailabilitySlots') }

  revalidatePath('/', 'layout')
  return { success: true }
}
