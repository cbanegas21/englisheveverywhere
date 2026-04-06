import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfigStudentClient from './ConfigStudentClient'
import type { Locale } from '@/lib/i18n/translations'

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
    .select('full_name, avatar_url, timezone')
    .eq('id', user.id)
    .single()

  return (
    <ConfigStudentClient
      lang={lang as Locale}
      fullName={profile?.full_name || ''}
      timezone={profile?.timezone || ''}
      email={user.email || ''}
    />
  )
}
