/**
 * Programmatic booking fixture for Tier 1 (booking lifecycle) E2E tests.
 *
 * Bypasses the complex /agendar calendar UI by inserting bookings directly via
 * service role, so the specs can focus on verifying:
 *   - display correctness across /clases, /maestro/dashboard/agenda, /admin/bookings
 *   - decline / confirm / cancel-refund state transitions
 *   - classes_remaining invariants (decrement on create, increment on decline/refund)
 *
 * Mirrors the env-loading + cleanup pattern from setupRoomFixture.ts.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

(function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i)
      if (!m) continue
      const [, k, vRaw] = m
      if (process.env[k]) continue
      process.env[k] = vRaw.replace(/^['"]|['"]$/g, '')
    }
  } catch { /* optional */ }
})()

const TEACHER_EMAIL = process.env.E2E_TEACHER_EMAIL || 'c.banegaspaz2020@gmail.com'
const TEACHER_PASSWORD = process.env.E2E_TEACHER_PASSWORD || 'Test1234!'

export interface BookingFixture {
  admin: SupabaseClient
  student: { email: string; password: string; userId: string; studentId: string }
  teacher: { email: string; password: string; userId: string; teacherId: string; fullName: string }
  bookingIds: string[]
  cleanup: () => Promise<void>
}

export interface InsertBookingOpts {
  scheduledAt?: string // ISO; default = +48h
  durationMinutes?: number
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  type?: 'class' | 'placement_test'
  assignTeacher?: boolean // default true; false leaves teacher_id=null (awaiting admin)
}

function getAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function ensureTeacher(admin: SupabaseClient) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (!list) return null
  const user = list.users.find(u => (u.email || '').toLowerCase() === TEACHER_EMAIL.toLowerCase())
  if (!user) return null

  await admin.from('profiles').upsert(
    { id: user.id, email: user.email!, full_name: user.user_metadata?.full_name || 'Test Teacher', role: 'teacher' },
    { onConflict: 'id' }
  )

  const { data: prof } = await admin.from('profiles').select('full_name').eq('id', user.id).single()
  const fullName = prof?.full_name || 'Test Teacher'

  const { data: existing } = await admin.from('teachers').select('id').eq('profile_id', user.id).maybeSingle()
  if (existing?.id) {
    // Ensure is_active=true so teacher isn't redirected to /maestro/pending.
    await admin.from('teachers').update({ is_active: true }).eq('id', existing.id)
    return { userId: user.id, teacherId: existing.id, fullName }
  }

  const { data: ins, error } = await admin
    .from('teachers')
    .insert({ profile_id: user.id, is_active: true, hourly_rate: 20 })
    .select('id')
    .single()
  if (error || !ins) return null
  return { userId: user.id, teacherId: ins.id, fullName }
}

async function createStudent(admin: SupabaseClient, classesRemaining = 10) {
  const stamp = Date.now() + Math.floor(Math.random() * 1000)
  const email = `e2e-booking-${stamp}@english-everywhere.test`
  const password = 'E2eTest1234!'

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E Booking Student ${stamp}`, role: 'student' },
  })
  if (error || !created.user) return null
  const userId = created.user.id

  await admin.from('profiles').upsert(
    { id: userId, email, full_name: `E2E Booking Student ${stamp}`, role: 'student' },
    { onConflict: 'id' }
  )

  const { data: sRow, error: sErr } = await admin
    .from('students')
    .insert({
      profile_id: userId,
      classes_remaining: classesRemaining,
      placement_test_done: true,
      intake_done: true,
      level: 'B1',
    })
    .select('id')
    .single()
  if (sErr || !sRow) return null

  return { email, password, userId, studentId: sRow.id }
}

export async function setupBookingFixture(classesRemaining = 10): Promise<BookingFixture | null> {
  const admin = getAdmin()
  if (!admin) return null

  const teacher = await ensureTeacher(admin)
  if (!teacher) return null

  const student = await createStudent(admin, classesRemaining)
  if (!student) return null

  const bookingIds: string[] = []

  const cleanup = async () => {
    try {
      if (bookingIds.length) {
        // Payments FK → bookings; delete payments first to avoid constraint errors.
        await admin.from('payments').delete().in('booking_id', bookingIds)
        await admin.from('bookings').delete().in('id', bookingIds)
      }
      await admin.auth.admin.deleteUser(student.userId)
    } catch { /* best-effort */ }
  }

  return {
    admin,
    student,
    teacher: {
      email: TEACHER_EMAIL,
      password: TEACHER_PASSWORD,
      userId: teacher.userId,
      teacherId: teacher.teacherId,
      fullName: teacher.fullName,
    },
    bookingIds,
    cleanup,
  }
}

export async function insertBooking(
  fx: BookingFixture,
  opts: InsertBookingOpts = {}
): Promise<string | null> {
  const scheduledAt = opts.scheduledAt || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const { data, error } = await fx.admin
    .from('bookings')
    .insert({
      student_id: fx.student.studentId,
      teacher_id: opts.assignTeacher === false ? null : fx.teacher.teacherId,
      scheduled_at: scheduledAt,
      duration_minutes: opts.durationMinutes ?? 60,
      status: opts.status ?? 'confirmed',
      type: opts.type ?? 'class',
    })
    .select('id')
    .single()
  if (error || !data) return null
  fx.bookingIds.push(data.id)
  return data.id
}

export async function getClassesRemaining(fx: BookingFixture): Promise<number | null> {
  const { data } = await fx.admin
    .from('students')
    .select('classes_remaining')
    .eq('id', fx.student.studentId)
    .single()
  return data?.classes_remaining ?? null
}

export async function setClassesRemaining(fx: BookingFixture, n: number): Promise<void> {
  await fx.admin.from('students').update({ classes_remaining: n }).eq('id', fx.student.studentId)
}

export async function getBookingStatus(fx: BookingFixture, bookingId: string): Promise<string | null> {
  const { data } = await fx.admin.from('bookings').select('status').eq('id', bookingId).single()
  return data?.status ?? null
}

export async function setTeacherRate(fx: BookingFixture, hourlyRate: number): Promise<void> {
  await fx.admin.from('teachers').update({ hourly_rate: hourlyRate }).eq('id', fx.teacher.teacherId)
}

export async function getTeacherTotalSessions(fx: BookingFixture): Promise<number> {
  const { data } = await fx.admin
    .from('teachers')
    .select('total_sessions')
    .eq('id', fx.teacher.teacherId)
    .single()
  return data?.total_sessions ?? 0
}

export async function setTeacherTotalSessions(fx: BookingFixture, n: number): Promise<void> {
  await fx.admin.from('teachers').update({ total_sessions: n }).eq('id', fx.teacher.teacherId)
}

export async function getPaymentsForBooking(fx: BookingFixture, bookingId: string): Promise<Array<{
  id: string
  amount_usd: number
  teacher_payout_usd: number
  platform_fee_usd: number
  status: string
}>> {
  const { data } = await fx.admin
    .from('payments')
    .select('id, amount_usd, teacher_payout_usd, platform_fee_usd, status')
    .eq('booking_id', bookingId)
  return data ?? []
}

export async function deletePaymentsForBooking(fx: BookingFixture, bookingId: string): Promise<void> {
  await fx.admin.from('payments').delete().eq('booking_id', bookingId)
}

/**
 * Mirrors the DB side-effects of `completeSession` in `src/app/actions/video.ts`.
 * Used to exercise the invariants (payments insert, total_sessions increment,
 * idempotency guard) without needing a real LiveKit connection.
 *
 * Keep in sync with the server action — if this diverges it won't catch the
 * actual bug path. The auth guard in the real action is NOT simulated here;
 * that's verified separately via a UI smoke test.
 */
export async function simulateCompleteSession(
  fx: BookingFixture,
  bookingId: string
): Promise<void> {
  const { data: booking } = await fx.admin
    .from('bookings')
    .select('id, status, duration_minutes, teacher:teachers(id, hourly_rate, total_sessions), student:students(id)')
    .eq('id', bookingId)
    .single()
  if (!booking) return

  const alreadyCompleted = (booking as any).status === 'completed'
  const teacherId = (booking as any).teacher?.id
  const studentId = (booking as any).student?.id
  const durationMinutes = (booking as any).duration_minutes ?? 60
  const hourlyRate = (booking as any).teacher?.hourly_rate ?? 0
  const totalSessions = (booking as any).teacher?.total_sessions ?? 0

  await fx.admin.from('bookings').update({ status: 'completed' }).eq('id', bookingId)

  if (teacherId && !alreadyCompleted) {
    await fx.admin
      .from('teachers')
      .update({ total_sessions: totalSessions + 1 })
      .eq('id', teacherId)
  }

  if (studentId && teacherId) {
    const { data: existing } = await fx.admin
      .from('payments')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (!existing) {
      const sessionRate = Math.round(hourlyRate * (durationMinutes / 60))
      await fx.admin.from('payments').insert({
        booking_id: bookingId,
        student_id: studentId,
        teacher_id: teacherId,
        amount_usd: sessionRate,
        teacher_payout_usd: sessionRate,
        platform_fee_usd: 0,
        status: 'completed',
      })
    }
  }
}
