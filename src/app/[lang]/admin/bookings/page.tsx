import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidTimeZone, getZonedParts, zonedWallTimeToUtc } from '@/lib/timezone'
import BookingCalendarClient from './BookingCalendarClient'
import RescheduleRequestsPanel from './RescheduleRequestsPanel'

interface Props {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ weekStart?: string; view?: string; day?: string }>
}

// A calendar day expressed in the admin's profile zone (month 0-indexed). The
// whole week window is computed from these so day boundaries match the zone the
// calendar renders in (each admin sees the schedule in their OWN timezone — the
// AD-03 decision), not the server's UTC. Arithmetic via Date.UTC is exact (UTC
// has no DST); the conversion to a real instant happens in zonedWallTimeToUtc,
// which IS DST-aware.
interface ZDay { year: number; month: number; day: number }
function pad(n: number) { return String(n).padStart(2, '0') }
function addDaysZ(d: ZDay, n: number): ZDay {
  const dt = new Date(Date.UTC(d.year, d.month, d.day + n))
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth(), day: dt.getUTCDate() }
}
function weekdayOfZ(d: ZDay): number {
  return new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay() // 0=Sun
}
function mondayOfZ(d: ZDay): ZDay {
  const wd = weekdayOfZ(d)
  return addDaysZ(d, wd === 0 ? -6 : 1 - wd)
}

export default async function AdminBookingsPage({ params, searchParams }: Props) {
  const { lang } = await params
  const { weekStart: weekStartParam, view: viewParam, day: dayParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  // The calendar renders in the acting admin's own timezone. Fall back to the
  // business zone (Honduras) when the profile has none / an invalid value.
  const { data: prof } = await admin
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single()
  const tz = isValidTimeZone(prof?.timezone) ? (prof!.timezone as string) : 'America/Tegucigalpa'

  // Compute the visible week + "today" windows IN the admin's zone, then convert
  // to absolute UTC instants for the queries. The fetched range equals exactly
  // the 7 zoned days the grid shows, so client-side bucketing lines up.
  const now = new Date()
  const nowParts = getZonedParts(now, tz)
  const todayZ: ZDay = { year: nowParts.year, month: nowParts.month, day: nowParts.day }

  // ?weekStart is a zoned calendar date (YYYY-MM-DD). Guard a garbage value.
  let anchor: ZDay = todayZ
  if (weekStartParam) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartParam)
    if (m) {
      const cand: ZDay = { year: +m[1], month: +m[2] - 1, day: +m[3] }
      if (!Number.isNaN(new Date(Date.UTC(cand.year, cand.month, cand.day)).getTime())) anchor = cand
    }
  }
  const monday = mondayOfZ(anchor)
  const sunNext = addDaysZ(monday, 7)
  const tomZ = addDaysZ(todayZ, 1)

  const weekStartUtc = zonedWallTimeToUtc(monday.year, monday.month, monday.day, 0, 0, tz)
  const weekEndUtc = zonedWallTimeToUtc(sunNext.year, sunNext.month, sunNext.day, 0, 0, tz)
  const todayStartUtc = zonedWallTimeToUtc(todayZ.year, todayZ.month, todayZ.day, 0, 0, tz)
  const todayEndUtc = zonedWallTimeToUtc(tomZ.year, tomZ.month, tomZ.day, 0, 0, tz)
  const weekStartStr = `${monday.year}-${pad(monday.month + 1)}-${pad(monday.day)}`

  // Month-view window: the 6-week (42-day) grid of the anchor's calendar month,
  // starting on the Monday on/before the 1st. Always fetched (lightweight) so the
  // Month toggle is instant; bucketed client-side by the admin's zoned day.
  const firstOfMonth: ZDay = { year: anchor.year, month: anchor.month, day: 1 }
  const monthGrid = mondayOfZ(firstOfMonth)
  const monthGridEnd = addDaysZ(monthGrid, 42)
  const monthGridStartUtc = zonedWallTimeToUtc(monthGrid.year, monthGrid.month, monthGrid.day, 0, 0, tz)
  const monthGridEndUtc = zonedWallTimeToUtc(monthGridEnd.year, monthGridEnd.month, monthGridEnd.day, 0, 0, tz)
  const monthGridStr = `${monthGrid.year}-${pad(monthGrid.month + 1)}-${pad(monthGrid.day)}`

  const [
    bookingsResult,
    teachersResult,
    availSlotsResult,
    sessionsResult,
    todayCountResult,
    pendingCountResult,
    weekConfirmedResult,
    allPendingResult,
    reschedResult,
    monthResult,
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
      .gte('scheduled_at', weekStartUtc.toISOString())
      .lt('scheduled_at', weekEndUtc.toISOString())
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: true }),

    admin
      .from('teachers')
      .select('id, accepting_students, profile:profiles(full_name)')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),

    admin
      .from('availability_slots')
      .select('teacher_id, day_of_week, start_time, end_time, is_active'),

    admin
      .from('sessions')
      .select('booking_id, teacher_notes, student_rating')
      .gte('created_at', weekStartUtc.toISOString())
      .lt('created_at', weekEndUtc.toISOString()),

    admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', todayStartUtc.toISOString())
      .lt('scheduled_at', todayEndUtc.toISOString())
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
      .gte('scheduled_at', weekStartUtc.toISOString())
      .lt('scheduled_at', weekEndUtc.toISOString()),

    // All unassigned pending bookings (not week-scoped) for the assignment queue.
    admin
      .from('bookings')
      .select(`
        id, student_id, scheduled_at, duration_minutes, type, status,
        teacher_id,
        student:students(profile:profiles(full_name))
      `)
      .eq('status', 'pending')
      .is('teacher_id', null)
      .order('scheduled_at', { ascending: true }),

    // Pending reschedule requests filed by teachers — admin triages at the top.
    admin
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
      .order('created_at', { ascending: true }),

    // Lightweight bookings across the month grid (powers the Month view).
    admin
      .from('bookings')
      .select(`id, scheduled_at, status, type, teacher_id, student:students(profile:profiles(full_name))`)
      .gte('scheduled_at', monthGridStartUtc.toISOString())
      .lt('scheduled_at', monthGridEndUtc.toISOString())
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: true }),
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

  type TeacherEntry = { id: string; name: string; accepting: boolean }
  const teachers: TeacherEntry[] = (teachersResult.data || []).map((t) => ({
    id: t.id,
    name: getName(t.profile) ?? 'Unknown',
    // Paused teachers (accepting_students=false) are still listed so they can
    // be re-assigned to students they already serve, but flagged in the UI and
    // gated server-side for new students. See TE-01.
    accepting: (t as { accepting_students?: boolean }).accepting_students !== false,
  }))

  const allPending = allPendingResult.data
  const reschedRaw = reschedResult.data

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

  const monthRaw = monthResult.data
  const monthBookings = (monthRaw ?? []).map((b) => ({
    id: b.id,
    scheduled_at: b.scheduled_at,
    status: b.status,
    type: b.type,
    teacher_id: b.teacher_id,
    student_name: getName(((b.student as unknown) as { profile: unknown } | null)?.profile),
  }))

  return (
    <>
      {rescheduleRequests.length > 0 && (
        <RescheduleRequestsPanel lang={lang} requests={rescheduleRequests} />
      )}
      <BookingCalendarClient
        lang={lang}
        timezone={tz}
        weekStart={weekStartStr}
        initialView={viewParam === 'month' ? 'month' : (dayParam ? 'day' : 'week')}
        initialDay={dayParam ?? null}
        monthGridStart={monthGridStr}
        monthYear={anchor.year}
        monthIndex={anchor.month}
        monthBookings={monthBookings}
        bookings={bookings}
        teachers={teachers}
        availSlots={availSlotsResult.data || []}
        pendingBookings={pendingBookings}
        stats={{
          todayCount: todayCountResult.count ?? 0,
          pendingCount: pendingCountResult.count ?? 0,
          weekConfirmed: weekConfirmedResult.count ?? 0,
        }}
      />
    </>
  )
}
