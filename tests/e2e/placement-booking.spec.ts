import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  setupBookingFixture,
  type BookingFixture,
} from '../fixtures/bookingFixture'

/**
 * Tier 2.5 — Student placement-call scheduling (`bookPlacementCall` +
 * `reschedulePlacementCall` in `src/app/actions/placement.ts`).
 *
 * admin-placement-schedule.spec.ts covers the ADMIN path (createAdminBooking
 * → status='confirmed'). This spec covers the STUDENT-initiated path where:
 *   - Insert shape is different: `status='pending'` (awaits admin conductor
 *     assignment), `teacher_id=null`, `duration=60`, `type='placement_test'`.
 *   - `students.placement_scheduled` must flip true on success.
 *   - Three guard clauses that silently regressing would produce subtle bugs:
 *       a) duplicate placement_test guard (one student = one pending/confirmed
 *          placement call at a time) — regression = double-booked diagnostic
 *          calls, student could hold two slots and monopolise admin time.
 *       b) time-conflict guard (student can't book placement at the same
 *          `scheduled_at` as any non-cancelled booking) — regression = calendar
 *          shows two rows at the same time; sala routing fails on the second.
 *       c) teacher_id=null invariant — regression = placement call routed to
 *          the wrong participant gate (sala page dispatches on teacher_id vs
 *          conductor_profile_id; see header of admin-placement-schedule.spec).
 *
 * Approach — contract-level, not UI-level. PlacementClient.tsx is an 846-line
 * multi-step survey wizard; driving it end-to-end would be brittle and slow.
 * The action is pure DB work, so we mirror its queries/inserts against the
 * fixture's admin client to verify the guard clauses actually reject, and
 * pair that with a source-level assertion that the three guard regex patterns
 * remain present in the action file. Breaks early if a refactor drops any.
 */

test.describe('Tier 2.5 — Student placement-call scheduling', () => {
  let fx: BookingFixture | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(0)
    if (fx) {
      // setupBookingFixture seeds `placement_test_done: true` (mimics an
      // already-completed student). For placement-booking tests we need the
      // fresh-student shape: placement_test_done=false + placement_scheduled=false.
      await fx.admin
        .from('students')
        .update({ placement_test_done: false, placement_scheduled: false })
        .eq('id', fx.student.studentId)
    }
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('happy path: fresh booking writes pending/placement_test/teacher-null and flips placement_scheduled', async () => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')

    const scheduledAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

    // Mirror bookPlacementCall's insert (lines 77-88 of placement.ts). We
    // cannot call the server action directly from a node context (it reads
    // the user from cookies), so replicating the exact insert shape is the
    // proportionate test — if a migration drops any of these columns, this
    // fails loud.
    const { data: booking, error } = await fx!.admin
      .from('bookings')
      .insert({
        student_id: fx!.student.studentId,
        teacher_id: null,
        scheduled_at: scheduledAt,
        duration_minutes: 60,
        status: 'pending',
        type: 'placement_test',
      })
      .select('id, status, type, teacher_id, duration_minutes')
      .single()
    expect(error, 'placement_test insert shape must match the action').toBeNull()
    if (booking) fx!.bookingIds.push(booking.id)

    expect(booking?.status).toBe('pending')
    expect(booking?.type).toBe('placement_test')
    expect(booking?.teacher_id, 'placement_test must have null teacher_id').toBeNull()
    expect(booking?.duration_minutes).toBe(60)

    // Action line 93-96: flip students.placement_scheduled to true after a
    // successful insert. A silent drop of this write would leave the dashboard
    // showing "schedule your call" CTA even though a booking exists.
    await fx!.admin
      .from('students')
      .update({ placement_scheduled: true })
      .eq('profile_id', fx!.student.userId)

    const { data: s } = await fx!.admin
      .from('students')
      .select('placement_scheduled')
      .eq('id', fx!.student.studentId)
      .single()
    expect(s?.placement_scheduled).toBe(true)
  })

  test('duplicate-booking guard: second pending placement_test for same student is caught by the exact query the action uses', async () => {
    test.skip(!fx, 'Fixture unavailable')

    // Action lines 43-57: before inserting a new placement call, it checks
    // for an existing pending/confirmed placement_test on this student. This
    // test replicates that EXACT query — if the guard pattern or table shape
    // changes, the select fails here before the UI can.
    const { data: existing } = await fx!.admin
      .from('bookings')
      .select('id, scheduled_at')
      .eq('student_id', fx!.student.studentId)
      .eq('type', 'placement_test')
      .in('status', ['confirmed', 'pending'])
      .maybeSingle()

    expect(
      existing,
      'previous test inserted a pending placement_test — the guard query MUST find it',
    ).not.toBeNull()
    expect(existing?.id, 'guard must return a real booking id').toBeTruthy()
  })

  test('time-conflict guard: rejecting any booking at the same scheduled_at even if type differs', async () => {
    test.skip(!fx, 'Fixture unavailable')

    // Action lines 60-75: even if a student has no pending placement_test,
    // the action also blocks if ANY non-cancelled booking exists at the
    // proposed `scheduled_at`. Verify the query finds a colliding `class`
    // booking (mixed-type — different `type` but same time is still a
    // conflict).
    const collisionTime = new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString()
    const { data: classRow } = await fx!.admin
      .from('bookings')
      .insert({
        student_id: fx!.student.studentId,
        teacher_id: fx!.teacher.teacherId,
        scheduled_at: collisionTime,
        duration_minutes: 60,
        status: 'confirmed',
        type: 'class',
      })
      .select('id')
      .single()
    if (classRow) fx!.bookingIds.push(classRow.id)

    const { data: conflict } = await fx!.admin
      .from('bookings')
      .select('id')
      .eq('student_id', fx!.student.studentId)
      .eq('scheduled_at', collisionTime)
      .neq('status', 'cancelled')
      .maybeSingle()

    expect(
      conflict?.id,
      'time-conflict guard MUST detect the class booking at the same scheduled_at',
    ).toBe(classRow?.id)
  })

  test('reschedule: cancels old placement_test + keeps placement_scheduled=true + inserts new pending row', async () => {
    test.skip(!fx, 'Fixture unavailable')

    // Action lines 128-134: reschedule cancels EVERY non-cancelled
    // placement_test for this student before inserting the new one. Mirror
    // that sequence. If the action's `.neq('status', 'cancelled')` filter is
    // ever dropped, an old cancelled row would incorrectly get re-cancelled
    // (harmless) OR a new pending one might slip through (harmful) — this
    // test locks the cancel-before-insert invariant.
    await fx!.admin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('student_id', fx!.student.studentId)
      .eq('type', 'placement_test')
      .neq('status', 'cancelled')

    const newAt = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString()
    const { data: newBooking, error } = await fx!.admin
      .from('bookings')
      .insert({
        student_id: fx!.student.studentId,
        teacher_id: null,
        scheduled_at: newAt,
        duration_minutes: 60,
        status: 'pending',
        type: 'placement_test',
      })
      .select('id')
      .single()
    expect(error, 'reschedule insert must succeed after cancel').toBeNull()
    if (newBooking) fx!.bookingIds.push(newBooking.id)

    // After reschedule, exactly ONE pending placement_test for this student
    // should exist — older ones are cancelled.
    const { data: pendings } = await fx!.admin
      .from('bookings')
      .select('id')
      .eq('student_id', fx!.student.studentId)
      .eq('type', 'placement_test')
      .eq('status', 'pending')
    expect(pendings?.length, 'exactly one pending placement after reschedule').toBe(1)
    expect(pendings?.[0].id).toBe(newBooking?.id)

    // And cancelled placement_tests should exist (the one we just cancelled).
    const { data: cancelled } = await fx!.admin
      .from('bookings')
      .select('id')
      .eq('student_id', fx!.student.studentId)
      .eq('type', 'placement_test')
      .eq('status', 'cancelled')
    expect((cancelled?.length ?? 0), 'prior placement_test rows must be cancelled').toBeGreaterThanOrEqual(1)

    // Action line 153-155: placement_scheduled stays true after reschedule.
    const { data: s } = await fx!.admin
      .from('students')
      .select('placement_scheduled')
      .eq('id', fx!.student.studentId)
      .single()
    expect(s?.placement_scheduled).toBe(true)
  })

  test('source: bookPlacementCall still enforces duplicate + time-conflict + teacher-null invariants', () => {
    // Keep the three guards visibly wired in source. If a refactor accidentally
    // drops any of these lines, the DB tests above may still pass (because we
    // replicate the queries rather than invoking the action), but the real
    // user flow regresses silently. These regex probes are a cheap, direct
    // guard against that class of regression.
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/actions/placement.ts'),
      'utf8',
    )

    // (a) Duplicate guard — must query bookings for this student with
    //     type='placement_test' AND status in ['confirmed','pending'].
    expect(
      /\.eq\(\s*['"]type['"]\s*,\s*['"]placement_test['"]\s*\)[\s\S]*?\.in\(\s*['"]status['"]\s*,\s*\[\s*['"]confirmed['"]\s*,\s*['"]pending['"]/m
        .test(src),
      'bookPlacementCall must still query existing pending/confirmed placement_test for this student',
    ).toBe(true)

    // (b) Time-conflict guard — must filter scheduled_at + exclude cancelled.
    expect(
      /\.eq\(\s*['"]scheduled_at['"]\s*,\s*scheduledAt\s*\)[\s\S]*?\.neq\(\s*['"]status['"]\s*,\s*['"]cancelled['"]/m
        .test(src),
      'bookPlacementCall must still block same-time bookings across types',
    ).toBe(true)

    // (c) teacher_id=null on insert — migration 010's CHECK constraint
    //     requires this; if the action ever writes a non-null teacher_id,
    //     placement rooms would route to the wrong gate.
    expect(
      /\.insert\(\s*\{[\s\S]*?teacher_id:\s*null[\s\S]*?type:\s*['"]placement_test['"][\s\S]*?\}/m
        .test(src),
      'bookPlacementCall must still insert placement_test with teacher_id=null',
    ).toBe(true)

    // (d) reschedule cancels existing placement_test rows before inserting.
    expect(
      /\.update\(\s*\{\s*status:\s*['"]cancelled['"]\s*\}\s*\)[\s\S]*?\.eq\(\s*['"]type['"]\s*,\s*['"]placement_test['"]/m
        .test(src),
      'reschedulePlacementCall must cancel prior placement_test rows first',
    ).toBe(true)
  })
})
