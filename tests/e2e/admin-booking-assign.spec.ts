import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, ROUTES } from '../fixtures/accounts'
import {
  setupBookingFixture,
  insertBooking,
  getBookingStatus,
  type BookingFixture,
} from '../fixtures/bookingFixture'

/**
 * Tier 1.8 — Admin booking assignment UI.
 *
 * The 2026-04-17 booking-flow redesign made `teacher_id` nullable: students
 * can reserve any ≥24h slot without picking a teacher, and the admin assigns
 * one from /admin/bookings afterward. If this assignment path is broken, every
 * pending booking strands forever — no existing spec covers it.
 *
 * Exercises `assignAndConfirmBooking(bookingId, teacherId)` end-to-end through
 * the UI:
 *
 *   admin login → /admin/bookings → "Pending Assignments" table → pick teacher
 *   in row → click Confirm
 *
 * Verifies both DB side-effects of the action:
 *   - bookings.teacher_id populated with the chosen teacher
 *   - bookings.status flipped pending → confirmed
 * And the UI echoes "Confirmed" in place of the picker.
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

test.describe('Tier 1.8 — Admin booking assignment', () => {
  let fx: BookingFixture | null = null
  let studentName: string | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(10)
    if (fx) {
      // The fixture doesn't surface the student's display name, but the
      // admin queue renders bookings by `profiles.full_name` — fetch it so we
      // can scope Playwright selectors to OUR row even when other pending
      // bookings exist on the page from prior runs.
      const { data } = await fx.admin
        .from('profiles')
        .select('full_name')
        .eq('id', fx.student.userId)
        .single()
      studentName = data?.full_name ?? null
    }
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('pending booking with teacher_id=null → admin picks teacher → DB confirmed + UI echoes', async ({ page }) => {
    test.skip(!fx, 'Booking fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')
    test.skip(!studentName, 'Could not resolve fixture student display name')
    // BookingAssign prompts `confirm("Assign anyway?")` when the server throws
    // "not available"/"primary teacher" (Bug #36 override UX). The fixture
    // teacher has no availability rows seeded, so the prompt always fires —
    // auto-accept mirrors the real admin clicking OK to force the assignment.
    page.on('dialog', d => { void d.accept() })
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, 'Admin creds not provisioned (check globalSetup)')

    // Insert a booking that looks exactly like what the student's createBooking
    // path produces under the new flow: pending status, teacher_id=null.
    const bookingId = await insertBooking(fx!, {
      assignTeacher: false,
      status: 'pending',
      type: 'class',
    })
    expect(bookingId, 'seed booking insert must succeed').toBeTruthy()

    await page.goto('/es/admin/bookings')
    await expect(page.getByRole('heading', { name: /^Bookings$/i })).toBeVisible({ timeout: 10_000 })

    // Scope the Pending Assignments section by its heading — other bookings
    // from prior runs may still be in the queue, so we find the <tr> that
    // matches our student's display name and interact only within it.
    const row = page.locator('tr', { hasText: studentName! })
    await expect(row, 'our pending booking must appear in the queue').toBeVisible({ timeout: 10_000 })

    // Pick the fixture teacher by id — safer than matching on full_name since
    // there may be multiple active teachers with similar names in the dropdown.
    const teacherSelect = row.locator('select')
    await expect(teacherSelect).toBeVisible({ timeout: 5_000 })
    await teacherSelect.selectOption(fx!.teacher.teacherId)

    await row.getByRole('button', { name: /^Confirm$/ }).click()

    // On success, BookingAssign swaps the picker for a green "Confirmed" badge
    // in the same row.
    await expect(row.getByText('Confirmed', { exact: true })).toBeVisible({ timeout: 10_000 })

    // DB invariants — teacher assigned and status flipped.
    await expect.poll(async () => getBookingStatus(fx!, bookingId!), {
      timeout: 10_000,
      message: 'assignAndConfirmBooking must flip status pending → confirmed',
    }).toBe('confirmed')

    const { data: row2 } = await fx!.admin
      .from('bookings')
      .select('teacher_id, status')
      .eq('id', bookingId!)
      .single()

    expect(row2?.teacher_id, 'teacher_id must equal the picked teacher').toBe(fx!.teacher.teacherId)
    expect(row2?.status).toBe('confirmed')
  })

  test('Confirm without picking a teacher → inline validation, no DB write', async ({ page }) => {
    test.skip(!fx, 'Booking fixture unavailable')
    test.skip(!studentName, 'Could not resolve fixture student display name')
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, 'Admin creds not provisioned')

    // Client-side guard in BookingAssign: handleConfirm shows
    // "Select a teacher first" if selectedTeacherId is empty. This test
    // verifies the guard is wired — a bypass would quietly call the server
    // action with teacherId="" and insert a broken row.
    const bookingId = await insertBooking(fx!, {
      assignTeacher: false,
      status: 'pending',
      type: 'class',
    })
    expect(bookingId).toBeTruthy()

    await page.goto('/es/admin/bookings')
    await expect(page.getByRole('heading', { name: /^Bookings$/i })).toBeVisible({ timeout: 10_000 })

    const row = page.locator('tr', { hasText: studentName! })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Don't touch the select. The Confirm button is `disabled` when
    // selectedTeacherId is empty (line 82 of BookingAssign.tsx), so this
    // also verifies the disabled state — a clickable empty-state would be
    // the actual regression.
    const confirmBtn = row.getByRole('button', { name: /^Confirm$/ })
    await expect(confirmBtn).toBeDisabled({ timeout: 5_000 })

    // DB unchanged — still pending, teacher still null.
    const status = await getBookingStatus(fx!, bookingId!)
    expect(status, 'status must remain pending when no teacher picked').toBe('pending')

    const { data: r } = await fx!.admin
      .from('bookings')
      .select('teacher_id')
      .eq('id', bookingId!)
      .single()
    expect(r?.teacher_id, 'teacher_id must remain null').toBeNull()
  })
})
