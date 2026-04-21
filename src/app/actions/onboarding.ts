'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function completeStudentOnboarding(data: {
  userId: string
  timezone: string
  preferredLanguage: 'es' | 'en'
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== data.userId) return { success: false, error: 'Not authenticated' }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ timezone: data.timezone, preferred_language: data.preferredLanguage })
    .eq('id', data.userId)

  if (profileError) return { success: false, error: profileError.message }

  const { error: studentError } = await supabase
    .from('students')
    .upsert({
      profile_id: data.userId,
    }, { onConflict: 'profile_id' })

  if (studentError) return { success: false, error: studentError.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function completeTeacherOnboarding(data: {
  userId: string
  timezone: string
  preferredLanguage: 'es' | 'en'
  bio: string
  specializations: string[]
  certifications?: string[]
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== data.userId) return { success: false, error: 'Not authenticated' }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ timezone: data.timezone, preferred_language: data.preferredLanguage })
    .eq('id', data.userId)

  if (profileError) return { success: false, error: profileError.message }

  const { error: teacherError } = await supabase
    .from('teachers')
    .upsert({
      profile_id: data.userId,
      bio: data.bio,
      specializations: data.specializations,
      certifications: data.certifications || [],
      hourly_rate: 0,
      is_active: false,
    }, { onConflict: 'profile_id' })

  if (teacherError) return { success: false, error: teacherError.message }

  // Fire-and-forget application emails (teacher confirmation + admin notification)
  void sendTeacherApplicationEmails({
    teacherEmail: user.email || '',
    teacherName: user.user_metadata?.full_name || '',
    lang: data.preferredLanguage,
  })

  revalidatePath('/', 'layout')
  return { success: true }
}

async function sendTeacherApplicationEmails(params: {
  teacherEmail: string
  teacherName: string
  lang: 'es' | 'en'
}) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@englishkolab.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  if (!apiKey || apiKey === 're_placeholder') return

  const firstName = params.teacherName.split(' ')[0] || ''

  const teacherSubject = params.lang === 'es'
    ? '¡Solicitud recibida! — EnglishKolab'
    : 'Application received — EnglishKolab'

  const teacherHtml = params.lang === 'es'
    ? `
      <h2>¡Hola ${firstName}!</h2>
      <p>Recibimos tu solicitud para enseñar en EnglishKolab. Gracias por unirte a nuestra comunidad.</p>
      <p>Nuestro equipo revisará tu perfil en las próximas 24-48 horas. Recibirás un correo en cuanto tu cuenta sea activada.</p>
      <p>Mientras tanto, puedes revisar tu solicitud aquí:<br/>
      <a href="${appUrl}/es/maestro/pending">Ver mi solicitud →</a></p>
      <p>— El equipo de EnglishKolab</p>
    `
    : `
      <h2>Hi ${firstName}!</h2>
      <p>We received your application to teach with EnglishKolab. Thanks for joining our community.</p>
      <p>Our team will review your profile in the next 24–48 hours. You'll receive an email once your account is activated.</p>
      <p>In the meantime, you can review your application here:<br/>
      <a href="${appUrl}/en/maestro/pending">View my application →</a></p>
      <p>— The EnglishKolab team</p>
    `

  // Teacher confirmation
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: params.teacherEmail,
      subject: teacherSubject,
      html: teacherHtml,
    }),
  }).catch(() => {})

  // Admin notification
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: adminEmail,
      subject: `New teacher application — ${params.teacherName || params.teacherEmail}`,
      html: `
        <p>A new teacher just applied. Review and approve in the admin panel.</p>
        <table>
          <tr><td><strong>Name</strong></td><td>${params.teacherName || '(not provided)'}</td></tr>
          <tr><td><strong>Email</strong></td><td>${params.teacherEmail}</td></tr>
        </table>
        <p><a href="${appUrl}/${params.lang}/admin/teachers">Review applications →</a></p>
      `,
    }),
  }).catch(() => {})
}
