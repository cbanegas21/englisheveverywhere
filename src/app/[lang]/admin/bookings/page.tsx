import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import BookingCalendarClient from './BookingCalendarClient'
import RescheduleRequestsPanel from './RescheduleRequestsPanel'

interface Props {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ weekStart?: string }>
}

export default async function AdminBookingsPage({ params, searchParams }: Props) {
  const { lang } = await params
  const { weekStart: weekStartParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  // Compute week range (Monday 00:00 UTC → Sunday 23:59 UTC)
  const now = new Date()

  function getMondayOf(d: Date): Date {
    const day = d.getUTCDay() // 0=Sun
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setUTCDate(d.getUTCDate() + diff)
    monday.setUTCHours(0, 0, 0, 0)
    return monday
  }

  const weekStart = weekStartParam
    ? new Date(weekStartParam + 'T00:00:00Z')
    : getMondayOf(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7)

  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setUTCHours(23, 59, 59, 999)

  const [
    bookingsResult,
    teachersResult,
    allStudentsResult,
    availSlotsResult,
    sessionsResult,
    todayCountResult,
    pendingCountResult,
    weekConfirmedResult,
  ] = await Promise.all([
    admin
      .from('bookings')
      .select(`
        id, student_id, teacher_id, conductor_profile_id, scheduled_at, duration_minutes,
        status, type, meeting_notes, video_room_url,
        student:students(id, level, profile:profiles(full_name, email)),
        teacher:teachers(id, profile:profiles(full_name)),
        conductor:profiles!conductor_profile_id(full_name)
      `)
      .gte('scheduled_at', weekStart.toISOString())
      .lt('scheduled_at', weekEnd.toISOString())
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: true }),

    admin
      .from('teachers')
      .select('id, profile:profiles(full_name)')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),

    admin
      .from('students')
      .select('id, profile:profiles(full_name, email)'),

    admin
      .from('availability_slots')
      .select('teacher_id, day_of_week, start_time, end_time'),

    admin
      .from('sessions')
      .select('booking_id, teacher_notes, student_rating')
      .gte('created_at', weekStart.toISOString())
      .lt('created_at', weekEnd.toISOString()),

    admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .neq('status', 'cancelled'),

    admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .is('teacher_id', null),

    admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('scheduled_at', weekStart.toISOString())
      .lt('scheduled_at', weekEnd.toISOString()),
  ])

  type SessionData = { teacher_notes: string | null; student_rating: number | null }
  const sessionMap = new Map<string, SessionData>()
  for (const s of sessionsResult.data || []) {
    sessionMap.set(s.booking_id, { teacher_notes: s.teacher_notes, student_rating: s.student_rating })
  }

  type BookingEntry = {
    id: string
    student_id: string
    teacher_id: string | null
    conductor_profile_id: string | null
    scheduled_at: string
    duration_minutes: number | null
    status: string
    type: string
    meeting_notes: string | null
    video_room_url: string | null
    student_name: string | null
    student_email: string | null
    student_level: string | null
    teacher_name: string | null
    conductor_name: string | null
    ai_summary: string | null
    student_rating: number | null
  }

  function getName(profile: unknown): string | null {
    if (!profile) return null
    if (Array.isArray(profile)) return (profile as { full_name: string | null }[])[0]?.full_name ?? null
    return (profile as { full_name: string | null }).full_name ?? null
  }
  function getEmail(profile: unknown): string | null {
    if (!profile) return null
    if (Array.isArray(profile)) return (profile as { email: string | null }[])[0]?.email ?? null
    return (profile as { email: string | null }).email ?? null
  }

  const bookings: BookingEntry[] = (bookingsResult.data || []).map((b) => {
    const rawStudent = b.student as { id: string; level: string | null; profile: unknown } | { id: string; level: string | null; profile: unknown }[] | null
    const studentObj = Array.isArray(rawStudent) ? rawStudent[0] : rawStudent
    const rawTeacher = b.teacher as { id: string; profile: unknown } | { id: string; profile: unknown }[] | null
    const teacherObj = Array.isArray(rawTeacher) ? rawTeacher[0] : rawTeacher
    // conductor_profile_id is a direct FK to profiles (no intermediate teacher
    // row), so the join surfaces the profile object itself — not nested.
    const rawConductor = (b as { conductor?: unknown }).conductor
    const conductorName = getName(rawConductor)

    const session = sessionMap.get(b.id)
    return {
      id: b.id,
      student_id: b.student_id,
      teacher_id: b.teacher_id,
      conductor_profile_id: (b as { conductor_profile_id: string | null }).conductor_profile_id ?? null,
      scheduled_at: b.scheduled_at,
      duration_minutes: b.duration_minutes,
      status: b.status,
      type: b.type,
      meeting_notes: b.meeting_notes,
      video_room_url: b.video_room_url,
      student_name: getName(studentObj?.profile),
      student_email: getEmail(studentObj?.profile),
      student_level: studentObj?.level ?? null,
      teacher_name: getName(teacherObj?.profile),
      conductor_name: conductorName,
      ai_summary: session?.teacher_notes ?? null,
      student_rating: session?.student_rating ?? null,
    }
  })

  type TeacherEntry = { id: string; name: string }
  const teachers: TeacherEntry[] = (teachersResult.data || []).map((t) => ({
    id: t.id,
    name: getName(t.profile) ?? 'Unknown',
  }))

  type StudentEntry = { id: string; name: string; email: string }
  const allStudents: StudentEntry[] = (allStudentsResult.data || []).map((s) => ({
    id: s.id,
    name: getName((s as { id: string; profile: unknown }).profile) ?? 'Unknown',
    email: getEmail((s as { id: string; profile: unknown }).profile) ?? '',
  }))

  const { data: allPending } = await admin
    .from('bookings')
    .select(`
      id, student_id, scheduled_at, duration_minutes, type, status,
      teacher_id,
      student:students(profile:profiles(full_name))
    `)
    .eq('status', 'pending')
    .is('teacher_id', null)
    .order('scheduled_at', { ascending: true })

  // Pending reschedule requests filed by teachers — admin triages at the top.
  const { data: reschedRaw } = await admin
    .from('reschedule_requests')
    .select(`
      id, booking_id, proposed_scheduled_at, original_scheduled_at, reason, created_at,
      booking:bookings(
        id, scheduled_at, duration_minutes, type,
        student:students(profile:profiles(full_name)),
        teacher:teachers(profile:profiles(full_name))
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  type RescheduleEntry = {
    id: string
    bookingId: string
    originalAt: string
    proposedAt: string
    reason: string | null
    createdAt: string
    studentName: string | null
    teacherName: string | null
  }
  const rescheduleRequests: RescheduleEntry[] = (reschedRaw ?? []).map((r) => {
    const rawBooking = (r as { booking: unknown }).booking
    const booking = Array.isArray(rawBooking) ? rawBooking[0] : rawBooking
    const b = booking as { student: unknown; teacher: unknown } | null
    const studentObj = Array.isArray(b?.student) ? (b?.student as unknown[])[0] : b?.student
    const teacherObj = Array.isArray(b?.teacher) ? (b?.teacher as unknown[])[0] : b?.teacher
    return {
      id: r.id,
      bookingId: r.booking_id,
      originalAt: r.original_scheduled_at,
      proposedAt: r.proposed_scheduled_at,
      reason: r.reason,
      createdAt: r.created_at,
      studentName: getName((studentObj as { profile: unknown } | null)?.profile),
      teacherName: getName((teacherObj as { profile: unknown } | null)?.profile),
    }
  })

  type PendingEntry = {
    id: string
    student_id: string
    scheduled_at: string
    duration_minutes: number | null
    type: string
    student_name: string | null
  }
  const pendingBookings: PendingEntry[] = (allPending || []).map((b) => ({
    id: b.id,
    student_id: b.student_id,
    scheduled_at: b.scheduled_at,
    duration_minutes: b.duration_minutes,
    type: b.type,
    student_name: getName(((b.student as unknown) as { profile: unknown } | null)?.profile),
  }))

  return (
    <>
      {rescheduleRequests.length > 0 && (
        <RescheduleRequestsPanel lang={lang} requests={rescheduleRequests} />
      )}
      <BookingCalendarClient
        lang={lang}
        weekStart={weekStart.toISOString().slice(0, 10)}
        bookings={bookings}
        teachers={teachers}
        allStudents={allStudents}
        availSlots={availSlotsResult.data || []}
        pendingBookings={pendingBookings}
        stats={{
          todayCount: todayCountResult.count ?? 0,
          pendingCount: pendingCountResult.count ?? 0,
          weekConfirmed: weekConfirmedResult.count ?? 0,
          availableSlots: (availSlotsResult.data || []).length,
        }}
      />
    </>
  )
}
