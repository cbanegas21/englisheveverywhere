import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AvailabilityClient from './AvailabilityClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function AvailabilityPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) redirect(`/${lang}/maestro/dashboard`)

  const { data: slots } = await supabase
    .from('availability_slots')
    .select('id, day_of_week, start_time, end_time')
    .eq('teacher_id', teacher.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <AvailabilityClient
      lang={lang as Locale}
      existingSlots={(slots as any) || []}
    />
  )
}
