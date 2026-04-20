import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, ROUTES } from '../fixtures/accounts'
import {
  setupBookingFixture,
  insertBooking,
  getBookingStatus,
  getClassesRemaining,
  setClassesRemaining,
  type BookingFixture,
} from '../fixtures/bookingFixture'

/**
 * Tier 1.7 — Admin refund flow (end-to-end through the UI).
 *
 * Exercises `cancelBookingWithRefund` from the admin UI:
 *   admin login → /admin/students/[id] → Classes tab → Cancel → confirm modal
 * Verifies:
 *   - booking.status flips to 'cancelled'
 *   - students.classes_remaining increments by exactly 1 (atomic RPC path
 *     fixed in Tier 1.6 — this is the UI-driven companion)
 *   - Non-class bookings (placement) do NOT refund a class credit
 */

async function loginAsAdmin(page: Page): Promise<boolean> {
  const { email, password } = ACCOUNTS.admin
  if (!email || !password) return false
  await page.goto(ROUTES.es.login)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  try {
    await page.waitForURL(/\/admin/, { timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

test.describe('Tier 1.7 — Admin cancel-with-refund', () => {
  let fx: BookingFixture | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(5)
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('class booking: admin cancels → status=cancelled AND classes_remaining +1', async ({ page }) => {
    test.skip(!fx, 'Booking fixture unavailable (missing service role)')
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, 'Admin creds not provisioned')

    // Baseline: create a confirmed class booking, set classes_remaining=5 so we
    // can assert the +1 precisely after the refund.
    await setClassesRemaining(fx!, 5)
    const bookingId = await insertBooking(fx!, { status: 'confirmed', type: 'class' })
    expect(bookingId, 'booking insert must succeed').toBeTruthy()

    await page.goto(`/es/admin/students/${fx!.student.studentId}`)
    // Wait for the Overview tab button (always rendered first) as the ready signal.
    await expect(page.getByRole('button', { name: 'Overview', exact: true }))
      .toBeVisible({ timeout: 10_000 })

    // Switch to the Classes tab.
    await page.getByRole('button', { name: 'Classes', exact: true }).click()

    // The row we just created has status=Confirmed → the red "Cancel" button
    // appears. There may be other rows for historic bookings; scope by the
    // current confirmed row using a nth-match on Cancel buttons is brittle.
    // Instead, disambiguate: we just created the only confirmed booking for
    // this freshly-provisioned student, so a single Cancel button is expected.
    const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true })
    await expect(cancelBtn).toHaveCount(1, { timeout: 5_000 })
    await cancelBtn.click()

    // Confirmation modal.
    await expect(page.getByText('Cancel this booking?')).toBeVisible()
    await page.getByRole('button', { name: 'Yes, cancel' }).click()

    // Toast should show success.
    await expect(page.getByText('Booking cancelled')).toBeVisible({ timeout: 10_000 })

    // DB verification — booking flipped and credit was returned.
    await expect.poll(async () => getBookingStatus(fx!, bookingId!), {
      timeout: 10_000,
      message: 'booking.status should become cancelled',
    }).toBe('cancelled')

    await expect.poll(async () => getClassesRemaining(fx!), {
      timeout: 10_000,
      message: 'classes_remaining should increment by exactly 1 (5 → 6)',
    }).toBe(6)
  })

  test('placement booking: admin cancels → status=cancelled BUT classes_remaining unchanged', async ({ page }) => {
    test.skip(!fx, 'Booking fixture unavailable')
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, 'Admin creds not provisioned')

    // `cancelBookingWithRefund` only refunds when booking.type === 'class'.
    // Placement tests are free — no class credit was decremented on creation,
    // so none should be returned on cancellation.
    await setClassesRemaining(fx!, 7)
    const bookingId = await insertBooking(fx!, { status: 'confirmed', type: 'placement_test' })
    expect(bookingId).toBeTruthy()

    await page.goto(`/es/admin/students/${fx!.student.studentId}`)
    // Wait for the Overview tab button (always rendered first) as the ready signal.
    await expect(page.getByRole('button', { name: 'Overview', exact: true }))
      .toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Classes', exact: true }).click()

    const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true })
    await expect(cancelBtn).toHaveCount(1, { timeout: 5_000 })
    await cancelBtn.click()
    await page.getByRole('button', { name: 'Yes, cancel' }).click()
    await expect(page.getByText('Booking cancelled')).toBeVisible({ timeout: 10_000 })

    await expect.poll(async () => getBookingStatus(fx!, bookingId!), { timeout: 10_000 })
      .toBe('cancelled')

    // No refund for placement.
    await expect.poll(async () => getClassesRemaining(fx!), {
      timeout: 5_000,
      message: 'placement cancellation must NOT credit classes_remaining',
    }).toBe(7)
  })
})
