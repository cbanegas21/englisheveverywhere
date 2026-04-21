import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, ROUTES } from '../fixtures/accounts'
import {
  setupBookingFixture,
  type BookingFixture,
} from '../fixtures/bookingFixture'

/**
 * Tier 1.9 — Admin placement-test scheduling.
 *
 * Existing `admin-booking-assign.spec.ts` covers teacher assignment of pending
 * CLASS bookings (student-initiated → admin assigns teacher). What that spec
 * does NOT cover is the admin-initiated scheduling of a "Diagnostic call"
 * (type='placement_test'), which goes through `createAdminBooking` via the
 * MeetingScheduler modal and has different contract invariants:
 *
 *   - `type='placement_test'` (routes the room + UI differently)
 *   - `teacher_id` MUST be null (enforced by the
 *     `bookings_placement_no_teacher` CHECK constraint in migration 010)
 *   - `status='confirmed'` (admin schedules directly, no pending queue)
 *   - The booking should show up in the admin calendar as a placement_test
 *
 * This spec walks the 4-step MeetingScheduler end-to-end from the student
 * profile page to cover the UI, and adds a direct DB probe for the
 * `bookings_placement_no_teacher` constraint — the second-most-likely failure
 * mode is a future PR that accidentally drops that constraint (it's protecting
 * invariant-sensitive code in sala/page.tsx which dispatches on the
 * teacher_id/conductor_profile_id split).
 *
 * NOTE on conductor_profile_id: `createAdminBooking` does NOT currently set
 * it. Per migration 010, placement_test bookings start with
 * conductor_profile_id=null (the `idx_bookings_pending_placement_assignment`
 * index defines them as "pending" while null). No conductor-assignment action
 * exists yet — BookingCalendarClient renders them with an "Unassigned" badge.
 * So this spec asserts conductor_profile_id is null on freshly-scheduled rows
 * to document current behavior. When the assignment flow is wired, this
 * assertion should flip to: `conductor_profile_id === adminProfileId`.
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

test.describe('Tier 1.9 — Admin placement-test scheduling', () => {
  let fx: BookingFixture | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(10)
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('admin opens MeetingScheduler from student profile → walks 4 steps → placement_test row created with null teacher', async ({ page }) => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, 'Admin creds not provisioned (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD)')

    // Snapshot pre-existing placement_test rows for this student so we can
    // identify the NEW one after submit. Doing a fullrow comparison via
    // created_at desc would race with other tests in the same run.
    const { data: preRows } = await fx!.admin
      .from('bookings')
      .select('id')
      .eq('student_id', fx!.student.studentId)
      .eq('type', 'placement_test')
    const preIds = new Set((preRows ?? []).map(r => r.id))

    await page.goto(`/es/admin/students/${fx!.student.studentId}`)
    await page.getByRole('button', { name: /Schedule a call/i }).click()

    // Step 1 — Participants. For student_call the student is pre-filled and
    // canGoNext() returns true immediately. Teacher stays "Unassigned" which
    // is required for placement_test anyway.
    const nextBtn = page.getByRole('button', { name: /^Next$/ })
    await expect(nextBtn, 'Step 1 Next enabled (student pre-filled)').toBeEnabled({ timeout: 5_000 })
    await nextBtn.click()

    // Step 2 — Date & Time. Default selectedDayIdx=0 (first business day).
    // Pick the first ENABLED time slot — if earlier slots are "taken" from
    // leftover fixture rows they render with disabled=true, so
    // `button:not([disabled])` skips them automatically.
    const slot = page
      .getByRole('button')
      .filter({ hasText: /^\d{1,2}:00\s(AM|PM)$/ })
      .and(page.locator('button:not([disabled])'))
      .first()
    await expect(slot, 'at least one time slot must be pickable').toBeVisible({ timeout: 5_000 })
    await slot.click()
    await page.getByRole('button', { name: /^Next$/ }).click()

    // Step 3 — Meeting Type. Pick "Diagnostic call" which maps to
    // meetingType='placement_test'. Default duration=60 is fine.
    await page.getByRole('radio', { name: /Diagnostic call|placement_test/i })
      .or(page.locator('input[type="radio"][value="placement_test"]'))
      .first()
      .check()
    await page.getByRole('button', { name: /^Next$/ }).click()

    // Step 4 — Confirm. Submit button label is "Schedule meeting".
    await page.getByRole('button', { name: /Schedule meeting/i }).click()

    // On success the modal calls onSuccess → setShowScheduler(false) +
    // router.refresh(). Wait for the modal to disappear as the UI signal.
    await expect(page.getByRole('button', { name: /Schedule meeting/i }))
      .toHaveCount(0, { timeout: 10_000 })

    // DB invariants — find the NEW placement_test row for our fixture student.
    const { data: postRows } = await fx!.admin
      .from('bookings')
      .select('id, type, status, teacher_id, conductor_profile_id, student_id, duration_minutes')
      .eq('student_id', fx!.student.studentId)
      .eq('type', 'placement_test')
      .order('created_at', { ascending: false })
    const newRow = (postRows ?? []).find(r => !preIds.has(r.id))
    expect(newRow, 'new placement_test booking must exist').toBeTruthy()
    if (newRow) fx!.bookingIds.push(newRow.id)

    expect(newRow?.type).toBe('placement_test')
    expect(newRow?.status, 'admin-scheduled is confirmed (no pending queue)').toBe('confirmed')
    expect(newRow?.teacher_id, 'placement_test MUST have null teacher_id per CHECK constraint').toBeNull()
    expect(newRow?.duration_minutes).toBe(60)
    // Current design: conductor_profile_id is null — no assignment flow yet.
    // See header note. Flip to .toBe(adminProfileId) when that ships.
    expect(newRow?.conductor_profile_id, 'conductor assignment is not wired yet — stays null').toBeNull()
  })

  test('constraint: bookings_placement_no_teacher rejects placement_test with teacher_id set', async () => {
    test.skip(!fx, 'Fixture unavailable')

    // Direct INSERT bypasses the app layer — this is a pure DB constraint
    // guard. Migration 010 declares `bookings_placement_no_teacher` as a
    // CHECK constraint, but a 2026-04-20 live-DB probe showed the constraint
    // is ABSENT on production (pg_constraint shows only bookings_status_check).
    // That means placement_test rows can silently carry a teacher_id — the
    // sala page's participant gate would then start letting the WRONG teacher
    // into a placement room. See project_english_everywhere_bugs_found.md.
    //
    // This test asserts the constraint's enforcement. Currently expected to
    // FAIL until the constraint is re-applied. Self-cleans the orphan insert
    // so it doesn't pollute future runs regardless of pass/fail.
    const insertRes = await fx!.admin
      .from('bookings')
      .insert({
        student_id: fx!.student.studentId,
        teacher_id: fx!.teacher.teacherId,
        scheduled_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        duration_minutes: 60,
        status: 'confirmed',
        type: 'placement_test',
      })
      .select('id')
      .single()

    const orphanId = insertRes.data?.id
    try {
      expect(
        insertRes.error,
        'insert should fail — placement_test + teacher_id violates bookings_placement_no_teacher',
      ).toBeTruthy()
      expect(insertRes.error?.message ?? '').toMatch(/bookings_placement_no_teacher|check constraint/i)
    } finally {
      // Always clean up — if the assertion passes there's no row; if it fails
      // the insert slipped through and we must delete it so the next run
      // starts from a clean state.
      if (orphanId) {
        await fx!.admin.from('bookings').delete().eq('id', orphanId)
      }
    }
  })
})
