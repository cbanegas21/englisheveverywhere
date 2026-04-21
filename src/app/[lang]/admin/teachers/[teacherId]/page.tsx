import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TeacherProfileClient from './TeacherProfileClient'

interface Props {
  params: Promise<{ lang: string; teacherId: string }>
}

export interface BookingRow {
  id: string
  scheduled_at: string
  duration_minutes: number | null
  status: string
  type: string
  student_id: string
  studentName: string | null
}

export interface StudentOnTeacher {
  id: string
  name: string
  email: string
  level: string | null
  classes_remaining: number
  nextClassDate: string | null
}

export interface TeacherDetail {
  id: string
  profile_id: string
  bio: string | null
  specializations: string[] | null
  certifications: string[] | null
  hourly_rate: number | null
  rating: number | null
  total_sessions: number | null
  is_active: boolean
  admin_notes: string | null
  created_at: string
  cv_storage_path: string | null
  cv_uploaded_at: string | null
  cv_original_filename: string | null
  profile: {
    id: string
    full_name: string | null
    email: string | null
    timezone: string | null
    role: string | null
  } | null
  bookings: BookingRow[]
  activeStudentCount: number
  availSlots: { day_of_week: number; start_time: string; end_time: string }[]
  allStudents: { id: string; name: string; email: string }[]
  allTeachers: { id: string; name: string }[]
  students: StudentOnTeacher[]
}

export default async function TeacherProfilePage({ params }: Props) {
  const { lang, teacherId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  // Fetch teacher with profile
  const { data: rawTeacher } = await admin
    .from('teachers')
    .select(`
      id, profile_id, bio, specializations, certifications, hourly_rate,
      rating, total_sessions, is_active, admin_notes, created_at,
      cv_storage_path, cv_uploaded_at, cv_original_filename,
      profile:profiles(id, full_name, email, timezone, role)
    `)
    .eq('id', teacherId)
    .single()

  if (!rawTeacher) notFound()

  // Parallel fetches
  const [bookingsResult, allStudentsResult, allTeachersResult, availSlotsResult] = await Promise.all([
    admin
      .from('bookings')
      .select(`id, scheduled_at, duration_minutes, status, type, student_id, student:students(profile:profiles(full_name))`)
      .eq('teacher_id', teacherId)
      .order('scheduled_at', { ascending: false }),
    admin
      .from('students')
      .select('id, level, classes_remaining, profile:profiles(full_name, email)'),
    admin
      .from('teachers')
      .select('id, profile:profiles(full_name)')
      .eq('is_active', true),
    admin
      .from('availability_slots')
      .select('id, day_of_week, start_time, end_time')
      .eq('teacher_id', teacherId),
  ])

  // Parse profile
  type ProfileShape = { id: string; full_name: string | null; email: string | null; timezone: string | null; role: string | null }
  const rawProfile = rawTeacher.profile
  let profileData: ProfileShape | null = null
  if (Array.isArray(rawProfile)) {
    profileData = (rawProfile as unknown as ProfileShape[])[0] ?? null
  } else if (rawProfile && typeof rawProfile === 'object') {
    profileData = rawProfile as unknown as ProfileShape
  }

  // Parse bookings
  const bookings: BookingRow[] = (bookingsResult.data || []).map(b => {
    const rawStudent = b.student
    let studentName: string | null = null
    if (Array.isArray(rawStudent)) {
      const sp = (rawStudent as { profile: { full_name: string | null } | { full_name: string | null }[] | null }[])[0]?.profile
      if (Array.isArray(sp)) studentName = (sp as { full_name: string | null }[])[0]?.full_name ?? null
      else if (sp && typeof sp === 'object') studentName = (sp as { full_name: string | null }).full_name
    } else if (rawStudent && typeof rawStudent === 'object') {
      const sp = (rawStudent as { profile: { full_name: string | null } | { full_name: string | null }[] | null }).profile
      if (Array.isArray(sp)) studentName = (sp as { full_name: string | null }[])[0]?.full_name ?? null
      else if (sp && typeof sp === 'object') studentName = (sp as { full_name: string | null }).full_name
    }
    return {
      id: b.id,
      scheduled_at: b.scheduled_at,
      duration_minutes: b.duration_minutes,
      status: b.status,
      type: b.type,
      student_id: b.student_id,
      studentName,
    }
  })

  // Active student count from confirmed class bookings
  const confirmedStudents = new Set(
    bookings.filter(b => b.status === 'confirmed' && b.type === 'class').map(b => b.student_id)
  )

  // Build all students map for meeting scheduler + student tab
  type RawStudent = {
    id: string
    level: string | null
    classes_remaining: number
    profile: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null
  }
  const studentMap = new Map<string, { name: string; email: string; level: string | null; classes_remaining: number }>()
  for (const s of (allStudentsResult.data || []) as RawStudent[]) {
    const rawP = s.profile
    let name = 'Unknown'
    let email = ''
    if (Array.isArray(rawP)) {
      name = (rawP as { full_name: string | null; email: string | null }[])[0]?.full_name || 'Unknown'
      email = (rawP as { full_name: string | null; email: string | null }[])[0]?.email || ''
    } else if (rawP && typeof rawP === 'object') {
      name = (rawP as { full_name: string | null; email: string | null }).full_name || 'Unknown'
      email = (rawP as { full_name: string | null; email: string | null }).email || ''
    }
    studentMap.set(s.id, { name, email, level: s.level, classes_remaining: s.classes_remaining || 0 })
  }

  const allStudents = Array.from(studentMap.entries()).map(([id, v]) => ({ id, name: v.name, email: v.email }))

  // All teachers for meeting scheduler
  type RawTeacher = { id: string; profile: { full_name: string | null } | { full_name: string | null }[] | null }
  const allTeachers = (allTeachersResult.data || []).map((t: RawTeacher) => {
    const rawP = t.profile
    let name = 'Unknown'
    if (Array.isArray(rawP)) name = (rawP as { full_name: string | null }[])[0]?.full_name || 'Unknown'
    else if (rawP && typeof rawP === 'object') name = (rawP as { full_name: string | null }).full_name || 'Unknown'
    return { id: t.id, name }
  })

  // Students tab: unique students from confirmed class bookings
  const uniqueStudentIds = Array.from(confirmedStudents)
  const studentNextClass = new Map<string, string>()
  const now = new Date()
  for (const b of bookings) {
    if (b.status === 'confirmed' && b.type === 'class' && new Date(b.scheduled_at) > now) {
      if (!studentNextClass.has(b.student_id) || new Date(b.scheduled_at) < new Date(studentNextClass.get(b.student_id)!)) {
        studentNextClass.set(b.student_id, b.scheduled_at)
      }
    }
  }

  const students: StudentOnTeacher[] = uniqueStudentIds.map(id => {
    const info = studentMap.get(id)
    return {
      id,
      name: info?.name || 'Unknown',
      email: info?.email || '',
      level: info?.level || null,
      classes_remaining: info?.classes_remaining || 0,
      nextClassDate: studentNextClass.get(id) || null,
    }
  })

  const availSlots = (availSlotsResult.data || []).map(s => ({
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
  }))

  const teacher: TeacherDetail = {
    id: rawTeacher.id,
    profile_id: rawTeacher.profile_id,
    bio: rawTeacher.bio || null,
    specializations: rawTeacher.specializations || null,
    certifications: rawTeacher.certifications || null,
    hourly_rate: rawTeacher.hourly_rate || null,
    rating: rawTeacher.rating || null,
    total_sessions: rawTeacher.total_sessions || null,
    is_active: rawTeacher.is_active,
    admin_notes: rawTeacher.admin_notes || null,
    created_at: rawTeacher.created_at,
    cv_storage_path: rawTeacher.cv_storage_path || null,
    cv_uploaded_at: rawTeacher.cv_uploaded_at || null,
    cv_original_filename: rawTeacher.cv_original_filename || null,
    profile: profileData,
    bookings,
    activeStudentCount: confirmedStudents.size,
    availSlots,
    allStudents,
    allTeachers,
    students,
  }

  return <TeacherProfileClient teacher={teacher} lang={lang} />
}
