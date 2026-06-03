'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { checkAuthRateLimit } from '@/lib/rateLimit'
import { ROLE_COOKIE } from '@/lib/authCookie'

// Proxy-level role guard fast-path. httpOnly = server-only (readable from proxy).
// Layout guards remain the source of truth — cookie staleness never grants access.
const ROLE_COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Map raw Supabase signup errors to friendly, localized copy.
function friendlySignupError(raw: string, lang: string): string {
  const m = raw.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already')) {
    return lang === 'es'
      ? 'Ese correo ya tiene una cuenta. Intenta iniciar sesión.'
      : 'That email already has an account. Try logging in.'
  }
  return raw
}

// Fire a welcome email after a successful instant-login signup. No confirmation
// link (autoconfirm is on) — purely a greeting. Never throws to the caller.
async function sendWelcomeEmail(email: string, fullName: string, lang: string) {
  const key = process.env.RESEND_API_KEY
  if (!key || key === 're_placeholder') return
  const resend = new Resend(key)
  const from = process.env.EMAIL_FROM || 'noreply@englishkolab.com'
  const firstName = (fullName || '').trim().split(' ')[0]
  const greeting = firstName
    ? `${lang === 'es' ? 'Hola' : 'Hi'} ${firstName}`
    : lang === 'es' ? 'Hola' : 'Hi'
  const subject = lang === 'es' ? '¡Bienvenido a EnglishKolab!' : 'Welcome to EnglishKolab!'
  const body = lang === 'es'
    ? `<h2>${greeting} 👋</h2><p>Tu cuenta de EnglishKolab está lista. Ya puedes iniciar sesión y empezar a aprender inglés a tu ritmo.</p><p><a href="${APP_URL}/${lang}/dashboard">Ir a mi panel</a></p>`
    : `<h2>${greeting} 👋</h2><p>Your EnglishKolab account is ready. Log in any time and start learning English at your own pace.</p><p><a href="${APP_URL}/${lang}/dashboard">Go to my dashboard</a></p>`
  await resend.emails.send({ from, to: email, subject, html: body })
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = (formData.get('confirm_password') as string) || ''
  const firstName = ((formData.get('first_name') as string) || '').trim()
  const lastName = ((formData.get('last_name') as string) || '').trim()
  const phone = ((formData.get('phone') as string) || '').trim()
  // Compose the stored display name; fall back to a legacy full_name field.
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || ((formData.get('full_name') as string) || '')
  const role = formData.get('role') as 'student' | 'teacher'
  const lang = (formData.get('lang') as string) || 'es'
  const timezone = (formData.get('timezone') as string) || 'America/Bogota'

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
  // proxy fast-path, fire a welcome email (awaited so the redirect can't drop it,
  // but it never blocks the user), then head into onboarding.
  if (data.session) {
    if (role === 'student' || role === 'teacher') {
      const cookieStore = await cookies()
      cookieStore.set(ROLE_COOKIE, role, ROLE_COOKIE_OPTS)
    }
    // Best-effort: persist phone onto the profile row the DB trigger just created.
    if (phone && data.user?.id) {
      const { error: phoneErr } = await supabase.from('profiles').update({ phone }).eq('id', data.user.id)
      if (phoneErr) console.error('[signUp] could not save phone (non-blocking):', phoneErr.message)
    }
    await sendWelcomeEmail(email, fullName, lang).catch((err) =>
      console.error('[signUp] welcome email failed (non-blocking):', err)
    )
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

  if (error) {
    redirect(`/${lang}/login?error=${encodeURIComponent(error.message)}`)
  }

  // Read role from profiles table — single source of truth.
  // user_metadata.role can drift if an admin promotes a user via direct DB update.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id || '')
    .maybeSingle()
  const role = profile?.role || user?.user_metadata?.role

  const cookieStore = await cookies()
  if (role === 'teacher' || role === 'admin' || role === 'student') {
    cookieStore.set(ROLE_COOKIE, role, ROLE_COOKIE_OPTS)
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
