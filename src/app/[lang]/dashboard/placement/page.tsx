import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidTimeZone } from '@/lib/timezone'
import type { Locale } from '@/lib/i18n/translations'
import PlacementClient from './PlacementClient'
import PlacementScheduledScreen from './PlacementScheduledScreen'

interface Props {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ reschedule?: string }>
}

export default async function PlacementPage({ params, searchParams }: Props) {
  const { lang } = await params
  const { reschedule } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: student } = await supabase
    .from('students')
    .select('id, survey_answers, placement_test_done, placement_scheduled')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!student) redirect(`/${lang}/onboarding`)

  // Latest non-cancelled placement booking (include completed — needed when
  // placement_test_done = true). order+limit(1) so a stray second row from a
  // concurrent reschedule degrades to "take the latest" instead of a maybeSingle()
  // error that blanked the whole screen (PL-RESCHED-RACE).
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('id, scheduled_at, status, conductor_profile_id, teacher_id')
    .eq('student_id', student.id)
    .eq('type', 'placement_test')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Resolve the host's name via the SERVICE-ROLE client. A student has no RLS
  // SELECT on an admin conductor's profiles row, so the previous user-client embed
  // always came back null → the page said "host being assigned" while the
  // dashboard banner (already admin-client-resolved, SH-BAN-01) named them for the
  // SAME call (PL-CONDUCTOR-RLS-01). Server-only; only a display name.
  let conductorName: string | null = null
  if (existingBooking?.conductor_profile_id || existingBooking?.teacher_id) {
    const admin = createAdminClient()
    if (existingBooking.conductor_profile_id) {
      const { data } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', existingBooking.conductor_profile_id)
        .maybeSingle()
      conductorName = (data as { full_name?: string | null } | null)?.full_name ?? null
    } else if (existingBooking.teacher_id) {
      const { data } = await admin
        .from('teachers')
        .select('profile:profiles(full_name)')
        .eq('id', existingBooking.teacher_id)
        .maybeSingle()
      const prof = (data as { profile?: { full_name?: string | null } | { full_name?: string | null }[] } | null)?.profile
      conductorName = Array.isArray(prof) ? prof[0]?.full_name ?? null : prof?.full_name ?? null
    }
  }

  // Phase D: prefer profiles.timezone (user-editable) over auth metadata.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('timezone, notification_preferences')
    .eq('id', user.id)
    .maybeSingle()
  const rawTimezone =
    (profileRow as { timezone?: string | null } | null)?.timezone ||
    (user.user_metadata?.timezone as string) ||
    ''
  // Validate before it reaches the toLocale/Intl calls in the client screens — an
  // invalid IANA string throws a RangeError mid-render and 500s the page
  // (AG-TZ-CRASH class / DASH-01). Canonical fallback.
  const timezone = isValidTimeZone(rawTimezone) ? rawTimezone : 'America/Tegucigalpa'
  const notificationPreferences =
    (profileRow as { notification_preferences?: Record<string, boolean> | null } | null)
      ?.notification_preferences ?? undefined
  // "Past" means the live window is closed. Placement calls are 60 min, and
  // the video room stays joinable for 90 min after the scheduled end (matches
  // getRoomAccess late cap in src/app/actions/video.ts). Without this grace,
  // the banner flips to "has passed" the second the call starts — while the
  // student is actively on the call.
  const PLACEMENT_LIVE_WINDOW_MS = (60 + 90) * 60 * 1000
  const isPast = existingBooking?.scheduled_at
    ? new Date().getTime() > new Date(existingBooking.scheduled_at).getTime() + PLACEMENT_LIVE_WINDOW_MS
    : false

  // Call booked or already completed. Require an actual booking row for the
  // "scheduled" branch — a placement_scheduled flag with NO live booking (a
  // reschedule strand) would otherwise render a blank scheduled card; fall through
  // to the booking flow so the student can simply re-book (PL-STATE-BLANK).
  if ((student.placement_scheduled && existingBooking) || student.placement_test_done) {
    // If booking is in the past and student wants to reschedule — show the scheduling flow.
    // Never offer reschedule once placement is DONE: the assessment is finished, the
    // server action rejects it, and the student would dead-end on an error (placement-ui-1).
    if (isPast && reschedule === '1' && !student.placement_test_done) {
      return (
        <PlacementClient
          lang={lang as Locale}
          studentId={student.id}
          existingAnswers={student.survey_answers as Record<string, unknown> | null}
          existingBooking={null}
          isReschedule
          timezone={timezone}
          serverNowMs={Date.now()}
        />
      )
    }
    return (
      <PlacementScheduledScreen
        lang={lang as Locale}
        bookingId={existingBooking?.id || null}
        scheduledAt={existingBooking?.scheduled_at || null}
        timezone={timezone}
        isPast={isPast}
        placementDone={!!student.placement_test_done}
        conductorName={conductorName}
        notificationPreferences={notificationPreferences}
      />
    )
  }

  // Neither — show the survey + scheduling flow
  return (
    <PlacementClient
      lang={lang as Locale}
      studentId={student.id}
      existingAnswers={student.survey_answers as Record<string, unknown> | null}
      existingBooking={
        existingBooking
          ? {
              id: existingBooking.id,
              scheduledAt: existingBooking.scheduled_at,
              status: existingBooking.status,
            }
          : null
      }
      timezone={timezone}
      serverNowMs={Date.now()}
    />
  )
}
