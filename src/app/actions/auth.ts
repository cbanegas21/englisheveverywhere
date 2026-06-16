'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { checkAuthRateLimit, recordLoginOutcome } from '@/lib/rateLimit'
import { ROLE_COOKIE } from '@/lib/authCookie'
import { APP_URL } from '@/lib/email'
import { sendWelcomeEmail } from '@/lib/welcomeEmail'
import { safeNextPath, pathAllowedForRole } from '@/lib/safeNext'
import { isValidTimeZone } from '@/lib/timezone'

// Verify a Cloudflare Turnstile token server-side. Returns true only on a
// confirmed human; any network/parse failure or empty token returns false
// (fail-closed). Not exported — internal helper, so this stays a server module.
async function verifyTurnstile(token: string, secret: string): Promise<boolean> {
  if (!token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

// Proxy-level role guard fast-path. httpOnly = server-only (readable from proxy).
// Layout guards remain the source of truth — cookie staleness never grants access.
const ROLE_COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
}

// Map raw Supabase signup errors to friendly, localized copy. The DEFAULT is
// generic — like signin, we never reflect the raw provider string into the
// URL/UI (info leak + untranslated copy). See Auth-MEDIUM-signin-errors.
function friendlySignupError(raw: string, lang: string): string {
  const m = (raw || '').toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already')) {
    return lang === 'es'
      ? 'Ese correo ya tiene una cuenta. Intenta iniciar sesión.'
      : 'That email already has an account. Try logging in.'
  }
  return lang === 'es'
    ? 'No pudimos crear tu cuenta. Intenta de nuevo.'
    : 'We could not create your account. Please try again.'
}

// Map raw Supabase sign-in errors to a fixed set of localized messages. Unlike
// signup, the DEFAULT is generic — we never reflect the raw provider string back
// into the URL/UI (info leak + untranslated copy). See Auth-MEDIUM-signin-errors.
function friendlySigninError(raw: string, lang: string): string {
  const m = (raw || '').toLowerCase()
  const isEs = lang === 'es'
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return isEs ? 'Correo o contraseña incorrectos.' : 'Incorrect email or password.'
  }
  if (m.includes('email not confirmed') || m.includes('not confirmed')) {
    return isEs ? 'Confirma tu correo antes de iniciar sesión.' : 'Please confirm your email before signing in.'
  }
  return isEs
    ? 'No pudimos iniciar sesión. Verifica tus datos e intenta de nuevo.'
    : "We couldn't sign you in. Check your details and try again."
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = (formData.get('confirm_password') as string) || ''
  // Sanitize names at the SOURCE — first/last are persisted to user_metadata +
  // profiles, shown to admins, and interpolated into emails. Strip CR/LF
  // (header-injection) and angle brackets (markup/XSS), collapse whitespace, and
  // cap length (mirrors updateStudentProfile). Defense-in-depth for every
  // downstream consumer (the composed full_name AND the raw first/last fields).
  const sanitizeName = (s: string) => s.replace(/[\r\n<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  const firstName = sanitizeName((formData.get('first_name') as string) || '')
  const lastName = sanitizeName((formData.get('last_name') as string) || '')
  const phone = ((formData.get('phone') as string) || '').trim()
  // Compose the stored display name; fall back to a legacy full_name field.
  const fullName = ([firstName, lastName].filter(Boolean).join(' ') || ((formData.get('full_name') as string) || ''))
    .replace(/[\r\n<>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  // SECURITY: never trust the client-supplied role. Coerce to the only two
  // self-service roles — anything else (notably 'admin') falls back to 'student'.
  // This is the app-layer half of the signup privilege-escalation fix; hardening
  // the handle_new_user DB trigger is the defense-in-depth follow-up.
  const role: 'student' | 'teacher' = formData.get('role') === 'teacher' ? 'teacher' : 'student'
  const lang = (formData.get('lang') as string) || 'es'
  // Validate the client-detected zone before it ever reaches the profile — an
  // invalid string would later throw a RangeError in a toLocale*/Intl call.
  const rawTimezone = (formData.get('timezone') as string) || ''
  const timezone = isValidTimeZone(rawTimezone) ? rawTimezone : 'America/Bogota'

  // Per-IP rate limit — 5 signup attempts per 15 min. Supabase has project-
  // wide limits but doesn't stop an IP-bound bot; this does.
  const limit = await checkAuthRateLimit('signup', email)
  if (!limit.ok) {
    const msg = lang === 'es'
      ? 'Demasiados intentos. Intenta de nuevo en unos minutos.'
      : 'Too many attempts. Try again in a few minutes.'
    redirect(`/${lang}/registro?error=${encodeURIComponent(msg)}&role=${role}`)
  }

  // Minimum password policy. Supabase enforces nothing by default — this
  // guard keeps 1-character passwords from landing in auth.users.
  if (!password || password.length < 8) {
    const msg = lang === 'es'
      ? 'La contraseña debe tener al menos 8 caracteres.'
      : 'Password must be at least 8 characters.'
    redirect(`/${lang}/registro?error=${encodeURIComponent(msg)}&role=${role}`)
  }

  // Defense-in-depth: the client checks too, but never trust it.
  if (confirmPassword && password !== confirmPassword) {
    const msg = lang === 'es' ? 'Las contraseñas no coinciden.' : 'Passwords do not match.'
    redirect(`/${lang}/registro?error=${encodeURIComponent(msg)}&role=${role}`)
  }

  if (!phone || !isValidPhoneNumber(phone)) {
    const msg = lang === 'es' ? 'Ingresa un número de teléfono válido.' : 'Please enter a valid phone number.'
    redirect(`/${lang}/registro?error=${encodeURIComponent(msg)}&role=${role}`)
  }

  // CAPTCHA (Cloudflare Turnstile) — block bot signups. Fail-CLOSED when a secret
  // is configured (a request with no/invalid token is rejected); a no-op when the
  // secret is unset so local/dev signups still work without keys.
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
  if (turnstileSecret && !turnstileSecret.endsWith('_placeholder')) {
    const captchaToken = (formData.get('captchaToken') as string) || ''
    const passed = await verifyTurnstile(captchaToken, turnstileSecret)
    if (!passed) {
      const msg = lang === 'es'
        ? 'No pudimos verificar que no eres un robot. Recarga la página e intenta de nuevo.'
        : "We couldn't verify you're human. Reload the page and try again."
      redirect(`/${lang}/registro?error=${encodeURIComponent(msg)}&role=${role}`)
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        phone,
        role,
        preferred_language: lang,
        timezone,
      },
      emailRedirectTo: `${APP_URL}/${lang}/auth/callback`,
    },
  })

  if (error) {
    console.log('[signUp] error:', error.message)
    redirect(`/${lang}/registro?error=${encodeURIComponent(friendlySignupError(error.message, lang))}&role=${role}`)
  }

  // Instant-login: email confirmation is OFF (mailer_autoconfirm), so signUp
  // returns a session and the user is already logged in. Persist the role for the
  // proxy fast-path, fire a welcome email (students only), then head to onboarding.
  if (data.session) {
    if (role === 'student' || role === 'teacher') {
      const cookieStore = await cookies()
      cookieStore.set(ROLE_COOKIE, role, ROLE_COOKIE_OPTS)
    }
    // Best-effort: persist phone + the detected timezone + chosen language onto
    // the profile row the DB trigger just created. The trigger doesn't coalesce
    // these from user metadata, so without this every account would default to
    // America/Bogota and English signups would get Spanish emails (AUTH-02/03).
    if (data.user?.id) {
      const profilePatch: { phone?: string; timezone: string; preferred_language: string } = {
        timezone,
        preferred_language: lang,
      }
      if (phone) profilePatch.phone = phone
      const { error: patchErr } = await supabase.from('profiles').update(profilePatch).eq('id', data.user.id)
      if (patchErr) console.error('[signUp] could not save profile fields (non-blocking):', patchErr.message)
    }
    // Welcome email is student-oriented ("book your first class"). Teachers get
    // their "application received" email after onboarding, so don't greet them
    // with the student copy here.
    if (role === 'student') {
      await sendWelcomeEmail(email, fullName, lang).catch((err) =>
        console.error('[signUp] welcome email failed (non-blocking):', err)
      )
    }
    redirect(`/${lang}/onboarding`)
  }

  // Fallback only reached if a confirmation gate is ever re-enabled in Supabase
  // (mailer_autoconfirm OFF) — Supabase then sends its own confirm mail and we
  // just show the "check your inbox" screen. We deliberately do NOT re-provision
  // the user via admin.generateLink({ type: 'signup', password }): that can
  // silently rewrite the password and cause "Invalid login credentials" (RC8).
  redirect(`/${lang}/registro?success=confirm`)
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const lang = (formData.get('lang') as string) || 'es'
  // Optional post-login destination (e.g. a /sala room join link, CALL-13).
  // Validated to a same-origin locale path to prevent open redirects.
  const next = safeNextPath(formData.get('next') as string | null)

  // Per-IP rate limit — 10 login attempts per 15 min. Protects against
  // credential-stuffing; a real user fat-fingering never hits 10.
  const limit = await checkAuthRateLimit('login', email)
  if (!limit.ok) {
    const msg = lang === 'es'
      ? 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.'
      : 'Too many login attempts. Try again in a few minutes.'
    redirect(`/${lang}/login?error=${encodeURIComponent(msg)}`)
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  // Record the attempt outcome for the limiter (per-IP cap + per-email failed-
  // login lockout). Awaited before any redirect so the row is written; failures
  // inside are swallowed and never block the user.
  await recordLoginOutcome(email, !error)

  if (error) {
    redirect(`/${lang}/login?error=${encodeURIComponent(friendlySigninError(error.message, lang))}`)
  }

  // Read role from profiles table — single source of truth.
  // user_metadata.role can drift if an admin promotes a user via direct DB update.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, deleted_at')
    .eq('id', user?.id || '')
    .maybeSingle()

  // Soft-deleted accounts (deleteMyAccount) must never sign in. This is the
  // DURABLE second line of defense: previously the only login block was the auth
  // email/password rotate, so if that single API call ever failed the account was
  // left PII-scrubbed but fully log-in-able (DEL-ROTATE-FAIL). deleted_at is set
  // atomically with the scrub and is the authoritative marker.
  if (profile?.deleted_at) {
    await supabase.auth.signOut()
    redirect(`/${lang}/login?error=${encodeURIComponent(lang === 'es' ? 'Esta cuenta ya no está disponible.' : 'This account is no longer available.')}`)
  }

  const role = profile?.role || user?.user_metadata?.role

  const cookieStore = await cookies()
  if (role === 'teacher' || role === 'admin' || role === 'student') {
    cookieStore.set(ROLE_COOKIE, role, ROLE_COOKIE_OPTS)
  }

  // A validated join link wins over the default role landing page — but only
  // when it targets the user's OWN area (or the shared /sala room). A next= to
  // another role's area is dropped here and the role default below takes over
  // (Auth-LOW-next-path).
  if (next && pathAllowedForRole(next, role)) {
    redirect(next)
  }
  if (role === 'teacher') {
    redirect(`/${lang}/maestro/dashboard`)
  }
  if (role === 'admin') {
    redirect(`/${lang}/admin`)
  }
  redirect(`/${lang}/dashboard`)
}

export async function signOut(lang: string = 'es') {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete(ROLE_COOKIE)
  redirect(`/${lang}/login`)
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const lang = (formData.get('lang') as string) || 'es'

  // Throttle reset requests per IP (inbox-spam / email-quota-drain guard). Still
  // redirect to the generic success screen on limit to preserve enumeration safety.
  const limit = await checkAuthRateLimit('reset', email)
  if (!limit.ok) {
    redirect(`/${lang}/login?success=reset`)
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/${lang}/login/new-password`,
  })

  // Never leak whether the email exists or whether the send succeeded.
  // Always show a generic "check your inbox" — protects against enumeration
  // and avoids surfacing transient Supabase rate-limit errors to the user.
  if (error) {
    console.error('[auth] resetPasswordForEmail:', error.message)
  }

  redirect(`/${lang}/login?success=reset`)
}
