import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StudentProfileClient from './StudentProfileClient'

interface Props {
  params: Promise<{ lang: string; studentId: string }>
}

export interface BookingRecord {
  id: string
  scheduled_at: string
  duration_minutes: number | null
  status: string
  type: string
  teacher_id: string | null
  teacherName: string | null
  student_notes: string | null
}

export interface TeacherOption {
  id: string
  name: string
}

export interface StudentDetail {
  id: string
  profile_id: string
  level: string | null
  classes_remaining: number
  current_plan: string | null
  placement_test_done: boolean
  placement_scheduled: boolean
  admin_notes: string | null
  learning_goal: string | null
  work_description: string | null
  learning_style: string | null
  age_range: string | null
  survey_answers: Record<string, unknown> | null
  created_at: string
  primary_teacher_id: string | null
  primary_teacher_name: string | null
  profile: {
    id: string
    full_name: string | null
    email: string | null
    timezone: string | null
    role: string | null
  } | null
  bookings: BookingRecord[]
  assignedTeacherId: string | null
  assignedTeacherName: string | null
  teachers: TeacherOption[]
  hasPurchasesTable: boolean
}

export default async function StudentProfilePage({ params }: Props) {
  const { lang, studentId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  // Fetch student with profile
  const { data: rawStudent } = await admin
    .from('students')
    .select(`
      id, profile_id, level, classes_remaining, current_plan,
      placement_test_done, placement_scheduled, admin_notes,
      learning_goal, work_description, learning_style, age_range,
      survey_answers, created_at, primary_teacher_id,
      profile:profiles(id, full_name, email, timezone, role)
    `)
    .eq('id', studentId)
    .single()

  if (!rawStudent) notFound()

  // Fetch bookings and active teachers in parallel
  const [bookingsResult, teachersResult] = await Promise.all([
    admin
      .from('bookings')
      .select('id, scheduled_at, duration_minutes, status, type, teacher_id, student_notes')
      .eq('student_id', studentId)
      .order('scheduled_at', { ascending: false }),
    admin
      .from('teachers')
      .select('id, profile:profiles(full_name)')
      .eq('is_active', true),
  ])

  const rawBookings = bookingsResult.data || []
  const rawTeachers = teachersResult.data || []

  // Build teacher map
  const teacherMap = new Map<string, string>()
  const teacherOptions: TeacherOption[] = []
  for (const t of rawTeachers) {
    // Supabase returns profile as array when using foreign key join — handle both shapes
    const rawProfile = t.profile
    let fullName: string | null = null
    if (Array.isArray(rawProfile)) {
      fullName = (rawProfile as { full_name: string | null }[])[0]?.full_name ?? null
    } else if (rawProfile && typeof rawProfile === 'object') {
      fullName = (rawProfile as { full_name: string | null }).full_name ?? null
    }
    const name = fullName || 'Unknown Teacher'
    teacherMap.set(t.id, name)
    teacherOptions.push({ id: t.id, name })
  }

  // Enrich bookings
  const bookings: BookingRecord[] = rawBookings.map((b) => ({
    id: b.id,
    scheduled_at: b.scheduled_at,
    duration_minutes: b.duration_minutes,
    status: b.status,
    type: b.type,
    teacher_id: b.teacher_id,
    teacherName: b.teacher_id ? (teacherMap.get(b.teacher_id) || null) : null,
    student_notes: b.student_notes,
  }))

  // Find assigned teacher from most recent confirmed class booking
  const confirmedClass = bookings.find((b) => b.status === 'confirmed' && b.type === 'class' && b.teacher_id)
  const assignedTeacherId = confirmedClass?.teacher_id || null
  const assignedTeacherName = assignedTeacherId ? (teacherMap.get(assignedTeacherId) || null) : null

  type ProfileShape = { id: string; full_name: string | null; email: string | null; timezone: string | null; role: string | null }
  const rawProfile = rawStudent.profile
  let profileData: ProfileShape | null = null
  if (Array.isArray(rawProfile)) {
    profileData = (rawProfile as unknown as ProfileShape[])[0] ?? null
  } else if (rawProfile && typeof rawProfile === 'object') {
    profileData = rawProfile as unknown as ProfileShape
  }

  const primaryTeacherId: string | null = rawStudent.primary_teacher_id || null
  const primaryTeacherName = primaryTeacherId ? (teacherMap.get(primaryTeacherId) || null) : null

  const student: StudentDetail = {
    id: rawStudent.id,
    profile_id: rawStudent.profile_id,
    level: rawStudent.level,
    classes_remaining: rawStudent.classes_remaining || 0,
    current_plan: rawStudent.current_plan,
    placement_test_done: rawStudent.placement_test_done || false,
    placement_scheduled: rawStudent.placement_scheduled || false,
    admin_notes: rawStudent.admin_notes,
    learning_goal: rawStudent.learning_goal,
    work_description: rawStudent.work_description,
    learning_style: rawStudent.learning_style,
    age_range: rawStudent.age_range,
    survey_answers: rawStudent.survey_answers as Record<string, unknown> | null,
    created_at: rawStudent.created_at,
    primary_teacher_id: primaryTeacherId,
    primary_teacher_name: primaryTeacherName,
    profile: profileData,
    bookings,
    assignedTeacherId,
    assignedTeacherName,
    teachers: teacherOptions,
    hasPurchasesTable: false, // purchases table does not exist yet
  }

  return <StudentProfileClient student={student} lang={lang} />
}
