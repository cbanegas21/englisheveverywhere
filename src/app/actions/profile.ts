'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cancelBookingReminders } from '@/lib/reminders'
import { ROLE_COOKIE } from '@/lib/authCookie'
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
    if (/[<>]/.test(name)) return { success: false, error: 'Name contains invalid characters' }
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
  if (data.avatarUrl !== undefined)            patch.avatar_url = data.avatarUrl
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

  // Gate on an actual teacher row up front (TEACH-LOW-1). Without it a non-teacher
  // could call this and at least mutate their own profiles.full_name (the teachers
  // update below would silently no-op against zero rows).
  const { data: teacherRow } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!teacherRow) return { success: false, error: 'Not a teacher account' }

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

  if (profileError) return { success: false, error: profileError.message }

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

  if (teacherError) return { success: false, error: teacherError.message }
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

  // Strict per-user throttle (DASH-07) — each call triggers a Supabase
  // confirmation email; cap to protect the email quota from abuse.
  const rl = await checkUserActionLimit(user.id, 'requestEmailChange', 3, 60)
  if (!rl.ok) {
    return { success: false, error: lang === 'es' ? 'Demasiados intentos. Espera un momento.' : 'Too many attempts. Please wait a moment.' }
  }

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

  // Uses the SSR client so the confirmation email is routed through the
  // normal Supabase Auth templates (not the admin client — admin updates
  // would skip the confirmation step).
  const { error } = await supabase.auth.updateUser({ email: clean })
  if (error) return { success: false, error: error.message }

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
  let studentBookings: { id: string; student_id: string }[] = []
  let teacherBookings: { id: string; student_id: string }[] = []

  if (student) {
    const { data } = await admin
      .from('bookings')
      .select('id, student_id')
      .eq('student_id', student.id)
      .in('status', ['pending', 'confirmed'])
      .gte('scheduled_at', nowIso)
    studentBookings = (data as { id: string; student_id: string }[]) || []
  }
  if (teacher) {
    const { data } = await admin
      .from('bookings')
      .select('id, student_id')
      .eq('teacher_id', teacher.id)
      .in('status', ['pending', 'confirmed'])
      .gte('scheduled_at', nowIso)
    teacherBookings = (data as { id: string; student_id: string }[]) || []
  }

  const toCancel = [...studentBookings, ...teacherBookings]
  for (const b of toCancel) {
    await admin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_by: 'system',
        cancellation_reason: 'admin_refund',
        cancelled_at: nowIso,
      })
      .eq('id', b.id)

    // Restore the student's credit. On teacher-side cancellations the
    // student is a third party — they still get their class back.
    await admin.rpc('increment_classes', { p_student_id: b.student_id })

    cancelBookingReminders(b.id).catch(() => {})
  }

  // 3. Side-table scrub. is_active=false keeps the teacher out of future
  //    assignment queries; classes_remaining=0 prevents any residual booking
  //    path from firing against a deleted account.
  if (teacher) {
    await admin
      .from('teachers')
      .update({ is_active: false })
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

  // 6. Drop the session on the current request so the response comes back
  //    logged out. Using noop on error so a missing cookie store doesn't
  //    break the delete after it already committed.
  try {
    await supabase.auth.signOut()
    const cookieStore = await cookies()
    cookieStore.delete(ROLE_COOKIE)
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
