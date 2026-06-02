import { test, expect, type Page } from '@playwright/test'
import {
  setupBookingFixture,
  setClassesRemaining,
  setPrimaryTeacher,
  type BookingFixture,
} from '../fixtures/bookingFixture'

/**
 * Booking gate — a student cannot book until an admin has assigned them a
 * teacher (students.primary_teacher_id). Confirmed product decision 2026-06-01:
 * admin assigns the teacher first, THEN the student books.
 *
 * Two defenses, both verified here:
 *   1. /agendar route renders a "your teacher is on the way" state (no calendar
 *      grid) when primary_teacher_id is null — the user-facing behavior.
 *   2. Once a teacher is assigned, the calendar grid renders and bookable
 *      slots appear (the createBooking success path itself lives in
 *      booking-create.spec.ts).
 *
 * The server-side guard inside createBooking is the belt-and-suspenders backstop
 * behind the route behavior, mirroring the classes_remaining=0 pattern.
 */

async function loginAs(page: Page, email: string, password: string, expectRedirect: RegExp): Promise<boolean> {
  await page.goto('/es/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  try {
    await page.waitForURL(expectRedirect, { timeout: 45_000 })
    return true
  } catch {
    return false
  }
}

test.describe('Booking gate — requires assigned teacher', () => {
  let fx: BookingFixture | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(10)
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('no teacher assigned → /agendar shows waiting state, no bookable slots, no booking created', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')

    await setClassesRemaining(fx!, 10)
    await setPrimaryTeacher(fx!, null)

    const countBefore = (await fx!.admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', fx!.student.studentId)).count ?? 0

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed — check env')

      await page.goto('/es/dashboard/agendar')

      // The blocked state renders the "Tu maestro está en camino" card instead
      // of the calendar grid.
      await expect(page.getByText(/Tu maestro está en camino/i)).toBeVisible({ timeout: 10_000 })

      // No bookable "libre" slots should be present — the grid isn't rendered.
      await expect(page.getByRole('button', { name: /^libre$/i })).toHaveCount(0)

      // DB invariant — no booking row was created.
      const countAfter = (await fx!.admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', fx!.student.studentId)).count ?? 0
      expect(countAfter, 'no booking should be created without an assigned teacher').toBe(countBefore)
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('teacher assigned → calendar grid renders with bookable slots', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    await setClassesRemaining(fx!, 10)
    await setPrimaryTeacher(fx!, fx!.teacher.teacherId)

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed')

      await page.goto('/es/dashboard/agendar')

      // Waiting card must be gone, and at least one bookable slot must appear.
      await expect(page.getByText(/Tu maestro está en camino/i)).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^libre$/i }).first()).toBeVisible({ timeout: 10_000 })
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})
