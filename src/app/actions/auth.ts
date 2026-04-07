'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as 'student' | 'teacher'
  const lang = (formData.get('lang') as string) || 'es'
  const timezone = (formData.get('timezone') as string) || 'America/Bogota'

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
        ? 'No pudimos enviar el email de confirmación. Contacta a soporte: hola@englisheverywhere.com'
        : "We couldn't send your confirmation email. Contact support: hola@englisheverywhere.com"
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
        const { error: resendError } = await resend.emails.send({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: email,
          subject: 'Confirma tu cuenta — English Everywhere',
          html: `
            <h2>¡Bienvenido a English Everywhere!</h2>
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

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/${lang}/login?error=${encodeURIComponent(error.message)}`)
  }

  // Get profile role to redirect correctly
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role

  if (role === 'teacher') {
    redirect(`/${lang}/maestro/dashboard`)
  }
  redirect(`/${lang}/dashboard`)
}

export async function signOut(lang: string = 'es') {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(`/${lang}/login`)
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const lang = (formData.get('lang') as string) || 'es'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${lang}/login/new-password`,
    // TODO: Supabase Dashboard → Auth → Email Templates → Reset Password
    // Update Subject: "Reset your English Everywhere password"
    // Set custom SMTP via Resend to use branded sender
  })

  if (error) {
    redirect(`/${lang}/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/${lang}/login?success=reset`)
}
