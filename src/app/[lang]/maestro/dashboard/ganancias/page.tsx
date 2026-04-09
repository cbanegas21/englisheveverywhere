import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GananciasClient from './GananciasClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function GananciasPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, total_sessions')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) redirect(`/${lang}/maestro/dashboard`)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: allSessions } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status,
      student:students(profile:profiles(full_name))
    `)
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    .limit(50)

  const thisMonthCount = (allSessions || []).filter(
    s => new Date(s.scheduled_at) >= startOfMonth
  ).length

  return (
    <GananciasClient
      lang={lang as Locale}
      totalSessions={teacher.total_sessions || 0}
      thisMonthSessions={thisMonthCount}
      sessions={(allSessions as any) || []}
    />
  )
}
