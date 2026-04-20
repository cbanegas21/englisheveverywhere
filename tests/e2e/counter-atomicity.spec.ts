import { test, expect } from '@playwright/test'
import { setupBookingFixture, type BookingFixture } from '../fixtures/bookingFixture'

/**
 * Tier 1.6 — class counter atomicity.
 *
 * Several paths mutate `students.classes_remaining` or `teachers.total_sessions`.
 * Some use atomic SQL via RPCs (increment_classes, decrement_classes);
 * others do a non-atomic read-then-update — which loses concurrent writes.
 *
 * Audit:
 *   ATOMIC (good):
 *     - createBooking        → rpc('decrement_classes')
 *     - declineBooking       → rpc('increment_classes')   [SECURITY DEFINER, migration 012]
 *
 *   NON-ATOMIC (race):
 *     - admin/actions.ts:253-263  cancelBookingWithRefund  (reads classes_remaining, writes +1)
 *     - actions/video.ts:272-277  completeSession          (reads total_sessions, writes +1)
 *
 * The risk: if two cancellations (or two completions) run concurrently, both
 * read the same old value and both write `old+1`, losing one increment.
 *
 * This spec:
 *   1. Demonstrates the race on the non-atomic pattern (direct SQL proof).
 *   2. Demonstrates that `increment_classes` RPC is race-safe.
 *   3. Flags the admin cancelBookingWithRefund path for migration to the RPC.
 */

const CONCURRENCY = 20

test.describe('Tier 1.6 — Class counter atomicity', () => {
  let fx: BookingFixture | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(0)
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('atomic: increment_classes RPC preserves all increments under concurrency', async () => {
    test.skip(!fx, 'Fixture unavailable')

    // Baseline: 0. Fire CONCURRENCY parallel RPC calls. All should stick.
    await fx!.admin
      .from('students')
      .update({ classes_remaining: 0 })
      .eq('id', fx!.student.studentId)

    const calls = Array.from({ length: CONCURRENCY }, () =>
      fx!.admin.rpc('increment_classes', { p_student_id: fx!.student.studentId }),
    )
    const results = await Promise.all(calls)
    for (const r of results) expect(r.error, `rpc error: ${r.error?.message}`).toBeNull()

    const { data } = await fx!.admin
      .from('students')
      .select('classes_remaining')
      .eq('id', fx!.student.studentId)
      .single()

    expect(
      data?.classes_remaining,
      `atomic RPC must preserve all ${CONCURRENCY} concurrent increments`,
    ).toBe(CONCURRENCY)
  })

  test('race witness: non-atomic read-then-update (the admin cancelBookingWithRefund pattern) can lose updates', async () => {
    test.skip(!fx, 'Fixture unavailable')

    // Reset baseline.
    await fx!.admin
      .from('students')
      .update({ classes_remaining: 0 })
      .eq('id', fx!.student.studentId)

    // Mirror the exact pattern in src/app/[lang]/admin/actions.ts:253-263.
    // It's a SELECT then UPDATE with no row-level lock and no atomic expression.
    const nonAtomicIncrement = async () => {
      const { data: s } = await fx!.admin
        .from('students')
        .select('classes_remaining')
        .eq('id', fx!.student.studentId)
        .single()
      if (!s) return
      await fx!.admin
        .from('students')
        .update({ classes_remaining: (s.classes_remaining || 0) + 1 })
        .eq('id', fx!.student.studentId)
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, nonAtomicIncrement))

    const { data } = await fx!.admin
      .from('students')
      .select('classes_remaining')
      .eq('id', fx!.student.studentId)
      .single()

    const final = data?.classes_remaining ?? 0
    // Expected (if atomic) = CONCURRENCY.
    // Under the non-atomic pattern, concurrent SELECTs can read the same
    // stale value and both write old+1, producing `final < CONCURRENCY`.
    // We don't hard-assert `<` because Supabase's pooling may serialize
    // enough calls to avoid the race on small N. Instead we log + assert
    // the result is AT MOST CONCURRENCY (can be less — a lost update).
    expect(final).toBeLessThanOrEqual(CONCURRENCY)

    // Informational: print whether a race was observed in this run.
    if (final < CONCURRENCY) {
      console.warn(
        `[counter-atomicity] OBSERVED LOST UPDATE: ${CONCURRENCY} concurrent increments ` +
        `produced classes_remaining=${final}. ` +
        `cancelBookingWithRefund (admin/actions.ts:253-263) should use rpc('increment_classes') ` +
        `instead of the read-then-update pattern.`,
      )
    }
  })

  test('admin-refund pattern audit: cancelBookingWithRefund source uses non-atomic increment (regression guard)', async () => {
    // Prevents accidental regression: if someone adds a new non-atomic
    // read-then-update for classes_remaining (or one is re-introduced), the
    // test will flag the location. Currently fails by design until fixed.
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/app/[lang]/admin/actions.ts', 'utf8')

    // Look specifically for the cancelBookingWithRefund function body.
    const match = src.match(/export async function cancelBookingWithRefund[\s\S]*?^}/m)
    expect(match, 'cancelBookingWithRefund must exist').toBeTruthy()
    const body = match![0]

    const usesRpc = /\.rpc\(['"]increment_classes['"]/.test(body)
    const usesReadThenUpdate = /classes_remaining.*\|\|\s*0\)\s*\+\s*1/.test(body)

    // After the fix: should use RPC, no read-then-update.
    expect(
      usesRpc,
      `cancelBookingWithRefund should call rpc('increment_classes') to avoid the race. ` +
      `Currently uses non-atomic read-then-update: ${usesReadThenUpdate}`,
    ).toBe(true)
    expect(
      usesReadThenUpdate,
      `cancelBookingWithRefund must NOT use non-atomic read-then-update`,
    ).toBe(false)
  })
})
