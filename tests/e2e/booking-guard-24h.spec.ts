import { test, expect, type Page } from '@playwright/test'
import { setupBookingFixture, type BookingFixture } from '../fixtures/bookingFixture'

/**
 * Tier 1.2 — 24-hour advance-notice guard on createBooking.
 *
 * Two layers of defense:
 *   1. UI — agendar calendar disables <24h cells (renders "Muy pronto").
 *   2. Server action (`createBooking` in src/app/actions/booking.ts:60-68) —
 *      explicit `scheduledDate < minAllowed` check as defense-in-depth.
 *
 * We test both. UI alone is not enough: a crafted POST could bypass the
 * client-side disabled state.
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

/**
 * Rewrites the outbound createBooking multipart body to use a <24h
 * `scheduled_at` — simulates a client tampering with the form before sending.
 * The server action's defense-in-depth guard must reject it.
 */
function installBodyTamper(page: Page, maliciousIso: string): Promise<void> {
  return page.route('**/*', async route => {
    const req = route.request()
    if (req.method() !== 'POST' || !(req.headers()['next-action'] ?? '')) {
      return route.continue()
    }
    const body = req.postData() ?? ''
    // Multipart bodies contain `name="scheduled_at"\r\n\r\n<iso>\r\n`.
    // Replace the ISO value between the two \r\n markers.
    const patched = body.replace(
      /(name="scheduled_at"\r\n\r\n)[^\r]*(\r\n)/,
      `$1${maliciousIso}$2`,
    )
    await route.continue({ postData: patched })
  })
}

test.describe('Tier 1.2 — 24-hour booking guard', () => {
  let fx: BookingFixture | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(10)
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('UI: <24h slots render as "Muy pronto" and are NOT clickable buttons', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed')

      await page.goto('/es/dashboard/agendar')
      await expect(page.getByRole('heading', { name: /Agendar Clase/i })).toBeVisible({ timeout: 10_000 })

      // The current hour (or next few hours) are <24h away. They must be
      // rendered as "Muy pronto" divs, NOT as <button>.
      const tooSoonCells = page.getByText('Muy pronto')
      await expect(tooSoonCells.first()).toBeVisible({ timeout: 5_000 })
      expect(await tooSoonCells.count(), 'multiple <24h slots visible in this week').toBeGreaterThan(0)

      // Verify a "Muy pronto" cell's parent is NOT a button (unclickable).
      const cellHandle = await tooSoonCells.first().elementHandle()
      expect(cellHandle).toBeTruthy()
      const isInButton = await cellHandle!.evaluate(el => !!el.closest('button'))
      expect(isInButton, '"Muy pronto" cell must not be wrapped in a <button>').toBe(false)
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('server: createBooking rejects <24h scheduled_at even when client body is tampered', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed')

      await page.goto('/es/dashboard/agendar')
      await expect(page.getByRole('heading', { name: /Agendar Clase/i })).toBeVisible({ timeout: 10_000 })

      // Install a request interceptor that rewrites the outgoing scheduled_at
      // to a <24h value BEFORE the server action handler receives it. This
      // simulates a crafted POST that bypasses the UI's 24h filter.
      const malicious = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()
      await installBodyTamper(page, malicious)

      // Pick any available future slot (UI allows only ≥24h). Slot buttons
      // display "9 AM" / "3 PM" format per hourLabel() in AgendarClient.
      // By the time the server sees it, the body has been tampered.
      const slot = page.getByRole('button', { name: /^\d{1,2}\s(AM|PM)$/i }).first()
      await expect(slot).toBeVisible({ timeout: 10_000 })
      await slot.click()

      const confirmBtn = page.getByRole('button', { name: /Confirmar reserva/i })
      await expect(confirmBtn).toBeEnabled({ timeout: 5_000 })
      await confirmBtn.click()

      // Server action should reject → the UI displays `result.error` string
      // (see AgendarClient.tsx:211). The 24h error message should appear.
      const errorBanner = page.getByText(/24 horas|24 hours/i)
      await expect(errorBanner.first()).toBeVisible({ timeout: 10_000 })

      // Double-check: no booking persisted at the malicious time.
      const { data } = await fx!.admin
        .from('bookings')
        .select('id, status')
        .eq('student_id', fx!.student.studentId)
        .eq('scheduled_at', malicious)
      expect(data ?? [], 'server must not have persisted the <24h booking').toHaveLength(0)
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})
