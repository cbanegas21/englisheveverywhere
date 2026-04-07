'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
    const msg = error.message.toLowerCase()
    const isEmailIssue = msg.includes('email') || msg.includes('smtp') || msg.includes('sending') || msg.includes('rate limit')
    if (isEmailIssue) {
      redirect(`/${lang}/registro?success=confirm`)
    }
    redirect(`/${lang}/registro?error=${encodeURIComponent(error.message)}`)
  }

  // If email confirmation is disabled, user is immediately logged in
  if (data.session) {
    redirect(`/${lang}/onboarding`)
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
