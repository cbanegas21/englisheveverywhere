import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StudentsTableClient from './StudentsTableClient'

interface Props { params: Promise<{ lang: string }> }

export interface StudentRow {
  id: string
  level: string | null
  classes_remaining: number
  current_plan: string | null
  placement_test_done: boolean
  placement_scheduled: boolean
  created_at: string
  profile: { id: string; full_name: string | null; email: string | null; timezone: string | null } | null
  completedCount: number
  upcomingCount: number
  teacherName: string | null
  teacherId: string | null
}

export default async function AdminStudentsPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  // Fetch students with profiles
  const { data: rawStudents } = await admin
    .from('students')
    .select(`
      id, level, classes_remaining, current_plan,
      placement_test_done, placement_scheduled, admin_notes, created_at,
      profile:profiles(id, full_name, email, timezone)
    `)
    .order('created_at', { ascending: false })

  const students = rawStudents || []
  const studentIds = students.map((s) => s.id)

  // Fetch bookings and teachers in parallel
  const [bookingsResult, teachersResult] = await Promise.all([
    studentIds.length > 0
      ? admin
          .from('bookings')
          .select('student_id, teacher_id, status, type')
          .in('student_id', studentIds)
          .in('status', ['confirmed', 'completed', 'pending'])
      : Promise.resolve({ data: [] }),
    admin
      .from('teachers')
      .select('id, profile:profiles(full_name)')
      .eq('is_active', true),
  ])

  const bookings = bookingsResult.data || []
  const teacherMap = new Map<string, string>()
  for (const t of teachersResult.data || []) {
    const rawProfile = t.profile
    let fullName: string | null = null
    if (Array.isArray(rawProfile)) {
      fullName = (rawProfile as { full_name: string | null }[])[0]?.full_name ?? null
    } else if (rawProfile && typeof rawProfile === 'object') {
      fullName = (rawProfile as { full_name: string | null }).full_name ?? null
    }
    teacherMap.set(t.id, fullName || 'Unknown Teacher')
  }

  // Build enriched student rows
  const enriched: StudentRow[] = students.map((s) => {
    const sBookings = bookings.filter((b) => b.student_id === s.id)
    const completedCount = sBookings.filter((b) => b.status === 'completed' && b.type === 'class').length
    const upcomingCount = sBookings.filter(
      (b) => (b.status === 'confirmed' || b.status === 'pending') && b.type === 'class'
    ).length

    // Find most recent confirmed class booking teacher
    const confirmedClassBookings = sBookings.filter(
      (b) => b.status === 'confirmed' && b.type === 'class' && b.teacher_id
    )
    const teacherId = confirmedClassBookings[0]?.teacher_id || null
    const teacherName = teacherId ? (teacherMap.get(teacherId) || null) : null

    type ProfileShape = { id: string; full_name: string | null; email: string | null; timezone: string | null }
    const rawSProfile = s.profile
    let profileData: ProfileShape | null = null
    if (Array.isArray(rawSProfile)) {
      profileData = (rawSProfile as unknown as ProfileShape[])[0] ?? null
    } else if (rawSProfile && typeof rawSProfile === 'object') {
      profileData = rawSProfile as unknown as ProfileShape
    }

    return {
      id: s.id,
      level: s.level,
      classes_remaining: s.classes_remaining || 0,
      current_plan: s.current_plan,
      placement_test_done: s.placement_test_done || false,
      placement_scheduled: s.placement_scheduled || false,
      created_at: s.created_at,
      profile: profileData,
      completedCount,
      upcomingCount,
      teacherName,
      teacherId,
    }
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black" style={{ color: '#111111' }}>Students</h1>
          <p className="text-[13px] mt-1" style={{ color: '#6B7280' }}>
            {enriched.length} registered student{enriched.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <StudentsTableClient students={enriched} lang={lang} />
    </div>
  )
}
