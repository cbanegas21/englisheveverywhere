import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { activeBookingCutoffIso } from '@/lib/bookingWindow'
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

  if (!teacher) redirect(`/${lang}/onboarding`)

  // Fetch pending bookings
  const { data: pendingBookings } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status, type,
      student:students(profile:profiles(full_name, avatar_url))
    `)
    .eq('teacher_id', teacher.id)
    .eq('status', 'pending')
    // Same now−2.5h grace as the confirmed bucket + teacher home + student clases.
    // A bare now() cutoff dropped a just-started/live PENDING booking (e.g. one a
    // student just rescheduled, which reverts confirmed→pending) off the teacher's
    // agenda while it still showed on their home + the student's list — leaving a
    // class the teacher had to re-confirm with no agenda surface to do it (SB-08).
    .gte('scheduled_at', activeBookingCutoffIso())
    .order('scheduled_at', { ascending: true })

  // Fetch confirmed upcoming. Include recently-started bookings so teachers can
  // still see / rejoin an in-progress session (shared with the other surfaces).
  const recentCutoff = activeBookingCutoffIso()
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

  // Pull pending reschedule requests so we can badge any booking that already
  // has one in flight and stop the teacher from submitting a duplicate.
  const { data: pendingReschedules } = await supabase
    .from('reschedule_requests')
    .select('id, booking_id, proposed_scheduled_at, status')
    .in('booking_id', (confirmedBookings ?? []).map(b => b.id))
    .eq('status', 'pending')

  const reschedulesByBooking = new Map(
    (pendingReschedules ?? []).map(r => [r.booking_id, r]),
  )

  const confirmedWithReschedule = (confirmedBookings ?? []).map(b => ({
    ...b,
    reschedule_request: reschedulesByBooking.get(b.id) ?? null,
  }))

  // Phase D: teacher's own timezone (canonical = profiles.timezone).
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  const timezone =
    (profileRow as { timezone?: string | null } | null)?.timezone ||
    (user.user_metadata?.timezone as string) ||
    'America/Tegucigalpa'

  return (
    <AgendaClient
      lang={lang as Locale}
      timezone={timezone}
      pendingBookings={(pendingBookings as any) || []}
      confirmedBookings={confirmedWithReschedule as any}
    />
  )
}
