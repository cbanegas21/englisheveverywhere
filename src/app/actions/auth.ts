'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { checkAuthRateLimit } from '@/lib/rateLimit'

// Proxy-level role guard fast-path. httpOnly = server-only (readable from proxy).
// Layout guards remain the source of truth — cookie staleness never grants access.
const ROLE_COOKIE = 'ee-role'
const ROLE_COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
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
    redirect(`/${lang}/registro?error=${encodeURIComponent(msg)}`)
  }

  // Minimum password policy. Supabase enforces nothing by default — this
  // guard keeps 1-character passwords from landing in auth.users.
  if (!password || password.length < 8) {
    const msg = lang === 'es'
      ? 'La contraseña debe tener al menos 8 caracteres.'
      : 'Password must be at least 8 characters.'
    redirect(`/${lang}/registro?error=${encodeURIComponent(msg)}`)
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
        preferred_language: lang,
        timezone,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${lang}/auth/callback`,
    },
  })

  if (error) {
    console.log('[signUp] error:', error.message)
    const msg = error.message.toLowerCase()
    const isEmailIssue = msg.includes('email') || msg.includes('smtp') || msg.includes('sending') || msg.includes('rate limit')
    if (isEmailIssue) {
      const emailError = lang === 'es'
        ? 'No pudimos enviar el email de confirmación. Contacta a soporte: hola@englishkolab.com'
        : "We couldn't send your confirmation email. Contact support: hola@englishkolab.com"
      redirect(`/${lang}/registro?error=${encodeURIComponent(emailError)}`)
    }
    redirect(`/${lang}/registro?error=${encodeURIComponent(error.message)}`)
  }

  // If email confirmation is disabled, user is immediately logged in
  if (data.session) {
    redirect(`/${lang}/onboarding`)
  }

  // Send confirmation email directly via Resend (non-blocking)
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${lang}/auth/callback`,
      },
    })

    if (linkError) {
      console.error('[signUp] generateLink error:', linkError.message)
    } else {
      const confirmationUrl = linkData?.properties?.action_link
      if (confirmationUrl) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev'
        const maskedKey = (process.env.RESEND_API_KEY || '').slice(0, 8) + '...'
        console.log(`[signUp] Sending confirmation email — to: ${email}, from: ${fromAddr}, key: ${maskedKey}`)
        // NOTE: onboarding@resend.dev (sandbox) only delivers to Resend account owner.
        // For other recipients to receive email, verify a custom domain in Resend dashboard.
        const { error: resendError } = await resend.emails.send({
          from: fromAddr,
          to: email,
          subject: 'Confirma tu cuenta — EnglishKolab',
          html: `
            <h2>¡Bienvenido a EnglishKolab!</h2>
            <p>Haz clic en el siguiente enlace para confirmar tu cuenta:</p>
            <a href="${confirmationUrl}">Confirmar mi cuenta</a>
            <p>Si no creaste esta cuenta, ignora este email.</p>
          `,
        })
        if (resendError) {
          console.error('[signUp] Resend error:', resendError)
        } else {
          console.log('[signUp] Confirmation email sent via Resend to:', email)
        }
      }
    }
  } catch (err) {
    console.error('[signUp] Email send failed (non-blocking):', err)
  }

  // Email confirmation required
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
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${lang}/login/new-password`,
  })

  // Never leak whether the email exists or whether the send succeeded.
  // Always show a generic "check your inbox" — protects against enumeration
  // and avoids surfacing transient Supabase rate-limit errors to the user.
  if (error) {
    console.error('[auth] resetPasswordForEmail:', error.message)
  }

  redirect(`/${lang}/login?success=reset`)
}
