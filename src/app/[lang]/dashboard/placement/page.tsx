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
    .select('id, scheduled_at, status')
    .eq('student_id', student.id)
    .eq('type', 'placement_test')
    .neq('status', 'cancelled')
    .maybeSingle()

  const timezone = (user.user_metadata?.timezone as string) || 'America/Tegucigalpa'
  const isPast = existingBooking?.scheduled_at
    ? new Date(existingBooking.scheduled_at) < new Date()
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
