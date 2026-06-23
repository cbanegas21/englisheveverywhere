'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cancelBookingReminders } from '@/lib/reminders'
import { activeBookingCutoffIso } from '@/lib/bookingWindow'
import { ROLE_COOKIE, NAME_COOKIE, SEEN_COOKIE } from '@/lib/authCookie'
import { isValidTimeZone } from '@/lib/timezone'
import { checkUserActionLimit } from '@/lib/rateLimit'

export interface NotificationPreferences {
  email?: boolean
  sms?: boolean
  whatsapp?: boolean
  before24h?: boolean
  before1h?: boolean
}

export async function updateStudentProfile(data: {
  fullName?: string
  timezone?: string
  phone?: string | null
  avatarUrl?: string | null
  preferredLanguage?: 'es' | 'en'
  preferredCurrency?: string
  notificationPreferences?: NotificationPreferences
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  // Per-user throttle (DASH-07) — caps scripted hammering of the profile mutation.
  // Generous ceiling so a real user adjusting settings never trips it.
  const rl = await checkUserActionLimit(user.id, 'updateStudentProfile', 30)
  if (!rl.ok) return { success: false, error: 'Too many attempts. Please wait a few minutes.' }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (data.fullName !== undefined) {
    // Sanitize the free-text display name: it's written via the RLS-bypassing
    // admin client and later interpolated into email HTML, so cap length and
    // reject markup to close a stored-XSS + unbounded-length gap.
    const name = (data.fullName || '').trim()
    if (name.length === 0) return { success: false, error: 'Name is required' }
    if (name.length > 120) return { success: false, error: 'Name is too long' }
    // Reject markup AND CR/LF (the latter is an email-subject header-injection surface).
    if (/[<>\r\n]/.test(name)) return { success: false, error: 'Name contains invalid characters' }
    patch.full_name = name
  }
  if (data.timezone !== undefined) {
    // Reject an invalid IANA zone — persisting it would throw a RangeError in a
    // later toLocale*/Intl call across the app (DASH-01).
    if (!isValidTimeZone(data.timezone)) return { success: false, error: 'Invalid timezone' }
    patch.timezone = data.timezone
  }
  if (data.phone !== undefined) {
    if (data.phone === null) patch.phone = null
    else {
      const phone = String(data.phone).trim()
      if (phone.length > 32 || /[<>]/.test(phone)) return { success: false, error: 'Invalid phone number' }
      patch.phone = phone
    }
  }
  if (data.avatarUrl !== undefined) {
    // Avatar is rendered as <img src>. Only accept null or a same-origin Supabase
    // Storage https URL — never a client-supplied javascript:/data:/arbitrary URL.
    if (data.avatarUrl === null) {
      patch.avatar_url = null
    } else {
      const url = String(data.avatarUrl)
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      if (url.length > 512 || !base || !url.startsWith(`${base}/storage/`)) {
        return { success: false, error: 'Invalid avatar URL' }
      }
      patch.avatar_url = url
    }
  }
  if (data.preferredLanguage !== undefined)    patch.preferred_language = data.preferredLanguage
  if (data.preferredCurrency !== undefined) {
    const code = data.preferredCurrency.toUpperCase()
    if (code.length === 3) patch.preferred_currency = code
  }
  if (data.notificationPreferences !== undefined) {
    patch.notification_preferences = data.notificationPreferences
  }

  // Auth validated. Admin client for writes (RLS-edge fix).
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateTeacherProfile(data: {
  fullName: string
  bio: string
  specializations: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()

  // Gate on an actual ACTIVE teacher row up front (TEACH-LOW-1). Without it a
  // non-teacher could call this and at least mutate their own profiles.full_name
  // (the teachers update below would silently no-op against zero rows). The
  // is_active check mirrors every other teacher write (saveAvailabilitySlots /
  // requireTeacher) so a deactivated/pending teacher — blocked from the PAGE by
  // the dashboard layout — can't mutate their profile via a direct action call.
  const { data: teacherRow } = await admin
    .from('teachers')
    .select('id, is_active')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!teacherRow) return { success: false, error: 'Not a teacher account' }
  if (!teacherRow.is_active) return { success: false, error: 'Teacher account is not active' }

  // Per-user throttle (mirrors updateStudentProfile) — caps scripted hammering of
  // this RLS-bypassing admin write. Action is allowlisted in auth_attempts (migr 047).
  const rl = await checkUserActionLimit(user.id, 'updateTeacherProfile', 30)
  if (!rl.ok) return { success: false, error: 'Too many attempts. Please wait a moment.' }

  // Validate/sanitize free text (written via the RLS-bypassing admin client and
  // later shown to admins/students + interpolated into emails). Mirrors the
  // student-side guards: cap length, reject markup, bound the arrays.
  const name = (data.fullName || '').trim()
  if (name.length === 0) return { success: false, error: 'Name is required' }
  if (name.length > 120) return { success: false, error: 'Name is too long' }
  if (/[<>]/.test(name)) return { success: false, error: 'Name contains invalid characters' }
  const bio = (data.bio || '').slice(0, 2000)

  const { error: profileError } = await admin
    .from('profiles')
    .update({ full_name: name, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  // Never reflect the raw Postgres/Supabase string to the browser — log it,
  // return one generic message (mirrors the rest of the codebase).
  if (profileError) { console.error('[updateTeacherProfile] profile update failed:', profileError.message); return { success: false, error: 'Could not save. Please try again.' } }

  const specs = data.specializations
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((s) => s.slice(0, 100))

  const { error: teacherError } = await admin
    .from('teachers')
    .update({ bio, specializations: specs })
    .eq('profile_id', user.id)

  if (teacherError) { console.error('[updateTeacherProfile] teacher update failed:', teacherError.message); return { success: false, error: 'Could not save. Please try again.' } }
  return { success: true }
}

/**
 * Trigger the Supabase email-change flow. Supabase sends a confirmation link
 * to the NEW address; the old email stays active until the user clicks through,
 * so a typo or a stolen session cannot silently reroute the account.
 */
export async function requestEmailChange(
  newEmail: string,
  lang: string = 'es',
): Promise<{ success: boolean; error?: string; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const clean = newEmail.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return {
      success: false,
      error: lang === 'es' ? 'Email inválido.' : 'Invalid email.',
    }
  }
  if (clean === user.email?.toLowerCase()) {
    return {
      success: false,
      error: lang === 'es'
        ? 'Ese ya es tu email actual.'
        : 'That is already your current email.',
    }
  }

  // Strict per-user throttle (DASH-07) — each REAL change attempt triggers a
  // Supabase confirmation email; cap to protect the quota. Checked AFTER the
  // format + same-email validation so three typos / no-op submissions (which never
  // send an email) don't lock a legit change out for 60 min (EMAIL-RL-BEFORE-VAL).
  const rl = await checkUserActionLimit(user.id, 'requestEmailChange', 3, 60)
  if (!rl.ok) {
    return { success: false, error: lang === 'es' ? 'Demasiados intentos. Espera un momento.' : 'Too many attempts. Please wait a moment.' }
  }

  // Uses the SSR client so the confirmation email is routed through the
  // normal Supabase Auth templates (not the admin client — admin updates
  // would skip the confirmation step).
  const { error } = await supabase.auth.updateUser({ email: clean })
  if (error) {
    // Never reflect the raw Supabase string (untranslated + email-existence
    // enumeration). Log server-side, return one generic localized message.
    console.error('requestEmailChange failed:', error.message)
    return {
      success: false,
      error: lang === 'es'
        ? 'No pudimos cambiar tu correo. Prueba con otro o inténtalo más tarde.'
        : "We couldn't change your email. Try a different one or try again later.",
    }
  }

  return {
    success: true,
    message: lang === 'es'
      ? `Te enviamos un enlace de confirmación a ${clean}. Haz clic para completar el cambio.`
      : `We sent a confirmation link to ${clean}. Click it to complete the change.`,
  }
}

/**
 * GDPR-grade soft delete. We do NOT hard-delete the auth user (payments /
 * bookings retain FKs to this row for accounting), but we lock the account:
 *
 *   1. Cancel every live future booking + refund class credits.
 *   2. Zero the student/teacher side-table flags (classes_remaining, is_active).
 *   3. Scrub PII on profiles and mark deleted_at.
 *   4. Rotate the auth.users email to a sentinel so the original can be
 *      reused, and randomize the password so the old credential stops working.
 *   5. Sign out the current session.
 *
 * The counterparty (teacher/student) will see "Deleted account" on historical
 * bookings — no PII leaks, history is preserved for audit.
 */
export async function deleteMyAccount(
  lang: string = 'es',
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()

  // 1. Determine role + side-table row. Student and teacher cleanups diverge
  //    because only students hold a `classes_remaining` ledger and only
  //    teachers have an is_active flag that blocks future assignments.
  const { data: student } = await admin
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  // 2. Cancel every live future booking on either side + refund credit to
  //    the student involved. We iterate so we can refund *per booking* rather
  //    than a flat sum — matches how studentCancelBooking already works.
  const nowIso = new Date().toISOString()
  let studentBookings: { id: string; student_id: string; type: string }[] = []
  let teacherBookings: { id: string; student_id: string; type: string }[] = []

  if (student) {
    const { data } = await admin
      .from('bookings')
      .select('id, student_id, type')
      .eq('student_id', student.id)
      .in('status', ['pending', 'confirmed'])
      // Include just-started / still-live classes (now−2.5h grace), not only
      // strictly-future ones. A class within the active window was excluded here
      // yet classes_remaining is zeroed below, so its paid credit silently
      // vanished and the booking was orphaned against a scrubbed account (SB-06).
      .gte('scheduled_at', activeBookingCutoffIso())
    studentBookings = (data as { id: string; student_id: string; type: string }[]) || []
  }
  if (teacher) {
    const { data } = await admin
      .from('bookings')
      .select('id, student_id, type')
      .eq('teacher_id', teacher.id)
      .in('status', ['pending', 'confirmed'])
      // Match the student side: refund/cancel live classes within the active
      // grace window too, not only strictly-future ones (SB-06).
      .gte('scheduled_at', activeBookingCutoffIso())
    teacherBookings = (data as { id: string; student_id: string; type: string }[]) || []
  }

  const toCancel = [...studentBookings, ...teacherBookings]
  for (const b of toCancel) {
    // Status-gated cancel + row-count guard (mirrors studentCancelBooking): the
    // credit refund fires ONLY when THIS call actually flipped a live booking.
    // Without it the unconditional UPDATE + unconditional increment_classes could
    // DOUBLE-MINT a credit if a concurrent studentCancelBooking (or a second
    // delete) cancelled the same booking in the race window (DEL-CONCURRENT-06).
    const { data: flipped } = await admin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_by: 'system',
        cancellation_reason: 'admin_refund',
        cancelled_at: nowIso,
      })
      .eq('id', b.id)
      .in('status', ['pending', 'confirmed'])
      .select('id')
    const didFlip = !!(flipped && flipped.length > 0)

    // Restore the student's credit — CLASS bookings only, and only on the call
    // that flipped the row. A placement_test is a free call: minting a credit on
    // it is wrong, and on the teacher-side path the student is a THIRD PARTY whose
    // account persists, so the mint would stick (PL-CREDIT-DELETE-01). Mirrors
    // every other cancel path's type + status guard.
    if (didFlip && b.type === 'class') {
      await admin.rpc('increment_classes', { p_student_id: b.student_id })
    }

    cancelBookingReminders(b.id).catch(() => {})
  }

  // 3. Side-table scrub. is_active=false keeps the teacher out of future
  //    assignment queries; classes_remaining=0 prevents any residual booking
  //    path from firing against a deleted account.
  if (teacher) {
    // Purge the CV (full résumé — PII) from storage too, then clear its pointers.
    // Best-effort: a storage hiccup must not block the account deletion (GDPR).
    const { data: tRow } = await admin
      .from('teachers')
      .select('cv_storage_path')
      .eq('id', teacher.id)
      .single()
    const cvPath = (tRow as { cv_storage_path?: string | null } | null)?.cv_storage_path
    if (cvPath) {
      try { await admin.storage.from('teacher-docs').remove([cvPath]) } catch { /* non-fatal */ }
    }
    await admin
      .from('teachers')
      .update({ is_active: false, cv_storage_path: null, cv_original_filename: null })
      .eq('id', teacher.id)
  }
  if (student) {
    await admin
      .from('students')
      .update({ classes_remaining: 0 })
      .eq('id', student.id)
  }

  // 4. Profile scrub + deletion marker. Full-name + phone + avatar_url are
  //    the only PII on profiles; wipe them. `deleted_at` gates future reads.
  await admin
    .from('profiles')
    .update({
      full_name: 'Deleted account',
      phone: null,
      avatar_url: null,
      deleted_at: nowIso,
    })
    .eq('id', user.id)

  // 5. Rotate auth.users so the original email can be reused for a fresh
  //    signup AND the old password stops working. We keep the row so FKs
  //    from payments / historical bookings don't break.
  const sentinelEmail = `deleted-${user.id}-${Date.now()}@deleted.local`
  const randomPassword = randomUUID() + randomUUID()
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
    email: sentinelEmail,
    password: randomPassword,
    email_confirm: true,
    user_metadata: { deleted: true },
  })
  if (authErr) {
    // Log but don't fail — the profile scrub + bookings cancel already went
    // through, so the account is effectively non-functional. Manual cleanup
    // in Supabase dashboard if this ever hits.
    console.error('[deleteMyAccount] auth rotate failed:', authErr.message)
  }

  // 6. Drop the session. scope:'global' revokes ALL of the user's refresh tokens
  //    across every device (P2-1) — not just this request's cookie — so a session
  //    live on another phone/tab can't keep acting on the now-deleted account.
  //    The layout guards' deleted_at check (added alongside this) is the durable
  //    backstop for any path the revoke misses (incl. a Google re-login).
  try {
    await supabase.auth.signOut({ scope: 'global' })
    const cookieStore = await cookies()
    cookieStore.delete(ROLE_COOKIE)
    cookieStore.delete(NAME_COOKIE)
    cookieStore.delete(SEEN_COOKIE)
  } catch {
    // ignore
  }

  void lang
  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * Persist only the preferred currency. Called from useCurrency's onPersist hook
 * so the background sync doesn't interfere with anything else on the page.
 */
export async function savePreferredCurrency(code: string): Promise<{ success: boolean; error?: string }> {
  const clean = (code || '').toUpperCase().trim()
  if (clean.length !== 3) return { success: false, error: 'Invalid currency code' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ preferred_currency: clean, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Profile picture (avatar) upload ──────────────────────────────────────────
// Stored in the public `avatars` bucket at `{user.id}/{uuid}.{ext}`. The bucket
// is created lazily on first upload (idempotent). Uploaded via the admin client
// after a server-side magic-byte check, so a spoofed Content-Type can't smuggle
// a non-image through. The resulting public URL passes updateStudentProfile's
// same-origin `/storage/` allow-check.
const AVATAR_BUCKET = 'avatars'
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

function detectImage(buf: Buffer): { contentType: string; ext: string } | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { contentType: 'image/png', ext: 'png' }
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: 'image/jpeg', ext: 'jpg' }
  }
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { contentType: 'image/gif', ext: 'gif' }
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', ext: 'webp' }
  }
  return null
}

async function ensureAvatarBucket(admin: ReturnType<typeof createAdminClient>) {
  try {
    const { data } = await admin.storage.getBucket(AVATAR_BUCKET)
    if (!data) {
      await admin.storage.createBucket(AVATAR_BUCKET, {
        public: true,
        fileSizeLimit: AVATAR_MAX_BYTES,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      })
    }
  } catch {
    // Best-effort: a race or an already-exists error is harmless — the upload
    // below will succeed, or surface its own error.
  }
}

async function purgeAvatars(admin: ReturnType<typeof createAdminClient>, userId: string) {
  try {
    const { data: existing } = await admin.storage.from(AVATAR_BUCKET).list(userId)
    if (existing && existing.length) {
      await admin.storage.from(AVATAR_BUCKET).remove(existing.map((o) => `${userId}/${o.name}`))
    }
  } catch {
    // non-fatal
  }
}

export async function uploadStudentAvatar(
  formData: FormData,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Reuse the existing allowlisted rate-limit action (avoids a migration; the
  // auth_attempts.action CHECK constraint would silently drop an unknown action).
  const rl = await checkUserActionLimit(user.id, 'updateStudentProfile', 30)
  if (!rl.ok) return { success: false, error: 'Too many attempts. Please wait a few minutes.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { success: false, error: 'No file provided' }
  if (file.size > AVATAR_MAX_BYTES) return { success: false, error: 'Image is too large (max 2 MB).' }

  const buffer = Buffer.from(await file.arrayBuffer())
  const kind = detectImage(buffer)
  if (!kind) return { success: false, error: 'Unsupported image — use PNG, JPG, GIF or WEBP.' }

  const admin = createAdminClient()
  await ensureAvatarBucket(admin)
  // Drop any previous avatar(s) so old files don't accumulate.
  await purgeAvatars(admin, user.id)

  const path = `${user.id}/${randomUUID()}.${kind.ext}`
  const { error: upErr } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { contentType: kind.contentType, upsert: false })
  if (upErr) return { success: false, error: upErr.message }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const url = `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`

  const { error: updErr } = await admin
    .from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (updErr) return { success: false, error: updErr.message }

  revalidatePath('/', 'layout')
  return { success: true, url }
}

export async function removeStudentAvatar(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  await purgeAvatars(admin, user.id)
  const { error } = await admin
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
