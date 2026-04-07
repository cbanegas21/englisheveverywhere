'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function saveSurveyAnswers(
  answers: Record<string, unknown>,
  lang: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('students')
    .update({ survey_answers: answers })
    .eq('profile_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/${lang}/dashboard/placement`)
  revalidatePath(`/${lang}/dashboard/progreso`)
  return { success: true }
}

export async function bookPlacementCall(
  scheduledAt: string,
  lang: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const [{ data: student }, { data: profile }] = await Promise.all([
    supabase.from('students').select('id').eq('profile_id', user.id).single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  if (!student) {
    return { error: lang === 'es' ? 'Perfil no encontrado.' : 'Student profile not found.' }
  }

  // Prevent double-booking
  const { data: existing } = await supabase
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

  const coordinatorId = process.env.PLACEMENT_COORDINATOR_ID

  const insertData: Record<string, unknown> = {
    student_id: student.id,
    scheduled_at: scheduledAt,
    duration_minutes: 30,
    status: 'confirmed',
    type: 'placement_test',
  }
  if (coordinatorId) insertData.teacher_id = coordinatorId

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert(insertData)
    .select()
    .single()

  if (error) return { error: error.message }

  // Send emails (non-blocking — never let this break the flow)
  sendPlacementEmails({
    studentEmail: user.email || '',
    studentName: profile?.full_name || user.email || 'Student',
    scheduledAt,
    lang,
  })

  revalidatePath(`/${lang}/dashboard`)
  revalidatePath(`/${lang}/dashboard/placement`)
  revalidatePath(`/${lang}/dashboard/maestros`)
  return { success: true, bookingId: booking.id }
}

function sendPlacementEmails(params: {
  studentEmail: string
  studentName: string
  scheduledAt: string
  lang: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@englisheverywhere.com'
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
          <tr><td><strong>Duración</strong></td><td>30 minutos</td></tr>
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
        ? 'Tu llamada de diagnóstico está confirmada — English Everywhere'
        : 'Your evaluation call is confirmed — English Everywhere',
      html: isEs
        ? `
          <p>Hola ${params.studentName},</p>
          <p>¡Tu llamada de diagnóstico gratuita está confirmada!</p>
          <p>📅 <strong>Fecha:</strong> ${hnFormatted} (hora de Honduras, CST)</p>
          <p>Nos comunicaremos contigo a través de la plataforma. ¿Preguntas? Escríbenos a <a href="mailto:hola@englisheverywhere.com">hola@englisheverywhere.com</a>.</p>
          <p>— El equipo de English Everywhere</p>
        `
        : `
          <p>Hi ${params.studentName},</p>
          <p>Your free evaluation call is confirmed!</p>
          <p>📅 <strong>Date:</strong> ${enFormatted} (Honduras time, CST)</p>
          <p>We'll reach out through the platform. Questions? Email us at <a href="mailto:hola@englisheverywhere.com">hola@englisheverywhere.com</a>.</p>
          <p>— The English Everywhere team</p>
        `,
    }),
  }).catch(() => {})
}
