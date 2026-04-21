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
 * MeetingScheduler modal.
 *
 * HISTORICAL NOTE — teacher_id + placement_test:
 *   Migration 010 originally declared a `bookings_placement_no_teacher` CHECK
 *   constraint that forbade a non-null teacher_id on placement rows (the
 *   design at that point was admin-conducted placements via
 *   conductor_profile_id). Migration 012 dropped that constraint because the
 *   design was reverted — placement calls are now conducted by teachers,
 *   identical to class bookings. So `teacher_id` CAN be non-null on a
 *   placement_test row today. The MeetingScheduler UI leaves it unassigned by
 *   default (admin picks a teacher on step 1, or skips), and this spec's UI
 *   walkthrough skips that selection, so the created row ends up with
 *   teacher_id=null — but that is a product-of-the-walkthrough assertion, not
 *   a DB invariant.
 *
 * Contract invariants the spec still guards:
 *   - `type='placement_test'` (routes the room + UI differently)
 *   - `status='confirmed'` (admin schedules directly, no pending queue)
 *   - `duration_minutes=60` (default from the scheduler)
 *
 * NOTE on conductor_profile_id: `createAdminBooking` does NOT currently set
 * it. `idx_bookings_pending_placement_assignment` indexes placement rows that
 * are null-conductor as "pending". No conductor-assignment action exists yet
 * — BookingCalendarClient renders them with an "Unassigned" badge.
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

    // Wait for the modal itself to unmount. We used to wait on the submit
    // button by name /Schedule meeting/i, but during the server action the
    // button label flips to "Scheduling…" — the name query then returns 0
    // matches instantly and the DB read races ahead of the insert. The
    // modal heading only disappears when onSuccess → setShowScheduler(false)
    // fires, i.e. after createAdminBooking has resolved.
    await expect(page.getByRole('heading', { name: /Schedule a Meeting/i }))
      .toHaveCount(0, { timeout: 15_000 })

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
    // teacher_id is null here because the walkthrough left teacher "Unassigned"
    // on step 1; not a DB-level invariant anymore (migration 012 dropped the
    // CHECK constraint when placements moved to teacher-conducted).
    expect(newRow?.teacher_id, 'walkthrough skipped teacher selection → stays null').toBeNull()
    expect(newRow?.duration_minutes).toBe(60)
    // Current design: conductor_profile_id is null — no assignment flow yet.
    // See header note. Flip to .toBe(adminProfileId) when that ships.
    expect(newRow?.conductor_profile_id, 'conductor assignment is not wired yet — stays null').toBeNull()
  })

  test('contract: placement_test row with teacher_id set is ALLOWED (migration 012 reverted the CHECK)', async () => {
    test.skip(!fx, 'Fixture unavailable')

    // Migration 012_drop_placement_no_teacher_constraint.sql explicitly dropped
    // the `bookings_placement_no_teacher` CHECK. Placements are now conducted
    // by teachers exactly like class bookings. This test locks that revert in
    // — if a future migration RE-adds the constraint (e.g., during a DB reset
    // or mis-applied schema.sql), this insert would start failing and the
    // regression would be caught before the admin calendar starts losing rows.
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

    const insertedId = insertRes.data?.id
    try {
      expect(
        insertRes.error,
        'insert should succeed — constraint was intentionally dropped in migration 012',
      ).toBeNull()
      expect(insertedId, 'inserted row must have an id').toBeTruthy()
    } finally {
      if (insertedId) {
        await fx!.admin.from('bookings').delete().eq('id', insertedId)
      }
    }
  })
})
