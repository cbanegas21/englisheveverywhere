'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { escapeHtml, brandedEmail, EMAIL_FROM, APP_URL } from '@/lib/email'
import { isValidTimeZone } from '@/lib/timezone'
import { checkUserActionLimit } from '@/lib/rateLimit'

// Localized, user-safe onboarding errors (ONBOARD-06). Raw Supabase/storage
// error strings are logged server-side and never reflected to the user; the
// user sees a generic localized message instead.
const ONB_MSG = {
  notAuth: { es: 'No autenticado.', en: 'Not authenticated.' },
  notStudent: { es: 'Esta cuenta no es de estudiante.', en: 'This is not a student account.' },
  notTeacher: { es: 'Esta cuenta no es de maestro.', en: 'This is not a teacher account.' },
  invalidTz: { es: 'Zona horaria inválida.', en: 'Invalid timezone.' },
  invalidLists: { es: 'Especializaciones o certificaciones inválidas.', en: 'Invalid specializations or certifications.' },
  bioShort: { es: 'La biografía debe tener al menos 20 caracteres.', en: 'Bio must be at least 20 characters.' },
  cvRequired: { es: 'El CV / currículum es obligatorio.', en: 'CV / resume is required.' },
  cvTooLarge: { es: 'El CV supera el límite de 10 MB.', en: 'CV exceeds the 10 MB limit.' },
  cvType: { es: 'El CV debe ser un PDF o un documento de Word.', en: 'CV must be a PDF or Word document.' },
  uploadFailed: { es: 'No se pudo subir el CV. Inténtalo de nuevo.', en: 'Could not upload your CV. Please try again.' },
  saveFailed: { es: 'No se pudo completar el registro. Inténtalo de nuevo.', en: 'Could not complete onboarding. Please try again.' },
} as const
const onb = (k: keyof typeof ONB_MSG, lang: string) => ONB_MSG[k][lang === 'en' ? 'en' : 'es']

export async function completeStudentOnboarding(data: {
  userId: string
  timezone: string
  preferredLanguage: 'es' | 'en'
}): Promise<{ success: boolean; error?: string }> {
  const lang = data.preferredLanguage
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== data.userId) return { success: false, error: onb('notAuth', lang) }

  // Auth was validated above. Switch to admin client for the writes —
  // bypasses an RLS edge case where the new user's JWT isn't yet bound
  // at insert-time ("permission denied for table students/teachers").
  const admin = createAdminClient()

  // Role guard — only a 'student' account may self-provision a students row.
  // Without this, a teacher (or any authed user) could create a students record.
  const { data: roleRow } = await admin.from('profiles').select('role').eq('id', data.userId).single()
  if (roleRow?.role !== 'student') return { success: false, error: onb('notStudent', lang) }

  // Reject an invalid IANA zone — persisting it would throw a RangeError in a
  // later toLocale / Intl call across the app (DASH-01).
  if (!isValidTimeZone(data.timezone)) return { success: false, error: onb('invalidTz', lang) }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ timezone: data.timezone, preferred_language: data.preferredLanguage })
    .eq('id', data.userId)

  if (profileError) {
    console.error('completeStudentOnboarding profile update failed:', profileError.message)
    return { success: false, error: onb('saveFailed', lang) }
  }

  const { error: studentError } = await admin
    .from('students')
    .upsert({
      profile_id: data.userId,
    }, { onConflict: 'profile_id' })

  if (studentError) {
    console.error('completeStudentOnboarding student upsert failed:', studentError.message)
    return { success: false, error: onb('saveFailed', lang) }
  }

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

// Magic-byte sniff so a renamed/spoofed file can't slip past the client-supplied
// MIME check (ONBOARD-04). Accept the three formats CV_ALLOWED_MIME permits:
//   PDF  → '%PDF-' (scanned in the first 1KB to tolerate a leading BOM/whitespace)
//   DOCX → ZIP container 'PK\x03\x04'
//   DOC  → OLE2 compound file (first 4 bytes of the D0 CF 11 E0 A1 B1 1A E1 sig)
function hasAllowedDocMagic(buf: Buffer): boolean {
  if (buf.subarray(0, 1024).indexOf(Buffer.from('%PDF-')) !== -1) return true
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return true
  if (buf.length >= 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return true
  return false
}

export async function completeTeacherOnboarding(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = (formData.get('userId') as string | null) || ''
  // Parse the locale before the auth check so even the earliest error localizes.
  const preferredLanguage = ((formData.get('preferredLanguage') as string | null) || 'es') as 'es' | 'en'
  if (!user || user.id !== userId) return { success: false, error: onb('notAuth', preferredLanguage) }

  // Throttle — onboarding is a once-ish action; this caps repeated calls that each
  // re-upload a fresh CV to storage (cost/orphaned-file abuse).
  const rl = await checkUserActionLimit(user.id, 'teacherOnboarding', 5, 60)
  if (!rl.ok) {
    return { success: false, error: preferredLanguage === 'es' ? 'Demasiados intentos. Espera unos minutos.' : 'Too many attempts. Please wait a few minutes.' }
  }

  const timezone = (formData.get('timezone') as string | null) || ''
  // Cap the bio (deep-audit INJ-1): onboarding only enforced a MINIMUM, so a
  // ~1MB bio could be stored whole and shipped in the admin list + student
  // profile. Match the 2000-char ceiling updateTeacherProfile applies.
  // typeof guard (INJ-4): a File posted as 'bio' is a Blob (has .slice but no
  // .trim), so the later bio.trim() would throw; coerce non-strings to ''.
  const bioRaw = formData.get('bio')
  const bio = (typeof bioRaw === 'string' ? bioRaw : '').slice(0, 2000)
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
    return { success: false, error: onb('invalidLists', preferredLanguage) }
  }
  const cvFile = formData.get('cv') as File | null

  if (!isValidTimeZone(timezone)) return { success: false, error: onb('invalidTz', preferredLanguage) }
  if (bio.trim().length < 20) return { success: false, error: onb('bioShort', preferredLanguage) }
  if (!cvFile || cvFile.size === 0) return { success: false, error: onb('cvRequired', preferredLanguage) }
  if (cvFile.size > CV_MAX_BYTES) return { success: false, error: onb('cvTooLarge', preferredLanguage) }
  if (!CV_ALLOWED_MIME.has(cvFile.type)) return { success: false, error: onb('cvType', preferredLanguage) }

  // Auth validated. Use admin client for writes (see student branch).
  const admin = createAdminClient()

  // Role guard — only a 'teacher' account may self-provision a teachers row.
  const { data: roleRow } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (roleRow?.role !== 'teacher') return { success: false, error: onb('notTeacher', preferredLanguage) }

  const ext = cvFile.name.toLowerCase().match(/\.(pdf|docx?|doc)$/)?.[0] || '.pdf'
  const storagePath = `${userId}/${Date.now()}${ext}`
  const buffer = Buffer.from(await cvFile.arrayBuffer())
  // Verify the bytes match an allowed format — the MIME check above trusts the
  // client-supplied type, which a renamed file can fake (ONBOARD-04).
  if (!hasAllowedDocMagic(buffer)) return { success: false, error: onb('cvType', preferredLanguage) }
  const { error: uploadErr } = await admin.storage
    .from(CV_BUCKET)
    .upload(storagePath, buffer, {
      contentType: cvFile.type,
      upsert: true,
    })
  if (uploadErr) {
    console.error('completeTeacherOnboarding CV upload failed:', uploadErr.message)
    return { success: false, error: onb('uploadFailed', preferredLanguage) }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ timezone, preferred_language: preferredLanguage })
    .eq('id', userId)

  if (profileError) {
    console.error('completeTeacherOnboarding profile update failed:', profileError.message)
    return { success: false, error: onb('saveFailed', preferredLanguage) }
  }

  // Insert-or-update — NEVER reset is_active / hourly_rate on a re-submission,
  // which would silently DEACTIVATE an already-approved teacher (and zero their
  // rate). is_active=false + hourly_rate=0 are insert-only application defaults.
  const application = {
    bio,
    specializations,
    certifications,
    cv_storage_path: storagePath,
    cv_uploaded_at: new Date().toISOString(),
    // Sanitize the client-supplied filename: strip control chars + cap length.
    cv_original_filename: (cvFile.name || '').replace(/[\x00-\x1F]/g, '').trim().slice(0, 200),
  }
  const { data: existingTeacher } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()

  const { error: teacherError } = existingTeacher
    ? await admin.from('teachers').update(application).eq('profile_id', userId)
    : await admin.from('teachers').insert({ profile_id: userId, ...application, hourly_rate: 0, is_active: false })

  if (teacherError) {
    console.error('completeTeacherOnboarding teacher upsert failed:', teacherError.message)
    return { success: false, error: onb('saveFailed', preferredLanguage) }
  }

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

  const teacherHtml = brandedEmail({
    heading: params.lang === 'es' ? `¡Hola ${escapeHtml(firstName)}!` : `Hi ${escapeHtml(firstName)}!`,
    bodyHtml: params.lang === 'es'
      ? '<p style="margin:0 0 12px;">Recibimos tu solicitud para enseñar en EnglishKolab. Gracias por unirte a nuestra comunidad.</p><p style="margin:0;">Nuestro equipo revisará tu perfil en las próximas 24–48 horas. Recibirás un correo en cuanto tu cuenta sea activada.</p>'
      : "<p style=\"margin:0 0 12px;\">We received your application to teach with EnglishKolab. Thanks for joining our community.</p><p style=\"margin:0;\">Our team will review your profile in the next 24–48 hours. You'll receive an email once your account is activated.</p>",
    ctaLabel: params.lang === 'es' ? 'Ver mi solicitud' : 'View my application',
    ctaUrl: teacherPendingUrl,
    lang: params.lang,
  })

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

  // Admin notification (owner is Spanish-first, regardless of applicant language)
  const adminReviewUrl = `${APP_URL}/es/admin/teachers`
  const adminText = `Un maestro envió su solicitud. Revísala y apruébala en el panel.

Nombre: ${params.teacherName || '(no proporcionado)'}
Correo: ${params.teacherEmail}

Revisar solicitudes: ${adminReviewUrl}`

  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: adminEmail,
      subject: `Nueva solicitud de maestro — ${params.teacherName || params.teacherEmail}`,
      html: brandedEmail({
        heading: 'Nueva solicitud de maestro',
        bodyHtml: `
          <p style="margin:0 0 16px;">Un maestro envió su solicitud. Revísala y apruébala en el panel.</p>
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Nombre</td><td style="padding:4px 0;color:#111111;font-weight:600;">${escapeHtml(params.teacherName || '(no proporcionado)')}</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">Correo</td><td style="padding:4px 0;color:#111111;font-weight:600;">${escapeHtml(params.teacherEmail)}</td></tr>
          </table>`,
        ctaLabel: 'Revisar solicitudes',
        ctaUrl: adminReviewUrl,
        lang: 'es',
      }),
      text: adminText,
    }),
  }).catch(() => {})
}
