import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingClient from './OnboardingClient'
import { locales, type Locale } from '@/lib/i18n/translations'

interface OnboardingPageProps {
  params: Promise<{ lang: string }>
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { lang } = await params
  // Layout notFound() does not protect pages (they render in parallel) — a
  // dotted path skips the locale proxy and lands here with an invalid lang
  // (same class as the landing eyebrow crash, Sentry ENGLISHKOLAB-3/4/G).
  if (!locales.includes(lang as Locale)) notFound()
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect(`/${lang}/login`)
  }

  // Read role from profiles — handles both email/password and OAuth users.
  // The handle_new_user trigger defaults to 'student' for OAuth signups.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, timezone, preferred_language, role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || user.user_metadata?.role || 'student') as
    | 'student'
    | 'teacher'
    | 'admin'

  // Admins (and any non-student/non-teacher role) have no onboarding flow —
  // send them to their role home before OnboardingClient mis-treats them as a
  // student and dead-ends them on a localized error. Mirrors auth/callback.
  if (role === 'admin') {
    redirect(`/${lang}/admin`)
  }

  // If already onboarded, route to the correct destination
  if (role === 'teacher') {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, is_active')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (teacher) {
      if (!teacher.is_active) redirect(`/${lang}/maestro/pending`)
      else redirect(`/${lang}/maestro/dashboard`)
    }
  } else {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (student) redirect(`/${lang}/dashboard`)
  }

  return (
    <OnboardingClient
      lang={lang as Locale}
      role={role}
      userId={user.id}
      existingName={profile?.full_name || user.user_metadata?.full_name || ''}
    />
  )
}
