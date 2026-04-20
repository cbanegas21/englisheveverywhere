import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfigStudentClient from './ConfigStudentClient'
import type { Locale } from '@/lib/i18n/translations'
import type { NotificationPreferences } from '@/app/actions/profile'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function ConfiguracionPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, timezone, phone, preferred_language, preferred_currency, notification_preferences')
    .eq('id', user.id)
    .single()

  return (
    <ConfigStudentClient
      lang={lang as Locale}
      fullName={(profile?.full_name as string) || ''}
      timezone={(profile?.timezone as string) || ''}
      email={user.email || ''}
      phone={(profile?.phone as string) || ''}
      avatarUrl={(profile?.avatar_url as string) || ''}
      preferredLanguage={((profile?.preferred_language as string) as 'es' | 'en') || lang as 'es' | 'en'}
      preferredCurrency={(profile?.preferred_currency as string) || 'USD'}
      notificationPreferences={(profile?.notification_preferences as NotificationPreferences) || {}}
    />
  )
}
