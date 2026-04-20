import { test, expect, type Page } from '@playwright/test'
import {
  setupBookingFixture,
  getClassesRemaining,
  setClassesRemaining,
  type BookingFixture,
} from '../fixtures/bookingFixture'

/**
 * Tier 1.3 — createBooking happy-path + classes_remaining=0 guard.
 *
 * Existing specs cover the booking lifecycle from an already-inserted row
 * (booking.spec.ts) and the 24-hour guard's rejection paths
 * (booking-guard-24h.spec.ts), but the createBooking SUCCESS path itself is
 * not exercised end-to-end through the UI anywhere else. This closes the
 * coverage gap — click a valid slot, confirm the reservation, and verify:
 *
 *   1. Booking row inserted with status='pending', teacher_id=NULL (admin
 *      assigns later per the 2026-04-17 booking-flow redesign).
 *   2. decrement_classes RPC fired — classes_remaining went from N → N-1
 *      (atomic path, same RPC covered for concurrency in counter-atomicity.spec.ts).
 *   3. UI shows the "¡Reservada!" success card.
 *
 * Also verifies the classes_remaining=0 route guard — students with no
 * classes get redirected from /agendar to /dashboard/plan (primary defense).
 * The server-side guard in `createBooking` is a secondary belt-and-suspenders
 * check, but the route redirect is the user-facing behavior.
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

test.describe('Tier 1.3 — createBooking happy path + classes guard', () => {
  let fx: BookingFixture | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(10)
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('happy path: valid slot → booking pending, teacher_id null, classes 10→9', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')

    // Ensure baseline — other tests in this describe mutate the counter.
    await setClassesRemaining(fx!, 10)
    const before = await getClassesRemaining(fx!)
    expect(before).toBe(10)

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed — check env')

      await page.goto('/es/dashboard/agendar')
      await expect(page.getByRole('heading', { name: /Agendar Clase/i })).toBeVisible({ timeout: 10_000 })

      // Slot buttons render labels like "9 AM" / "3 PM" (hourLabel in AgendarClient).
      // The UI disables <24h cells (renders "Muy pronto" divs instead of buttons),
      // so any clickable hour button is by definition ≥24h away.
      const slot = page.getByRole('button', { name: /^\d{1,2}\s(AM|PM)$/i }).first()
      await expect(slot).toBeVisible({ timeout: 10_000 })
      await slot.click()

      const confirmBtn = page.getByRole('button', { name: /Confirmar reserva/i })
      await expect(confirmBtn).toBeEnabled({ timeout: 5_000 })
      await confirmBtn.click()

      // Success card: gradient header with "¡Reservada!" / "Booked!" heading
      // (see `tx.successTitle` in AgendarClient).
      await expect(page.getByRole('heading', { name: /¡Reservada!|Booked!/i })).toBeVisible({ timeout: 10_000 })

      // DB invariants
      const after = await getClassesRemaining(fx!)
      expect(after, 'decrement_classes should fire on booking create').toBe(9)

      const { data: rows } = await fx!.admin
        .from('bookings')
        .select('id, status, teacher_id, type, duration_minutes')
        .eq('student_id', fx!.student.studentId)
        .order('created_at', { ascending: false })
        .limit(1)

      expect(rows ?? [], 'one new booking row should exist').toHaveLength(1)
      const row = rows![0]
      expect(row.status, 'new booking must be pending (admin assigns teacher later)').toBe('pending')
      expect(row.teacher_id, 'teacher_id null until admin assigns').toBeNull()
      expect(row.type).toBe('class')
      expect(row.duration_minutes).toBe(60)

      // Track for cleanup.
      if (row.id) fx!.bookingIds.push(row.id)
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('guard: classes_remaining=0 → /agendar redirects to /dashboard/plan', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    await setClassesRemaining(fx!, 0)
    const before = await getClassesRemaining(fx!)
    expect(before).toBe(0)

    const countBefore = (await fx!.admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', fx!.student.studentId)).count ?? 0

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed')

      // The page.tsx route guard should redirect to /plan before AgendarClient
      // even renders. This is the primary defense — users with no classes are
      // funneled into the upsell, not allowed near the calendar.
      await page.goto('/es/dashboard/agendar')
      await expect.poll(() => page.url(), { timeout: 10_000 }).toMatch(/\/dashboard\/plan/)

      // Agendar heading must NOT appear — we should be on the plan page.
      await expect(page.getByRole('heading', { name: /Agendar Clase/i })).toHaveCount(0)

      // DB invariants — counter stayed 0, no new row regardless.
      const after = await getClassesRemaining(fx!)
      expect(after, 'counter must stay 0').toBe(0)

      const countAfter = (await fx!.admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', fx!.student.studentId)).count ?? 0
      expect(countAfter, 'no new booking row').toBe(countBefore)
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})
