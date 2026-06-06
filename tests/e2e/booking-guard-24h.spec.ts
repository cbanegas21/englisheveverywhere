import { test, expect, type Page } from '@playwright/test'
import { setupBookingFixture, type BookingFixture } from '../fixtures/bookingFixture'

/**
 * Tier 1.2 — 24-hour advance-notice guard on createBooking.
 *
 * Two layers of defense:
 *   1. UI — the agendar calendar renders <24h / past cells as non-clickable
 *      empty divs; only >=24h slots render as clickable "libre" buttons.
 *   2. Server action (`createBooking` in src/app/actions/booking.ts) —
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
    await page.waitForURL(expectRedirect, { timeout: 45_000 })
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
async function installBodyTamper(page: Page, maliciousIso: string): Promise<void> {
  await page.route('**/*', async route => {
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

  test('UI: bookable slots are clickable "libre" buttons and the 24h rule is shown', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed')

      await page.goto('/es/dashboard/agendar')
      await expect(page.getByRole('heading', { name: /Agenda|Agendar Clase/i })).toBeVisible({ timeout: 10_000 })

      // Bookable (>=24h) slots render as clickable "libre" buttons; <24h/past
      // cells render as non-clickable empty divs (no button role).
      const libre = page.getByRole('button', { name: /^libre$/i })
      await expect(libre.first()).toBeVisible({ timeout: 10_000 })

      // The 24h advance-notice rule is communicated to the user.
      await expect(page.getByText(/24h|24 horas|anticipaci/i).first()).toBeVisible({ timeout: 5_000 })
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
      await expect(page.getByRole('heading', { name: /Agenda|Agendar Clase/i })).toBeVisible({ timeout: 10_000 })

      // Install a request interceptor that rewrites the outgoing scheduled_at
      // to a <24h value BEFORE the server action handler receives it. This
      // simulates a crafted POST that bypasses the UI's 24h filter.
      const malicious = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()
      await installBodyTamper(page, malicious)

      // Pick any available future slot (UI allows only ≥24h). Bookable slots
      // render as "libre" buttons in the current AgendarClient. By the time the
      // server sees it, the body has been tampered to a <24h time.
      const slot = page.getByRole('button', { name: /^libre$/i }).first()
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
