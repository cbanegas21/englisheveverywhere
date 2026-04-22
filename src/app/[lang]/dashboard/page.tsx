import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudentDashboardClient from './StudentDashboardClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function StudentDashboardPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  // Fetch student data
  const { data: student } = await supabase
    .from('students')
    .select('id, classes_remaining, placement_test_done, placement_scheduled, current_plan, primary_teacher_id')
    .eq('profile_id', user.id)
    .single()

  // Fetch placement booking scheduled_at (to detect past calls) + the
  // profile of whoever's running it, so the dashboard banner can name
  // the host (Fathom bug #12).
  const { data: placementBooking } = await supabase
    .from('bookings')
    .select(`
      scheduled_at,
      conductor:profiles!bookings_conductor_profile_id_fkey(full_name),
      teacher:teachers(profile:profiles(full_name))
    `)
    .eq('student_id', student?.id || '')
    .eq('type', 'placement_test')
    .neq('status', 'cancelled')
    .maybeSingle()

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
  const placementConductorName =
    extractProfileName((placementBooking?.conductor as BookingProfile) ?? null) ||
    extractTeacherName((placementBooking?.teacher as BookingTeacher) ?? null)

  // Fetch upcoming bookings (class type only)
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status, teacher_id,
      teacher:teachers(profile:profiles(full_name))
    `)
    .eq('student_id', student?.id || '')
    .eq('type', 'class')
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5)

  // Fetch completed sessions count (class type only)
  const { count: completedCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', (student as { id?: string } | null)?.id || '')
    .eq('type', 'class')
    .eq('status', 'completed')

  // Fetch scheduled-class count (class type only, future + active)
  const { count: scheduledCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', (student as { id?: string } | null)?.id || '')
    .eq('type', 'class')
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', new Date().toISOString())

  // Surface the student's locked-in teacher (admin-assigned via primary_teacher_id)
  // so the dashboard can answer "Can I get the same teacher every time?" with a
  // direct yes — see Q30 in docs/USER_AUDIT.md.
  const primaryTeacherId = (student as { primary_teacher_id?: string | null } | null)?.primary_teacher_id ?? null
  let primaryTeacherName: string | null = null
  if (primaryTeacherId) {
    const { data: pt } = await supabase
      .from('teachers')
      .select('profile:profiles(full_name)')
      .eq('id', primaryTeacherId)
      .maybeSingle()
    const ptProfile = (pt as { profile?: { full_name?: string | null } | { full_name?: string | null }[] } | null)?.profile
    primaryTeacherName = Array.isArray(ptProfile)
      ? ptProfile[0]?.full_name ?? null
      : ptProfile?.full_name ?? null
  }

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student'
  const timezone = (user.user_metadata?.timezone as string) || 'America/Bogota'

  return (
    <StudentDashboardClient
      lang={lang as Locale}
      userName={name}
      timezone={timezone}
      classesRemaining={student?.classes_remaining || 0}
      currentPlan={(student?.current_plan as string) || null}
      placementTestDone={student?.placement_test_done || false}
      placementScheduled={student?.placement_scheduled || false}
      placementScheduledAt={placementBooking?.scheduled_at || null}
      placementConductorName={placementConductorName}
      primaryTeacherName={primaryTeacherName}
      completedSessions={completedCount || 0}
      scheduledClasses={scheduledCount || 0}
      upcomingBookings={(upcomingBookings as any) || []}
    />
  )
}
