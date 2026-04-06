import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfigTeacherClient from './ConfigTeacherClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function ConfiguracionTeacherPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

  const { data: teacher } = await supabase
    .from('teachers')
    .select('bio, specializations, hourly_rate')
    .eq('profile_id', user.id)
    .single()

  return (
    <ConfigTeacherClient
      lang={lang as Locale}
      fullName={profile?.full_name || ''}
      bio={teacher?.bio || ''}
      specializations={
        Array.isArray(teacher?.specializations)
          ? (teacher.specializations as string[]).join(', ')
          : ''
      }
      email={user.email || ''}
    />
  )
}
