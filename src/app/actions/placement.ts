'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { escapeHtml, brandedEmail, EMAIL_FROM, APP_URL } from '@/lib/email'
import { studentHasTimeConflict } from '@/lib/bookingConflict'
import { checkUserActionLimit } from '@/lib/rateLimit'

export async function saveSurveyAnswers(
  answers: Record<string, unknown>,
  lang: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Bound the payload — it's a short fixed survey; reject an oversized blob so a
  // direct call can't write unbounded JSON to the student row.
  try {
    if (!answers || typeof answers !== 'object' || JSON.stringify(answers).length > 10000) {
      return { error: lang === 'es' ? 'Respuestas inválidas.' : 'Invalid answers.' }
    }
  } catch {
    return { error: lang === 'es' ? 'Respuestas inválidas.' : 'Invalid answers.' }
  }

  // Auth validated. Use admin client for writes (RLS-edge fix).
  const admin = createAdminClient()
  const { error } = await admin
    .from('students')
    .update({ survey_answers: answers })
    .eq('profile_id', user.id)

  if (error) {
    console.error('saveSurveyAnswers failed:', error.message)
    return { error: lang === 'es' ? 'No se pudo guardar. Inténtalo de nuevo.' : 'Could not save. Please try again.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function bookPlacementCall(
  scheduledAt: string,
  lang: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Per-user throttle (DASH-07) — a placement call is a once-ish action; cap
  // rapid repeats to protect the booking/email path from abuse.
  const rl = await checkUserActionLimit(user.id, 'bookPlacementCall', 5)
  if (!rl.ok) {
    return { error: lang === 'es' ? 'Demasiados intentos. Espera unos minutos.' : 'Too many attempts. Please wait a few minutes.' }
  }

  // Date validation — placement skipped this entirely, so a direct call could
  // persist an Invalid Date or a past/far-future time. (Lenient on notice since
  // it's a free intro call — only reject invalid, past, and 90+ days out.)
  const scheduledDate = new Date(scheduledAt)
  if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now()) {
    return { error: lang === 'es' ? 'Fecha inválida o en el pasado.' : 'Invalid or past date.' }
  }
  if (scheduledDate.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000) {
    return { error: lang === 'es' ? 'Solo puedes agendar hasta 90 días por adelantado.' : 'You can only book up to 90 days in advance.' }
  }

  // Auth validated. Admin client for all subsequent DB access (RLS-edge fix).
  const admin = createAdminClient()

  const [{ data: student }, { data: profile }] = await Promise.all([
    admin.from('students').select('id, placement_test_done').eq('profile_id', user.id).single(),
    admin.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  if (!student) {
    return { error: lang === 'es' ? 'Perfil no encontrado.' : 'Student profile not found.' }
  }
  // Don't re-open a finished assessment — a direct call after placement is done
  // would resurrect the flow and re-set placement_scheduled (mirror reschedulePlacementCall).
  if (student.placement_test_done) {
    return { error: lang === 'es' ? 'Tu evaluación de nivel ya está completa.' : 'Your placement assessment is already complete.' }
  }

  // Prevent double-booking
  const { data: existing } = await admin
    .from('bookings')
    .select('id, scheduled_at')
    .eq('student_id', student.id)
    .eq('type', 'placement_test')
    .in('status', ['confirmed', 'pending'])
    .maybeSingle()

  if (existing) {
    return {
      error: lang === 'es'
        ? 'Ya tienes una llamada de diagnóstico agendada.'
        : 'You already have an evaluation call scheduled.',
      existingAt: existing.scheduled_at,
    }
  }

  // Prevent overlap with any other active booking (interval overlap, not just an
  // exact-timestamp match). Placement calls are always 60 minutes.
  if (await studentHasTimeConflict(admin, student.id, scheduledAt, 60)) {
    return {
      error: lang === 'es'
        ? 'Ya tienes una clase agendada para ese horario.'
        : 'You already have a class booked for that time slot.',
    }
  }

  const { data: booking, error } = await admin
    .from('bookings')
    .insert({
      student_id: student.id,
      teacher_id: null,
      scheduled_at: scheduledAt,
      duration_minutes: 60,
      status: 'pending',
      type: 'placement_test',
    })
    .select()
    .single()

  if (error) {
    console.error('bookPlacementCall insert failed:', error.message)
    return { error: lang === 'es' ? 'No se pudo agendar. Inténtalo de nuevo.' : 'Could not schedule. Please try again.' }
  }

  // Mark placement call as scheduled (not yet completed)
  await admin
    .from('students')
    .update({ placement_scheduled: true })
    .eq('profile_id', user.id)

  // Send emails (non-blocking — never let this break the flow)
  sendPlacementEmails({
    studentEmail: user.email || '',
    studentName: profile?.full_name || user.email || 'Student',
    scheduledAt,
    lang,
  })

  revalidatePath('/', 'layout')
  return { success: true, bookingId: booking.id }
}

export async function reschedulePlacementCall(
  newScheduledAt: string,
  lang: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Per-user throttle (mirror bookPlacementCall) — reschedule was the one
  // unthrottled placement path, so a scripted student could loop
  // cancel+insert+admin-email unbounded (PL-RL-RESCHED-01). 'reschedulePlacementCall'
  // is allowlisted in auth_attempts (migration 044) so this isn't a silent no-op.
  const rl = await checkUserActionLimit(user.id, 'reschedulePlacementCall', 5)
  if (!rl.ok) {
    return { error: lang === 'es' ? 'Demasiados intentos. Espera unos minutos.' : 'Too many attempts. Please wait a few minutes.' }
  }

  // Date validation (same rules as bookPlacementCall) — a direct call could
  // otherwise persist an Invalid Date or a past/far-future time (DASH-05).
  const scheduledDate = new Date(newScheduledAt)
  if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now()) {
    return { error: lang === 'es' ? 'Fecha inválida o en el pasado.' : 'Invalid or past date.' }
  }
  if (scheduledDate.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000) {
    return { error: lang === 'es' ? 'Solo puedes agendar hasta 90 días por adelantado.' : 'You can only book up to 90 days in advance.' }
  }

  // Auth validated. Admin client for all DB access (RLS-edge fix).
  const admin = createAdminClient()

  const [{ data: student }, { data: profile }] = await Promise.all([
    admin.from('students').select('id, placement_test_done').eq('profile_id', user.id).single(),
    admin.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  if (!student) {
    return { error: lang === 'es' ? 'Perfil no encontrado.' : 'Student profile not found.' }
  }

  // Don't re-open a finished assessment — once placement_test_done is true, a
  // direct call to this action would resurrect a completed flow (BOOK-05).
  if (student.placement_test_done) {
    return {
      error: lang === 'es'
        ? 'Tu evaluación de nivel ya está completa.'
        : 'Your placement assessment is already complete.',
    }
  }

  // Find the current live placement (if any) so the overlap check can exclude it
  // — otherwise moving to a time that overlaps the very booking being replaced
  // would falsely self-conflict.
  const { data: livePlacements } = await admin
    .from('bookings')
    .select('id')
    .eq('student_id', student.id)
    .eq('type', 'placement_test')
    .in('status', ['pending', 'confirmed'])
  const excludePlacementId = livePlacements?.[0]?.id

  // Ensure the new time doesn't overlap any OTHER live booking (e.g. a scheduled
  // class) — the same interval-overlap guard bookPlacementCall/createBooking use.
  // Checked BEFORE cancelling so a conflict never strands the student's call
  // (placement-resched-2).
  if (await studentHasTimeConflict(admin, student.id, newScheduledAt, 60, excludePlacementId)) {
    return {
      error: lang === 'es'
        ? 'Ya tienes una clase agendada para ese horario.'
        : 'You already have a class booked for that time slot.',
    }
  }

  // Cancel only still-live placement bookings (pending/confirmed) — never flip a
  // 'completed' placement back to cancelled and erase its terminal state (BOOK-05).
  await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('student_id', student.id)
    .eq('type', 'placement_test')
    .in('status', ['pending', 'confirmed'])

  // Create new booking
  const { data: booking, error } = await admin
    .from('bookings')
    .insert({
      student_id: student.id,
      teacher_id: null,
      scheduled_at: newScheduledAt,
      duration_minutes: 60,
      status: 'pending',
      type: 'placement_test',
    })
    .select()
    .single()

  if (error) {
    console.error('reschedulePlacementCall insert failed:', error.message)
    return { error: lang === 'es' ? 'No se pudo agendar. Inténtalo de nuevo.' : 'Could not schedule. Please try again.' }
  }

  // Keep placement_scheduled = true
  await admin
    .from('students')
    .update({ placement_scheduled: true })
    .eq('profile_id', user.id)

  // Notify admin (non-blocking)
  sendRescheduleNotification({
    studentEmail: user.email || '',
    studentName: profile?.full_name || user.email || 'Student',
    newScheduledAt,
    lang,
  })

  revalidatePath('/', 'layout')
  return { success: true, bookingId: booking.id }
}

function sendRescheduleNotification(params: {
  studentEmail: string
  studentName: string
  newScheduledAt: string
  lang: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@englishkolab.com'

  if (!apiKey || apiKey === 're_placeholder') return

  const hnFormatted = new Date(params.newScheduledAt).toLocaleString('es-HN', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Tegucigalpa',
  })

  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: adminEmail,
      subject: `Llamada de diagnóstico reagendada — ${params.studentName}`,
      html: brandedEmail({
        heading: 'Llamada de diagnóstico reagendada',
        bodyHtml: `
          <p style="margin:0 0 16px;">Un estudiante reagendó su llamada de diagnóstico.</p>
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Estudiante</td><td style="padding:4px 0;color:#111111;font-weight:600;">${escapeHtml(params.studentName)}</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Correo</td><td style="padding:4px 0;color:#111111;font-weight:600;">${escapeHtml(params.studentEmail)}</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Nueva fecha</td><td style="padding:4px 0;color:#111111;font-weight:600;">${hnFormatted} (hora de Honduras)</td></tr>
          </table>`,
        ctaLabel: 'Ver en el panel',
        ctaUrl: `${APP_URL}/es/admin/bookings`,
        lang: 'es',
      }),
      text: [
        'Un estudiante reagendó su llamada de diagnóstico.',
        '',
        `Estudiante: ${params.studentName} (${params.studentEmail})`,
        `Nueva fecha: ${hnFormatted} (hora de Honduras)`,
        '',
        `Ver en el panel: ${APP_URL}/es/admin/bookings`,
      ].join('\n'),
    }),
  }).catch(() => {})
}

function sendPlacementEmails(params: {
  studentEmail: string
  studentName: string
  scheduledAt: string
  lang: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@englishkolab.com'

  if (!apiKey || apiKey === 're_placeholder') return

  const hnFormatted = new Date(params.scheduledAt).toLocaleString('es-HN', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Tegucigalpa',
  })
  const enFormatted = new Date(params.scheduledAt).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Tegucigalpa',
  })

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  // Notify admin
  fetch('https://api.resend.com/emails', {
    method: 'POST', headers,
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: adminEmail,
      subject: `Nueva llamada de diagnóstico — ${params.studentName}`,
      html: brandedEmail({
        heading: 'Nueva llamada de diagnóstico',
        bodyHtml: `
          <p style="margin:0 0 16px;">Un estudiante agendó su llamada de diagnóstico gratuita.</p>
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Estudiante</td><td style="padding:4px 0;color:#111111;font-weight:600;">${escapeHtml(params.studentName)}</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Correo</td><td style="padding:4px 0;color:#111111;font-weight:600;">${escapeHtml(params.studentEmail)}</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Fecha y hora</td><td style="padding:4px 0;color:#111111;font-weight:600;">${hnFormatted} (hora de Honduras)</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Duración</td><td style="padding:4px 0;color:#111111;font-weight:600;">60 minutos</td></tr>
          </table>`,
        ctaLabel: 'Ver en el panel',
        ctaUrl: `${APP_URL}/es/admin/bookings`,
        lang: 'es',
      }),
      text: [
        'Un estudiante agendó su llamada de diagnóstico gratuita.',
        '',
        `Estudiante: ${params.studentName} (${params.studentEmail})`,
        `Fecha y hora: ${hnFormatted} (hora de Honduras)`,
        'Duración: 60 minutos',
        '',
        `Ver en el panel: ${APP_URL}/es/admin/bookings`,
      ].join('\n'),
    }),
  }).catch(() => {})

  // Confirm to student
  const isEs = params.lang === 'es'
  fetch('https://api.resend.com/emails', {
    method: 'POST', headers,
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: params.studentEmail,
      subject: isEs
        ? 'Tu llamada de diagnóstico está confirmada — EnglishKolab'
        : 'Your placement call is confirmed — EnglishKolab',
      html: brandedEmail({
        heading: isEs ? 'Tu llamada está confirmada' : 'Your placement call is confirmed',
        bodyHtml: isEs
          ? `<p style="margin:0 0 12px;">Hola ${escapeHtml(params.studentName)},</p><p style="margin:0 0 12px;">¡Tu llamada de diagnóstico gratuita está confirmada!</p><p style="margin:0;"><strong>Fecha:</strong> ${hnFormatted} (hora de Honduras, CST)</p>`
          : `<p style="margin:0 0 12px;">Hi ${escapeHtml(params.studentName)},</p><p style="margin:0 0 12px;">Your free placement call is confirmed!</p><p style="margin:0;"><strong>Date:</strong> ${enFormatted} (Honduras time, CST)</p>`,
        footnote: isEs
          ? 'Nos comunicaremos contigo a través de la plataforma. ¿Preguntas? Escríbenos a hola@englishkolab.com.'
          : "We'll reach out through the platform. Questions? Email us at hola@englishkolab.com.",
        lang: isEs ? 'es' : 'en',
      }),
      text: isEs
        ? [
            `Hola ${params.studentName},`,
            '¡Tu llamada de diagnóstico gratuita está confirmada!',
            `Fecha: ${hnFormatted} (hora de Honduras, CST)`,
            'Nos comunicaremos contigo a través de la plataforma. ¿Preguntas? Escríbenos a hola@englishkolab.com.',
            '— El equipo de EnglishKolab',
          ].join('\n')
        : [
            `Hi ${params.studentName},`,
            'Your free placement call is confirmed!',
            `Date: ${enFormatted} (Honduras time, CST)`,
            "We'll reach out through the platform. Questions? Email us at hola@englishkolab.com.",
            '— The EnglishKolab team',
          ].join('\n'),
    }),
  }).catch(() => {})
}

const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

// Teacher sets a student's CEFR level post-assessment. Gated on the caller
// being a teacher role AND having a booking relationship with the student
// (mirrors the RLS SELECT policy on students for teacher access).
export async function teacherSetStudentLevel(studentId: string, level: string) {
  if (!VALID_CEFR.has(level)) {
    return { error: 'Invalid CEFR level' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'teacher') {
    return { error: 'Only teachers can set a student level from this flow' }
  }

  const admin = createAdminClient()

  const { data: teacher } = await admin
    .from('teachers')
    .select('id, is_active')
    .eq('profile_id', user.id)
    .single()
  if (!teacher?.id) return { error: 'Teacher record not found' }
  // A deactivated/un-approved teacher must not mutate student data, even via a
  // historical booking relationship (mirrors the requireTeacher is_active gate).
  if (!teacher.is_active) return { error: 'Teacher account is not active' }

  // Must have at least one booking with this student (any status except
  // cancelled). Otherwise the teacher isn't supposed to see the student.
  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacher.id)
    .eq('student_id', studentId)
    .neq('status', 'cancelled')
  if (!count) {
    return { error: 'You have no booking with this student' }
  }

  const { error } = await admin
    .from('students')
    .update({ level })
    .eq('id', studentId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
