import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isValidTimeZone } from '@/lib/timezone'
import AgendarClient from './AgendarClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

export default async function AgendarPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: student } = await supabase
    .from('students')
    .select('id, classes_remaining, intake_done, placement_test_done')
    .eq('profile_id', user.id)
    .single()

  // No students row = onboarding not finished. Go straight to /onboarding
  // (the dashboard would just bounce here too) — one hop, not two (AG-GUARD-05).
  if (!student) redirect(`/${lang}/onboarding`)

  // NOTE: deliberately NO redirect on a 0 balance. Next.js re-renders the current
  // route on EVERY Server Action response, so this guard re-ran the instant
  // createBooking succeeded — and a student spending their LAST credit was thrown
  // to /dashboard/plan before the "¡Reservada!" screen ever painted. The booking
  // existed and the credit was gone, but they were never told, and no student
  // email is sent at this point either. AgendarClient renders a 0-credit empty
  // state instead (and still shows the success screen when it has just booked).

  // Intake not done → complete profile first
  if (!student.intake_done) {
    redirect(`/${lang}/dashboard/intake`)
  }

  // Fetch student's existing bookings to mark occupied slots
  const { data: existingBookingsRaw } = await supabase
    .from('bookings')
    .select('scheduled_at')
    .eq('student_id', student.id)
    .neq('status', 'cancelled')
  const existingBookings = (existingBookingsRaw || []).map((b: { scheduled_at: string }) => b.scheduled_at)

  // Canonical display timezone — same precedence as Mis Clases (profiles.timezone,
  // then signup metadata, then the business fallback) so the slot grid renders in
  // the same zone the rest of the app uses, not the browser's (DASH-04).
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  const rawTimezone =
    (profileRow as { timezone?: string | null } | null)?.timezone ||
    (user.user_metadata?.timezone as string) ||
    ''
  // Validate before it reaches getZonedParts/zonedWallTimeToUtc/Intl in the grid —
  // an invalid IANA string throws a RangeError mid-render and 500s the whole
  // booking page (AG-TZ-INVALID-PROFILE-ZONE / DASH-01). Canonical fallback.
  const timezone = isValidTimeZone(rawTimezone) ? rawTimezone : 'America/Tegucigalpa'

  return (
    <AgendarClient
      lang={lang as Locale}
      studentId={student.id}
      classesRemaining={student.classes_remaining || 0}
      existingBookings={existingBookings}
      timezone={timezone}
      // Server-authoritative clock so the rolling week + slot past/too-soon gating
      // render identically on SSR and first client hydration — using new Date()/
      // Date.now() in render straddles the now+24h and tz-midnight boundaries and
      // trips React #418 on the slot grid (AG-HYD-01/02).
      serverNowMs={Date.now()}
    />
  )
}
