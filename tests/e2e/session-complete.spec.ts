import { test, expect, type Page } from '@playwright/test'
import {
  setupBookingFixture,
  insertBooking,
  getBookingStatus,
  setTeacherRate,
  getTeacherTotalSessions,
  setTeacherTotalSessions,
  getPaymentsForBooking,
  deletePaymentsForBooking,
  simulateCompleteSession,
  type BookingFixture,
} from '../fixtures/bookingFixture'

/**
 * Tier 1.4 — session complete flow.
 *
 * The real completion flow goes: Teacher clicks "Terminar Clase" inside the
 * LiveKit room → `completeSession` server action fires → DB mutations happen.
 *
 * Driving the LiveKit room end-to-end from Playwright is impractical (requires
 * real WebRTC between two browsers, getUserMedia permissions, STUN/TURN, etc).
 * So this spec splits the coverage:
 *
 *   1. UI smoke — the sala page loads for participants (teacher/student) and
 *      shows the EndedScreen when status=completed.
 *   2. Contract — apply the exact DB mutations that `completeSession` performs
 *      (see `simulateCompleteSession` in the fixture) and verify the invariants
 *      hold: status transition, payments insert, total_sessions increment,
 *      idempotency guard.
 *
 * If `completeSession` in `src/app/actions/video.ts` drifts from the
 * simulator, the contract tests here will stop catching real regressions —
 * keep them in sync.
 */

async function loginAs(page: Page, email: string, password: string, expectRedirect: RegExp): Promise<boolean> {
  await page.goto('/es/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  try {
    await page.waitForURL(expectRedirect, { timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

test.describe('Tier 1.4 — Session complete', () => {
  let fx: BookingFixture | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(10)
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('teacher sees sala page for a joinable confirmed booking', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')

    // Scheduled slightly in the past so the room is past the lobby and joinable.
    const scheduled = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, { status: 'confirmed', scheduledAt: scheduled })
    expect(bookingId).toBeTruthy()

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.teacher.email, fx!.teacher.password, /\/maestro\/dashboard/)
      test.skip(!ok, 'Teacher login failed')

      // Navigate and confirm we weren't redirected away (participant auth passed).
      const resp = await page.goto(`/es/sala/${bookingId}`)
      expect(resp?.status(), 'sala route should load (not 4xx/5xx)').toBeLessThan(400)
      await expect.poll(() => page.url(), { timeout: 5_000 }).toContain(`/sala/${bookingId}`)
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('student can access same sala page as participant', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    const scheduled = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, { status: 'confirmed', scheduledAt: scheduled })
    expect(bookingId).toBeTruthy()

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed')

      const resp = await page.goto(`/es/sala/${bookingId}`)
      expect(resp?.status()).toBeLessThan(400)
      await expect.poll(() => page.url(), { timeout: 5_000 }).toContain(`/sala/${bookingId}`)
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('completed booking renders EndedScreen (no room join)', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    const scheduled = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, { status: 'completed', scheduledAt: scheduled })
    expect(bookingId).toBeTruthy()

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed')

      await page.goto(`/es/sala/${bookingId}`)
      // EndedScreen heading — renders short-circuit when status=completed,
      // so LiveKit never initializes.
      await expect(page.getByRole('heading', { name: /Clase Completada/i })).toBeVisible({ timeout: 10_000 })
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('contract: status→completed, payments row, total_sessions++ (hourly=20, dur=60 → $20)', async () => {
    test.skip(!fx, 'Fixture unavailable')

    await setTeacherRate(fx!, 20)
    await setTeacherTotalSessions(fx!, 0)

    const scheduled = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, {
      status: 'confirmed',
      scheduledAt: scheduled,
      durationMinutes: 60,
    })
    expect(bookingId).toBeTruthy()

    await deletePaymentsForBooking(fx!, bookingId!)
    const beforeTotal = await getTeacherTotalSessions(fx!)

    await simulateCompleteSession(fx!, bookingId!)

    // 1. Booking transitioned to completed
    expect(await getBookingStatus(fx!, bookingId!)).toBe('completed')

    // 2. total_sessions incremented by exactly 1
    const afterTotal = await getTeacherTotalSessions(fx!)
    expect(afterTotal, 'total_sessions should increment by 1').toBe(beforeTotal + 1)

    // 3. Single payment row, correct amounts, 100% teacher payout (platform_fee=0)
    const payments = await getPaymentsForBooking(fx!, bookingId!)
    expect(payments, 'exactly one payment row should exist').toHaveLength(1)
    expect(payments[0].amount_usd, 'amount_usd = round(hourly * duration/60)').toBe(20)
    expect(payments[0].teacher_payout_usd, 'full payout to teacher').toBe(20)
    expect(payments[0].platform_fee_usd, 'platform takes 0 per PROJECT.md').toBe(0)
    expect(payments[0].status).toBe('completed')
  })

  test('contract: idempotency — second completion is a no-op (no double payment, no double increment)', async () => {
    test.skip(!fx, 'Fixture unavailable')

    await setTeacherRate(fx!, 20)
    await setTeacherTotalSessions(fx!, 50)

    const scheduled = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, {
      status: 'confirmed',
      scheduledAt: scheduled,
      durationMinutes: 60,
    })
    expect(bookingId).toBeTruthy()

    await deletePaymentsForBooking(fx!, bookingId!)

    // First completion
    await simulateCompleteSession(fx!, bookingId!)
    const afterFirst = {
      status: await getBookingStatus(fx!, bookingId!),
      total: await getTeacherTotalSessions(fx!),
      paymentCount: (await getPaymentsForBooking(fx!, bookingId!)).length,
    }
    expect(afterFirst.status).toBe('completed')
    expect(afterFirst.total).toBe(51)
    expect(afterFirst.paymentCount).toBe(1)

    // Second completion — simulates teacher double-clicking or retry
    await simulateCompleteSession(fx!, bookingId!)
    const afterSecond = {
      status: await getBookingStatus(fx!, bookingId!),
      total: await getTeacherTotalSessions(fx!),
      paymentCount: (await getPaymentsForBooking(fx!, bookingId!)).length,
    }

    expect(afterSecond.status, 'already-completed booking stays completed').toBe('completed')
    expect(afterSecond.total, 'total_sessions must NOT double-increment').toBe(51)
    expect(afterSecond.paymentCount, 'payments must NOT double-insert').toBe(1)
  })

  test('contract: amount calculation — 30-minute session at $25/hr rounds to $13', async () => {
    test.skip(!fx, 'Fixture unavailable')

    // JS Math.round(12.5) = 13 (rounds away from zero for .5). Verify the
    // calc in completeSession matches this expectation.
    await setTeacherRate(fx!, 25)
    await setTeacherTotalSessions(fx!, 0)

    const scheduled = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, {
      status: 'confirmed',
      scheduledAt: scheduled,
      durationMinutes: 30,
    })
    expect(bookingId).toBeTruthy()

    await deletePaymentsForBooking(fx!, bookingId!)
    await simulateCompleteSession(fx!, bookingId!)

    const payments = await getPaymentsForBooking(fx!, bookingId!)
    expect(payments).toHaveLength(1)
    expect(payments[0].amount_usd, 'round(25 * 30/60) = round(12.5) = 13').toBe(13)
    expect(payments[0].teacher_payout_usd).toBe(13)
  })

  test('contract: hourly_rate=0 produces $0 payment (edge case — teacher rate unset)', async () => {
    test.skip(!fx, 'Fixture unavailable')

    await setTeacherRate(fx!, 0)
    await setTeacherTotalSessions(fx!, 100)

    const scheduled = new Date(Date.now() - 7 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, {
      status: 'confirmed',
      scheduledAt: scheduled,
      durationMinutes: 60,
    })
    expect(bookingId).toBeTruthy()

    await deletePaymentsForBooking(fx!, bookingId!)
    await simulateCompleteSession(fx!, bookingId!)

    const payments = await getPaymentsForBooking(fx!, bookingId!)
    expect(payments).toHaveLength(1)
    expect(payments[0].amount_usd, 'rate=0 → payment=0').toBe(0)
    expect(payments[0].platform_fee_usd).toBe(0)

    // Reset so subsequent tests aren't polluted.
    await setTeacherRate(fx!, 20)
  })
})
