'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function saveSurveyAnswers(
  answers: Record<string, unknown>,
  lang: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Auth validated. Use admin client for writes (RLS-edge fix).
  const admin = createAdminClient()
  const { error } = await admin
    .from('students')
    .update({ survey_answers: answers })
    .eq('profile_id', user.id)

  if (error) return { error: error.message }

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

  // Auth validated. Admin client for all subsequent DB access (RLS-edge fix).
  const admin = createAdminClient()

  const [{ data: student }, { data: profile }] = await Promise.all([
    admin.from('students').select('id').eq('profile_id', user.id).single(),
    admin.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  if (!student) {
    return { error: lang === 'es' ? 'Perfil no encontrado.' : 'Student profile not found.' }
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

  // Prevent booking at same time as any other booking
  const { data: timeConflict } = await admin
    .from('bookings')
    .select('id')
    .eq('student_id', student.id)
    .eq('scheduled_at', scheduledAt)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (timeConflict) {
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

  if (error) return { error: error.message }

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

  // Auth validated. Admin client for all DB access (RLS-edge fix).
  const admin = createAdminClient()

  const [{ data: student }, { data: profile }] = await Promise.all([
    admin.from('students').select('id').eq('profile_id', user.id).single(),
    admin.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  if (!student) {
    return { error: lang === 'es' ? 'Perfil no encontrado.' : 'Student profile not found.' }
  }

  // Cancel all existing non-cancelled placement bookings
  await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('student_id', student.id)
    .eq('type', 'placement_test')
    .neq('status', 'cancelled')

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

  if (error) return { error: error.message }

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
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'

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
      from: fromEmail,
      to: adminEmail,
      subject: `Llamada de diagnóstico reagendada — ${params.studentName}`,
      html: `
        <p>Un estudiante reagendó su llamada de diagnóstico.</p>
        <table>
          <tr><td><strong>Estudiante</strong></td><td>${params.studentName} (${params.studentEmail})</td></tr>
          <tr><td><strong>Nueva fecha</strong></td><td>${hnFormatted} (CST Honduras)</td></tr>
        </table>
      `,
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
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'

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
      from: fromEmail,
      to: adminEmail,
      subject: `Nueva llamada de diagnóstico — ${params.studentName}`,
      html: `
        <p>Un estudiante agendó su llamada de diagnóstico gratuita.</p>
        <table>
          <tr><td><strong>Estudiante</strong></td><td>${params.studentName} (${params.studentEmail})</td></tr>
          <tr><td><strong>Fecha y hora</strong></td><td>${hnFormatted} (CST Honduras)</td></tr>
          <tr><td><strong>Duración</strong></td><td>60 minutos</td></tr>
        </table>
      `,
    }),
  }).catch(() => {})

  // Confirm to student
  const isEs = params.lang === 'es'
  fetch('https://api.resend.com/emails', {
    method: 'POST', headers,
    body: JSON.stringify({
      from: fromEmail,
      to: params.studentEmail,
      subject: isEs
        ? 'Tu llamada de diagnóstico está confirmada — EnglishKolab'
        : 'Your evaluation call is confirmed — EnglishKolab',
      html: isEs
        ? `
          <p>Hola ${params.studentName},</p>
          <p>¡Tu llamada de diagnóstico gratuita está confirmada!</p>
          <p>📅 <strong>Fecha:</strong> ${hnFormatted} (hora de Honduras, CST)</p>
          <p>Nos comunicaremos contigo a través de la plataforma. ¿Preguntas? Escríbenos a <a href="mailto:hola@englishkolab.com">hola@englishkolab.com</a>.</p>
          <p>— El equipo de EnglishKolab</p>
        `
        : `
          <p>Hi ${params.studentName},</p>
          <p>Your free evaluation call is confirmed!</p>
          <p>📅 <strong>Date:</strong> ${enFormatted} (Honduras time, CST)</p>
          <p>We'll reach out through the platform. Questions? Email us at <a href="mailto:hola@englishkolab.com">hola@englishkolab.com</a>.</p>
          <p>— The EnglishKolab team</p>
        `,
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
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!teacher?.id) return { error: 'Teacher record not found' }

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
