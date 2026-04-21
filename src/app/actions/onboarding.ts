'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function completeStudentOnboarding(data: {
  userId: string
  timezone: string
  preferredLanguage: 'es' | 'en'
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== data.userId) return { success: false, error: 'Not authenticated' }

  // Auth was validated above. Switch to admin client for the writes —
  // bypasses an RLS edge case where the new user's JWT isn't yet bound
  // at insert-time ("permission denied for table students/teachers").
  const admin = createAdminClient()

  const { error: profileError } = await admin
    .from('profiles')
    .update({ timezone: data.timezone, preferred_language: data.preferredLanguage })
    .eq('id', data.userId)

  if (profileError) return { success: false, error: profileError.message }

  const { error: studentError } = await admin
    .from('students')
    .upsert({
      profile_id: data.userId,
    }, { onConflict: 'profile_id' })

  if (studentError) return { success: false, error: studentError.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

const CV_BUCKET = 'teacher-docs'
const CV_MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const CV_ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export async function completeTeacherOnboarding(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = (formData.get('userId') as string | null) || ''
  if (!user || user.id !== userId) return { success: false, error: 'Not authenticated' }

  const timezone = (formData.get('timezone') as string | null) || ''
  const preferredLanguage = ((formData.get('preferredLanguage') as string | null) || 'es') as 'es' | 'en'
  const bio = (formData.get('bio') as string | null) || ''
  const specializations = JSON.parse((formData.get('specializations') as string | null) || '[]') as string[]
  const certifications = JSON.parse((formData.get('certifications') as string | null) || '[]') as string[]
  const cvFile = formData.get('cv') as File | null

  if (bio.trim().length < 20) return { success: false, error: 'Bio must be at least 20 characters' }
  if (!cvFile || cvFile.size === 0) return { success: false, error: 'CV / resume is required' }
  if (cvFile.size > CV_MAX_BYTES) return { success: false, error: 'CV exceeds 10 MB limit' }
  if (!CV_ALLOWED_MIME.has(cvFile.type)) return { success: false, error: 'CV must be a PDF or Word document' }

  // Auth validated. Use admin client for writes (see student branch).
  const admin = createAdminClient()

  const ext = cvFile.name.toLowerCase().match(/\.(pdf|docx?|doc)$/)?.[0] || '.pdf'
  const storagePath = `${userId}/${Date.now()}${ext}`
  const buffer = Buffer.from(await cvFile.arrayBuffer())
  const { error: uploadErr } = await admin.storage
    .from(CV_BUCKET)
    .upload(storagePath, buffer, {
      contentType: cvFile.type,
      upsert: true,
    })
  if (uploadErr) return { success: false, error: `CV upload failed: ${uploadErr.message}` }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ timezone, preferred_language: preferredLanguage })
    .eq('id', userId)

  if (profileError) return { success: false, error: profileError.message }

  const { error: teacherError } = await admin
    .from('teachers')
    .upsert({
      profile_id: userId,
      bio,
      specializations,
      certifications,
      hourly_rate: 0,
      is_active: false,
      cv_storage_path: storagePath,
      cv_uploaded_at: new Date().toISOString(),
      cv_original_filename: cvFile.name,
    }, { onConflict: 'profile_id' })

  if (teacherError) return { success: false, error: teacherError.message }

  // Fire-and-forget application emails (teacher confirmation + admin notification)
  void sendTeacherApplicationEmails({
    teacherEmail: user.email || '',
    teacherName: user.user_metadata?.full_name || '',
    lang: preferredLanguage,
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
