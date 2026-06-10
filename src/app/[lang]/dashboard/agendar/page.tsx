import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  if (!student) redirect(`/${lang}/dashboard`)

  // No classes → buy first
  if ((student.classes_remaining || 0) <= 0) {
    redirect(`/${lang}/dashboard/plan`)
  }

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
  const timezone =
    (profileRow as { timezone?: string | null } | null)?.timezone ||
    (user.user_metadata?.timezone as string) ||
    'America/Tegucigalpa'

  return (
    <AgendarClient
      lang={lang as Locale}
      studentId={student.id}
      classesRemaining={student.classes_remaining || 0}
      existingBookings={existingBookings}
      timezone={timezone}
    />
  )
}
