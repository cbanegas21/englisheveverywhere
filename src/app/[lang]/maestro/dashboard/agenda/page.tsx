import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidTimeZone } from '@/lib/timezone'
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

  // Fetch pending bookings. NOTE: the student→profile embed comes back NULL under
  // RLS (a teacher has no SELECT policy on a student's profiles row), so the
  // teacher agenda always showed "Student" instead of real names (deep-audit
  // I18N-6, proven live). We select student_id and resolve names via the
  // service-role client below, after the ownership-scoped .eq('teacher_id') —
  // exactly how tareas/ganancias already do it.
  const { data: pendingBookings } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status, type, student_id
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
      id, scheduled_at, duration_minutes, status, type, student_id
    `)
    .eq('teacher_id', teacher.id)
    .eq('status', 'confirmed')
    .gte('scheduled_at', recentCutoff)
    .order('scheduled_at', { ascending: true })
    .limit(10)

  // Resolve student names/avatars via the service-role client (RLS blocks the
  // teacher from reading student profiles rows — see the pending fetch note).
  // Ownership is already enforced above (both queries filter teacher_id), so we
  // only look up students that appear on THIS teacher's bookings.
  const studentIds = Array.from(new Set([
    ...(pendingBookings ?? []),
    ...(confirmedBookings ?? []),
  ].map((b) => b.student_id).filter((x): x is string => !!x)))
  const nameByStudent = new Map<string, { full_name: string | null; avatar_url: string | null }>()
  if (studentIds.length) {
    const admin = createAdminClient()
    const { data: studentRows } = await admin
      .from('students')
      .select('id, profile:profiles(full_name, avatar_url)')
      .in('id', studentIds)
    for (const s of studentRows ?? []) {
      const rawProf = (s as unknown as { profile?: unknown }).profile
      const prof = (Array.isArray(rawProf) ? rawProf[0] : rawProf) as { full_name: string | null; avatar_url: string | null } | null
      nameByStudent.set(s.id as string, { full_name: prof?.full_name ?? null, avatar_url: prof?.avatar_url ?? null })
    }
  }
  // Re-shape each booking to the { student: { profile: {...} } } shape the client
  // expects, now carrying the real resolved name/avatar.
  const withNames = <T extends { student_id: string | null }>(b: T) => ({
    ...b,
    student: { profile: nameByStudent.get(b.student_id ?? '') ?? { full_name: null, avatar_url: null } },
  })
  const pendingNamed = (pendingBookings ?? []).map(withNames)
  const confirmedNamed = (confirmedBookings ?? []).map(withNames)

  // Pull pending reschedule requests so we can badge any booking that already
  // has one in flight and stop the teacher from submitting a duplicate.
  const { data: pendingReschedules } = await supabase
    .from('reschedule_requests')
    .select('id, booking_id, proposed_scheduled_at, status')
    .in('booking_id', confirmedNamed.map(b => b.id))
    .eq('status', 'pending')

  const reschedulesByBooking = new Map(
    (pendingReschedules ?? []).map(r => [r.booking_id, r]),
  )

  const confirmedWithReschedule = confirmedNamed.map(b => ({
    ...b,
    reschedule_request: reschedulesByBooking.get(b.id) ?? null,
  }))

  // Phase D: teacher's own timezone (canonical = profiles.timezone).
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  const rawTimezone =
    (profileRow as { timezone?: string | null } | null)?.timezone ||
    (user.user_metadata?.timezone as string) ||
    'America/Tegucigalpa'
  // A corrupt stored tz throws RangeError mid-render and crashes the page —
  // same guard as dashboard/agendar/placement (DASH-01).
  const timezone = isValidTimeZone(rawTimezone) ? rawTimezone : 'America/Tegucigalpa'

  return (
    <AgendaClient
      lang={lang as Locale}
      timezone={timezone}
      pendingBookings={pendingNamed as any}
      confirmedBookings={confirmedWithReschedule as any}
    />
  )
}
