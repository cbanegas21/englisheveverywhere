import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/translations'
import PlacementClient from './PlacementClient'
import PlacementScheduledScreen from './PlacementScheduledScreen'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function PlacementPage({ params }: Props) {
  const { lang } = await params
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

  // Call booked or already completed — show status screen, never auto-redirect
  if (student.placement_scheduled || student.placement_test_done) {
    return (
      <PlacementScheduledScreen
        lang={lang as Locale}
        scheduledAt={existingBooking?.scheduled_at || null}
        timezone={timezone}
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
