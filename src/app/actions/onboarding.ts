'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { escapeHtml, EMAIL_FROM, APP_URL } from '@/lib/email'
import { isValidTimeZone } from '@/lib/timezone'

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

  // Role guard — only a 'student' account may self-provision a students row.
  // Without this, a teacher (or any authed user) could create a students record.
  const { data: roleRow } = await admin.from('profiles').select('role').eq('id', data.userId).single()
  if (roleRow?.role !== 'student') return { success: false, error: 'Not a student account' }

  // Reject an invalid IANA zone — persisting it would throw a RangeError in a
  // later toLocale / Intl call across the app (DASH-01).
  if (!isValidTimeZone(data.timezone)) return { success: false, error: 'Invalid timezone' }

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
  // Guard the client-supplied JSON — malformed input would otherwise throw an
  // unhandled error. Normalize to bounded arrays of non-empty strings.
  let specializations: string[]
  let certifications: string[]
  try {
    const clean = (raw: string | null): string[] => {
      const arr = JSON.parse(raw || '[]')
      return Array.isArray(arr)
        ? arr.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 20).map(s => s.slice(0, 100))
        : []
    }
    specializations = clean(formData.get('specializations') as string | null)
    certifications = clean(formData.get('certifications') as string | null)
  } catch {
    return { success: false, error: 'Invalid specializations or certifications' }
  }
  const cvFile = formData.get('cv') as File | null

  if (!isValidTimeZone(timezone)) return { success: false, error: 'Invalid timezone' }
  if (bio.trim().length < 20) return { success: false, error: 'Bio must be at least 20 characters' }
  if (!cvFile || cvFile.size === 0) return { success: false, error: 'CV / resume is required' }
  if (cvFile.size > CV_MAX_BYTES) return { success: false, error: 'CV exceeds 10 MB limit' }
  if (!CV_ALLOWED_MIME.has(cvFile.type)) return { success: false, error: 'CV must be a PDF or Word document' }

  // Auth validated. Use admin client for writes (see student branch).
  const admin = createAdminClient()

  // Role guard — only a 'teacher' account may self-provision a teachers row.
  const { data: roleRow } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (roleRow?.role !== 'teacher') return { success: false, error: 'Not a teacher account' }

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

  // Insert-or-update — NEVER reset is_active / hourly_rate on a re-submission,
  // which would silently DEACTIVATE an already-approved teacher (and zero their
  // rate). is_active=false + hourly_rate=0 are insert-only application defaults.
  const application = {
    bio,
    specializations,
    certifications,
    cv_storage_path: storagePath,
    cv_uploaded_at: new Date().toISOString(),
    cv_original_filename: cvFile.name,
  }
  const { data: existingTeacher } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()

  const { error: teacherError } = existingTeacher
    ? await admin.from('teachers').update(application).eq('profile_id', userId)
    : await admin.from('teachers').insert({ profile_id: userId, ...application, hourly_rate: 0, is_active: false })

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
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@englishkolab.com'
  if (!apiKey || apiKey === 're_placeholder') return

  const firstName = params.teacherName.split(' ')[0] || ''

  const teacherSubject = params.lang === 'es'
    ? '¡Solicitud recibida! — EnglishKolab'
    : 'Application received — EnglishKolab'

  const teacherPendingUrl = `${APP_URL}/${params.lang === 'es' ? 'es' : 'en'}/maestro/pending`

  const teacherHtml = params.lang === 'es'
    ? `
      <h2>¡Hola ${escapeHtml(firstName)}!</h2>
      <p>Recibimos tu solicitud para enseñar en EnglishKolab. Gracias por unirte a nuestra comunidad.</p>
      <p>Nuestro equipo revisará tu perfil en las próximas 24–48 horas. Recibirás un correo en cuanto tu cuenta sea activada.</p>
      <p>Mientras tanto, puedes revisar tu solicitud aquí:<br/>
      <a href="${teacherPendingUrl}">Ver mi solicitud →</a></p>
      <p>— El equipo de EnglishKolab</p>
    `
    : `
      <h2>Hi ${escapeHtml(firstName)}!</h2>
      <p>We received your application to teach with EnglishKolab. Thanks for joining our community.</p>
      <p>Our team will review your profile in the next 24–48 hours. You'll receive an email once your account is activated.</p>
      <p>In the meantime, you can review your application here:<br/>
      <a href="${teacherPendingUrl}">View my application →</a></p>
      <p>— The EnglishKolab team</p>
    `

  const teacherText = params.lang === 'es'
    ? `¡Hola ${firstName}!

Recibimos tu solicitud para enseñar en EnglishKolab. Gracias por unirte a nuestra comunidad.

Nuestro equipo revisará tu perfil en las próximas 24–48 horas. Recibirás un correo en cuanto tu cuenta sea activada.

Mientras tanto, puedes revisar tu solicitud aquí:
${teacherPendingUrl}

— El equipo de EnglishKolab`
    : `Hi ${firstName}!

We received your application to teach with EnglishKolab. Thanks for joining our community.

Our team will review your profile in the next 24–48 hours. You'll receive an email once your account is activated.

In the meantime, you can review your application here:
${teacherPendingUrl}

— The EnglishKolab team`

  // Teacher confirmation
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: params.teacherEmail,
      subject: teacherSubject,
      html: teacherHtml,
      text: teacherText,
    }),
  }).catch(() => {})

  // Admin notification
  const adminReviewUrl = `${APP_URL}/${params.lang}/admin/teachers`
  const adminText = `A new teacher just applied. Review and approve in the admin panel.

Name: ${params.teacherName || '(not provided)'}
Email: ${params.teacherEmail}

Review applications: ${adminReviewUrl}`

  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: adminEmail,
      subject: `New teacher application — ${params.teacherName || params.teacherEmail}`,
      html: `
        <p>A new teacher just applied. Review and approve in the admin panel.</p>
        <table>
          <tr><td><strong>Name</strong></td><td>${escapeHtml(params.teacherName || '(not provided)')}</td></tr>
          <tr><td><strong>Email</strong></td><td>${escapeHtml(params.teacherEmail)}</td></tr>
        </table>
        <p><a href="${adminReviewUrl}">Review applications →</a></p>
      `,
      text: adminText,
    }),
  }).catch(() => {})
}
