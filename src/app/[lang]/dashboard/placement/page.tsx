import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  // Check for an existing placement booking (include completed — needed when placement_test_done = true)
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select(`
      id,
      scheduled_at,
      status,
      conductor:profiles!bookings_conductor_profile_id_fkey(full_name),
      teacher:teachers(profile:profiles(full_name))
    `)
    .eq('student_id', student.id)
    .eq('type', 'placement_test')
    .neq('status', 'cancelled')
    .maybeSingle()

  // Pull the human-readable name of whoever is running the call. Placement
  // calls can be admin-conducted (conductor_profile_id) or teacher-assigned
  // (teacher_id → teachers.profile.full_name). Prefer the conductor since
  // admins currently handle all placement calls.
  type BookingProfile = { full_name: string | null } | { full_name: string | null }[] | null
  type BookingTeacher = { profile: BookingProfile } | { profile: BookingProfile }[] | null
  function extractProfileName(raw: BookingProfile): string | null {
    if (!raw) return null
    if (Array.isArray(raw)) return raw[0]?.full_name ?? null
    return raw.full_name ?? null
  }
  function extractTeacherName(raw: BookingTeacher): string | null {
    if (!raw) return null
    if (Array.isArray(raw)) return extractProfileName(raw[0]?.profile ?? null)
    return extractProfileName(raw.profile ?? null)
  }
  const conductorName =
    extractProfileName((existingBooking?.conductor as BookingProfile) ?? null) ||
    extractTeacherName((existingBooking?.teacher as BookingTeacher) ?? null)

  const timezone = (user.user_metadata?.timezone as string) || 'America/Tegucigalpa'
  // "Past" means the live window is closed. Placement calls are 60 min, and
  // the video room stays joinable for 90 min after the scheduled end (matches
  // getRoomAccess late cap in src/app/actions/video.ts). Without this grace,
  // the banner flips to "has passed" the second the call starts — while the
  // student is actively on the call.
  const PLACEMENT_LIVE_WINDOW_MS = (60 + 90) * 60 * 1000
  const isPast = existingBooking?.scheduled_at
    ? new Date().getTime() > new Date(existingBooking.scheduled_at).getTime() + PLACEMENT_LIVE_WINDOW_MS
    : false

  // Call booked or already completed
  if (student.placement_scheduled || student.placement_test_done) {
    // If booking is in the past and student wants to reschedule — show the scheduling flow
    if (isPast && reschedule === '1') {
      return (
        <PlacementClient
          lang={lang as Locale}
          studentId={student.id}
          existingAnswers={student.survey_answers as Record<string, unknown> | null}
          existingBooking={null}
          isReschedule
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
        conductorName={conductorName}
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
    />
  )
}
