import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingClient from './OnboardingClient'
import type { Locale } from '@/lib/i18n/translations'

interface OnboardingPageProps {
  params: Promise<{ lang: string }>
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { lang } = await params
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

  const role = (profile?.role || user.user_metadata?.role || 'student') as 'student' | 'teacher'

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
