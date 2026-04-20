import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgendaClient from './AgendaClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function AgendaPage({ params }: Props) {
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

  // Fetch pending bookings
  const { data: pendingBookings } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status, type,
      student:students(profile:profiles(full_name, avatar_url))
    `)
    .eq('teacher_id', teacher.id)
    .eq('status', 'pending')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })

  // Fetch confirmed upcoming. Include bookings that started up to 2h ago
  // so teachers can still see / rejoin an in-progress session.
  const recentCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: confirmedBookings } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status, type,
      student:students(profile:profiles(full_name, avatar_url))
    `)
    .eq('teacher_id', teacher.id)
    .eq('status', 'confirmed')
    .gte('scheduled_at', recentCutoff)
    .order('scheduled_at', { ascending: true })
    .limit(10)

  return (
    <AgendaClient
      lang={lang as Locale}
      pendingBookings={(pendingBookings as any) || []}
      confirmedBookings={(confirmedBookings as any) || []}
    />
  )
}
