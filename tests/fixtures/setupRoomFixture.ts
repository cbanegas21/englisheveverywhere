/**
 * Programmatic provisioning for the /sala/:bookingId two-browser tests.
 *
 * Uses the Supabase service-role key (bypasses RLS) to:
 *   1. Create (or reuse) a temp student auth user + profile + students row
 *   2. Ensure the configured teacher account has a teachers row
 *   3. Insert a confirmed booking scheduled for "now" between the two
 *
 * The fixture is best-effort: if any required env var is missing or the
 * network call fails, it returns `null` so the room spec can `test.skip`
 * gracefully instead of failing the whole suite.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Playwright doesn't load .env.local itself; parse it once when this module loads.
// We deliberately don't add `dotenv` as a dep — tiny hand-roll keeps the test surface slim.
(function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i)
      if (!m) continue
      const [, k, vRaw] = m
      if (process.env[k]) continue
      const v = vRaw.replace(/^['"]|['"]$/g, '')
      process.env[k] = v
    }
  } catch { /* .env.local optional */ }
})()

const TEACHER_EMAIL = process.env.E2E_TEACHER_EMAIL || 'c.banegaspaz2020@gmail.com'
const TEACHER_PASSWORD = process.env.E2E_TEACHER_PASSWORD || 'Test1234!'

export interface RoomFixture {
  bookingId: string
  student: { email: string; password: string; userId: string; studentId: string }
  teacher: { email: string; password: string; userId: string; teacherId: string }
  cleanup: () => Promise<void>
}

function getAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function ensureTeacher(admin: SupabaseClient): Promise<{ userId: string; teacherId: string } | null> {
  // Find the teacher auth user by email.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) return null
  const user = list.users.find(u => (u.email || '').toLowerCase() === TEACHER_EMAIL.toLowerCase())
  if (!user) return null

  // Profile must exist (trigger handles on signup); upsert for safety.
  await admin.from('profiles').upsert(
    { id: user.id, email: user.email!, full_name: user.user_metadata?.full_name || 'Test Teacher', role: 'teacher' },
    { onConflict: 'id' }
  )

  const { data: existing } = await admin.from('teachers').select('id').eq('profile_id', user.id).maybeSingle()
  if (existing?.id) return { userId: user.id, teacherId: existing.id }

  const { data: inserted, error: insErr } = await admin
    .from('teachers')
    .insert({ profile_id: user.id, is_active: true, hourly_rate: 20 })
    .select('id')
    .single()
  if (insErr || !inserted) return null
  return { userId: user.id, teacherId: inserted.id }
}

async function createStudent(admin: SupabaseClient): Promise<{ email: string; password: string; userId: string; studentId: string } | null> {
  const stamp = Date.now()
  const email = `e2e-student-${stamp}@english-everywhere.test`
  const password = 'E2eTest1234!'

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E Student ${stamp}`, role: 'student' },
  })
  if (createErr || !created.user) return null
  const userId = created.user.id

  // The handle_new_user trigger inserts a profile row; upsert guarantees role=student.
  await admin.from('profiles').upsert(
    { id: userId, email, full_name: `E2E Student ${stamp}`, role: 'student' },
    { onConflict: 'id' }
  )

  const { data: sRow, error: sErr } = await admin
    .from('students')
    .insert({ profile_id: userId, classes_remaining: 10, placement_test_done: true, level: 'B1' })
    .select('id')
    .single()
  if (sErr || !sRow) return null

  return { email, password, userId, studentId: sRow.id }
}

async function createBooking(
  admin: SupabaseClient,
  studentId: string,
  teacherId: string
): Promise<string | null> {
  const scheduledAt = new Date().toISOString() // join window starts immediately
  const { data, error } = await admin
    .from('bookings')
    .insert({
      student_id: studentId,
      teacher_id: teacherId,
      scheduled_at: scheduledAt,
      duration_minutes: 60,
      status: 'confirmed',
    })
    .select('id')
    .single()
  if (error || !data) return null
  return data.id
}

export async function setupRoomFixture(): Promise<RoomFixture | null> {
  const admin = getAdmin()
  if (!admin) return null

  const teacher = await ensureTeacher(admin)
  if (!teacher) return null

  const student = await createStudent(admin)
  if (!student) return null

  const bookingId = await createBooking(admin, student.studentId, teacher.teacherId)
  if (!bookingId) return null

  const cleanup = async () => {
    try {
      await admin.from('bookings').delete().eq('id', bookingId)
      // Deleting the auth user cascades to profile + students via FK.
      await admin.auth.admin.deleteUser(student.userId)
    } catch {
      /* best-effort */
    }
  }

  return {
    bookingId,
    student: { ...student },
    teacher: { email: TEACHER_EMAIL, password: TEACHER_PASSWORD, userId: teacher.userId, teacherId: teacher.teacherId },
    cleanup,
  }
}
