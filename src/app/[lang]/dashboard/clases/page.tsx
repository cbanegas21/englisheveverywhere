import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClasesClient from './ClasesClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function ClasesPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  const studentId = (student as { id?: string } | null)?.id || ''

  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select(`id, scheduled_at, duration_minutes, status, teacher:teachers(profile:profiles(full_name, avatar_url))`)
    .eq('student_id', studentId)
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(10)

  const { data: pastBookings } = await supabase
    .from('bookings')
    .select(`id, scheduled_at, duration_minutes, status, teacher:teachers(profile:profiles(full_name, avatar_url))`)
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .lt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: false })
    .limit(20)

  return (
    <ClasesClient
      lang={lang as Locale}
      upcomingBookings={(upcomingBookings as any) || []}
      pastBookings={(pastBookings as any) || []}
    />
  )
}
