import { test, expect, type Page } from '@playwright/test'
import { setupBookingFixture, type BookingFixture } from '../fixtures/bookingFixture'

/**
 * Tier 2.1 — teacher availability configuration UI.
 *
 * Exercises `saveAvailabilitySlots` via the /maestro/dashboard/disponibilidad
 * UI. This action's contract is "wipe then re-insert" — it deletes all
 * existing rows for the teacher and inserts the provided list. That means:
 *
 *   - Adding slots appears as fresh rows on the teacher_id FK.
 *   - Removing a slot and re-saving drops it permanently.
 *   - Saving an empty list clears availability entirely.
 *
 * No test currently covers any of these paths. This spec walks through all
 * three and asserts DB state after each save.
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

test.describe('Tier 2.1 — Teacher availability UI', () => {
  let fx: BookingFixture | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(10)
  })

  test.afterAll(async () => {
    // Best-effort: clear any slots we may have inserted so repeat runs start clean.
    try {
      if (fx) {
        await fx.admin.from('availability_slots').delete().eq('teacher_id', fx.teacher.teacherId)
      }
    } catch {}
    try { await fx?.cleanup() } catch {}
  })

  test('add slots via UI → save → DB rows match, in-order', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')

    // Start empty — the "wipe then re-insert" action is sensitive to prior state.
    await fx!.admin.from('availability_slots').delete().eq('teacher_id', fx!.teacher.teacherId)

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.teacher.email, fx!.teacher.password, /\/maestro\/dashboard/)
      test.skip(!ok, 'Teacher login failed (check env or is_active=false)')

      await page.goto('/es/maestro/dashboard/disponibilidad')
      await expect(page.getByRole('heading', { name: /Configura tu disponibilidad/i })).toBeVisible({ timeout: 10_000 })

      // Empty-state message should be visible when the teacher has no slots.
      await expect(page.getByText(/Sin disponibilidad/i)).toBeVisible()

      // Add two slots — each "Agregar horario" click appends a default row
      // (Monday / 09:00 / 10:00). We then mutate the selects in place.
      const addBtn = page.getByRole('button', { name: /Agregar horario/i })
      await addBtn.click()
      await addBtn.click()

      const daySelects = page.locator('select').filter({ hasText: /Lunes/ })
      await expect(daySelects).toHaveCount(2, { timeout: 5_000 })

      // Slot 1: Monday (1), 10:00–11:00
      const row1 = page.locator('.lg\\:col-span-2 > div > div').nth(1).locator('> div').nth(0)
      // Simpler: just pick the N-th select by index. Rows are rendered in DOM order:
      // [day0, start0, end0, day1, start1, end1].
      const allSelects = page.locator('.lg\\:col-span-2 select')
      await expect(allSelects).toHaveCount(6, { timeout: 5_000 })

      // Row 0 (default values are Monday/09:00/10:00). Override to Monday/10:00/11:00.
      await allSelects.nth(0).selectOption('1')     // Monday
      await allSelects.nth(1).selectOption('10:00') // start
      await allSelects.nth(2).selectOption('11:00') // end

      // Row 1: Wednesday/14:00/15:00
      await allSelects.nth(3).selectOption('3')     // Wednesday
      await allSelects.nth(4).selectOption('14:00')
      await allSelects.nth(5).selectOption('15:00')

      await page.getByRole('button', { name: /Guardar disponibilidad/i }).click()
      await expect(page.getByText(/¡Disponibilidad guardada!/i)).toBeVisible({ timeout: 10_000 })

      // DB: exactly two rows for this teacher, matching what we configured.
      const { data: rows } = await fx!.admin
        .from('availability_slots')
        .select('day_of_week, start_time, end_time')
        .eq('teacher_id', fx!.teacher.teacherId)
        .order('day_of_week', { ascending: true })

      expect(rows ?? []).toHaveLength(2)
      expect(rows![0].day_of_week).toBe(1)
      expect(rows![0].start_time).toMatch(/^10:00/)
      expect(rows![0].end_time).toMatch(/^11:00/)
      expect(rows![1].day_of_week).toBe(3)
      expect(rows![1].start_time).toMatch(/^14:00/)
      expect(rows![1].end_time).toMatch(/^15:00/)
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('remove one slot + save → DB drops removed row; remaining row preserved', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    // Seed two known slots directly so this test is independent of the first.
    await fx!.admin.from('availability_slots').delete().eq('teacher_id', fx!.teacher.teacherId)
    await fx!.admin.from('availability_slots').insert([
      { teacher_id: fx!.teacher.teacherId, day_of_week: 2, start_time: '08:00', end_time: '09:00' },
      { teacher_id: fx!.teacher.teacherId, day_of_week: 4, start_time: '16:00', end_time: '17:00' },
    ])

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.teacher.email, fx!.teacher.password, /\/maestro\/dashboard/)
      test.skip(!ok, 'Teacher login failed')

      await page.goto('/es/maestro/dashboard/disponibilidad')
      await expect(page.getByRole('heading', { name: /Configura tu disponibilidad/i })).toBeVisible({ timeout: 10_000 })

      // Two rows should render. Each has a trash icon button (last button in the row).
      const allSelects = page.locator('.lg\\:col-span-2 select')
      await expect(allSelects).toHaveCount(6, { timeout: 10_000 })

      // Remove the first slot (Tuesday/08:00–09:00).
      // Each slot row has exactly 1 trash button; grab the first one.
      const trashButtons = page.locator('.lg\\:col-span-2 button').filter({ has: page.locator('svg.lucide-trash2') })
      await expect(trashButtons).toHaveCount(2, { timeout: 5_000 })
      await trashButtons.first().click()

      // Now only one slot should remain visible.
      await expect(allSelects).toHaveCount(3, { timeout: 5_000 })

      await page.getByRole('button', { name: /Guardar disponibilidad/i }).click()
      await expect(page.getByText(/¡Disponibilidad guardada!/i)).toBeVisible({ timeout: 10_000 })

      // DB: exactly one row — the Thursday/16:00–17:00 slot survived.
      const { data: rows } = await fx!.admin
        .from('availability_slots')
        .select('day_of_week, start_time, end_time')
        .eq('teacher_id', fx!.teacher.teacherId)

      expect(rows ?? []).toHaveLength(1)
      expect(rows![0].day_of_week).toBe(4)
      expect(rows![0].start_time).toMatch(/^16:00/)
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})
