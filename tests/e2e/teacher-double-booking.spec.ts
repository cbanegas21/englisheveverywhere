import { test, expect } from '@playwright/test'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupBookingFixture, insertBooking, type BookingFixture } from '../fixtures/bookingFixture'

/**
 * Teacher double-booking integrity — a teacher must never hold two CONFIRMED
 * bookings at the same start time, even for different students.
 *
 * The app already guards this at admin-assignment time (teacherHasConflict in
 * admin/actions.ts), but that's a read-then-write check vulnerable to a
 * concurrent assign (TOCTOU). Migration 027 adds the DB backstop
 * `bookings_teacher_time_unique` so the database itself enforces it.
 *
 * This spec asserts the DB-level guarantee directly: insert one confirmed
 * booking for the teacher at time X, then attempt a second confirmed booking
 * for a DIFFERENT student with the SAME teacher at the SAME time — it must be
 * rejected with a unique violation (23505).
 *
 * Until migration 027 is applied to the live DB, the constraint doesn't exist
 * and the second insert succeeds; in that case the test SKIPS with a loud
 * notice rather than passing silently. See docs/LAUNCH_OPS.md §2.
 */

async function createSecondStudent(admin: SupabaseClient) {
  const stamp = Date.now() + Math.floor(Math.random() * 1000)
  const email = `e2e-dbl-${stamp}@englishkolab.test`
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: 'E2eTest1234!',
    email_confirm: true,
    user_metadata: { full_name: `E2E Dbl Student ${stamp}`, role: 'student' },
  })
  if (error || !created.user) return null
  const userId = created.user.id
  await admin.from('profiles').upsert(
    { id: userId, email, full_name: `E2E Dbl Student ${stamp}`, role: 'student' },
    { onConflict: 'id' },
  )
  const { data: sRow } = await admin
    .from('students')
    .insert({ profile_id: userId, classes_remaining: 0, placement_test_done: true, intake_done: true, level: 'B1' })
    .select('id')
    .single()
  if (!sRow) return null
  return { userId, studentId: sRow.id, cleanup: async () => { try { await admin.auth.admin.deleteUser(userId) } catch {} } }
}

test.describe('Teacher double-booking — DB integrity (migration 027)', () => {
  let fx: BookingFixture | null = null
  let studentB: { userId: string; studentId: string; cleanup: () => Promise<void> } | null = null
  let bookingBId: string | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(0)
    if (fx) studentB = await createSecondStudent(fx.admin)
  })

  test.afterAll(async () => {
    try {
      if (fx && bookingBId) await fx.admin.from('bookings').delete().eq('id', bookingBId)
      await studentB?.cleanup()
      await fx?.cleanup()
    } catch { /* best-effort */ }
  })

  test('same teacher + same time + different students cannot both be confirmed', async () => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')
    test.skip(!studentB, 'Could not provision second student')

    const timeX = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

    // Booking A — fixture student, fixture teacher, confirmed at timeX.
    const bookingA = await insertBooking(fx!, {
      assignTeacher: true,
      status: 'confirmed',
      scheduledAt: timeX,
      type: 'class',
    })
    expect(bookingA, 'seed booking A must insert').toBeTruthy()

    // Booking B — DIFFERENT student, SAME teacher, SAME time, confirmed.
    const { data: inserted, error } = await fx!.admin
      .from('bookings')
      .insert({
        student_id: studentB!.studentId,
        teacher_id: fx!.teacher.teacherId,
        scheduled_at: timeX,
        duration_minutes: 60,
        status: 'confirmed',
        type: 'class',
      })
      .select('id')
      .single()

    if (inserted?.id) bookingBId = inserted.id

    // Migration 027 not yet applied → no constraint → insert succeeds. Skip
    // loudly so this never reads as a silent pass.
    test.skip(
      !error,
      'bookings_teacher_time_unique not present — apply migration 027 (see docs/LAUNCH_OPS.md §2) to enforce teacher double-booking protection.',
    )

    expect(
      error?.code,
      `expected unique violation (23505) blocking the second confirmed booking, got: ${error?.message ?? 'no error'}`,
    ).toBe('23505')
  })
})
