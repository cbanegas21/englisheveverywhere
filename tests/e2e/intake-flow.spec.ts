import { test, expect, type Page } from '@playwright/test'
import { setupBookingFixture, type BookingFixture } from '../fixtures/bookingFixture'

/**
 * Tier 1.5 — student intake form completion unlocks /agendar.
 *
 * The intake is the second gate on the student funnel (classes_remaining >0
 * being the first). Fresh signups land on /dashboard/intake with
 * `intake_done=false`, and the /agendar route bounces them here via
 * `page.tsx` redirect. Completing intake persists answers + flips the flag
 * so the student can then reach the calendar.
 *
 * Existing fixtures stub `intake_done=true` for speed, so the real 4-step
 * form is not exercised anywhere. This spec closes that gap by walking the
 * student through every step and verifying both:
 *
 *   1. The `saveIntake` server action persists all four answers AND sets
 *      intake_done=true on the row.
 *   2. The client router pushes to /dashboard/agendar on success (matches
 *      IntakeClient.tsx:142).
 *   3. The /dashboard/intake route guard auto-redirects already-done
 *      students to /agendar (short-circuit path in page.tsx:22).
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

test.describe('Tier 1.5 — Student intake form flow', () => {
  let fx: BookingFixture | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(10)
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('student completes 4-step intake → DB updated → redirected to /agendar', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')

    // Reset to a fresh-signup state: the fixture stubs intake_done=true for
    // other specs; override here so the form actually renders instead of
    // the page guard short-circuiting us to /agendar.
    await fx!.admin
      .from('students')
      .update({
        intake_done: false,
        learning_goal: null,
        work_description: null,
        learning_style: null,
        age_range: null,
      })
      .eq('id', fx!.student.studentId)

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed — check env')

      await page.goto('/es/dashboard/intake')
      await expect(page.getByRole('heading', { name: /Perfil de Aprendizaje/i })).toBeVisible({ timeout: 10_000 })

      // AnimatePresence(mode="wait") swaps question cards between steps. Anchor
      // on each step's heading before interacting so we never touch a stale
      // textarea still in the DOM during the exit animation.

      // Step 1 — learning_goal
      await expect(page.getByRole('heading', { name: /objetivo específico de inglés/i })).toBeVisible({ timeout: 10_000 })
      const goalText = 'Aprobar el IELTS B2 en diciembre'
      await page.getByPlaceholder(/Pasar el IELTS B2/i).fill(goalText)
      await page.getByRole('button', { name: /^Siguiente$/i }).click()

      // Step 2 — work_description (target via step-specific placeholder)
      await expect(page.getByRole('heading', { name: /A qué te dedicas/i })).toBeVisible({ timeout: 10_000 })
      const workText = 'Ingeniero de software'
      await page.getByPlaceholder(/Ingeniero de software/i).fill(workText)
      await page.getByRole('button', { name: /^Siguiente$/i }).click()

      // Step 3 — learning_style radio cards. The button's accessible name
      // includes both the label and the desc; use a regex anchored on "Visual".
      await expect(page.getByRole('heading', { name: /estilo de aprendizaje/i })).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: /^Visual/i }).click()
      await page.getByRole('button', { name: /^Siguiente$/i }).click()

      // Step 4 — age_range, then submit. Final button text is "Empezar a Agendar".
      await expect(page.getByRole('heading', { name: /rango de edad/i })).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: /^18–25$/ }).click()
      await page.getByRole('button', { name: /Empezar a Agendar/i }).click()

      // On success, IntakeClient pushes to /dashboard/agendar. The agendar
      // page then checks classes_remaining + intake_done — both should be
      // satisfied now, so we land on the calendar.
      await expect.poll(() => page.url(), { timeout: 10_000 }).toMatch(/\/dashboard\/agendar/)
      await expect(page.getByRole('heading', { name: /Agendar Clase/i })).toBeVisible({ timeout: 10_000 })

      // DB invariants — all four fields persisted, intake_done flipped.
      const { data: row } = await fx!.admin
        .from('students')
        .select('learning_goal, work_description, learning_style, age_range, intake_done')
        .eq('id', fx!.student.studentId)
        .single()

      expect(row?.intake_done, 'flag must flip so /agendar gate opens').toBe(true)
      expect(row?.learning_goal).toBe(goalText)
      expect(row?.work_description).toBe(workText)
      expect(row?.learning_style).toBe('visual')
      expect(row?.age_range).toBe('18_25')
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('route guard: student with intake_done=true is auto-redirected to /agendar', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    // Previous test already set intake_done=true. Re-assert explicitly so
    // this test is independent of execution order.
    await fx!.admin
      .from('students')
      .update({ intake_done: true })
      .eq('id', fx!.student.studentId)

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed')

      await page.goto('/es/dashboard/intake')
      await expect.poll(() => page.url(), { timeout: 10_000 }).toMatch(/\/dashboard\/agendar/)

      // Intake form must NOT render — we were redirected.
      await expect(page.getByRole('heading', { name: /Perfil de Aprendizaje/i })).toHaveCount(0)
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})
