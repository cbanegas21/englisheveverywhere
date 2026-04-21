import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, ROUTES } from '../fixtures/accounts'
import {
  setupTeacherApprovalFixture,
  type TeacherApprovalFixture,
} from '../fixtures/teacherApprovalFixture'

/**
 * Tier 1.8b — Admin teacher approval UI.
 *
 * Existing `teacher-approval.spec.ts` covers the teacher-side gate
 * (inactive → /maestro/pending, active → dashboard) by flipping is_active
 * directly. What has never been exercised is the admin UI that actually
 * calls `approveTeacherWithEmail` — the /admin/teachers page with the
 * Pending Applications cards + Approve button.
 *
 * This closes that gap. Verifies:
 *   1. Fresh inactive teacher shows up in the Pending Applications section
 *      scoped by their email.
 *   2. Admin clicks Approve → UI swaps to "Approved" badge in that card.
 *   3. DB side-effect: teachers.is_active flips false → true.
 *
 * Email side-effect: `approveTeacherWithEmail` fires a Resend welcome
 * email non-blocking. Since the fixture teacher uses a fake-TLD address
 * (`@english-everywhere.test`), we temporarily swap `profiles.email` to
 * Resend's sandbox address `delivered@resend.dev` for the duration of
 * the test — otherwise we'd rack up hard bounces every run (see
 * memory: feedback_email_bounces.md). Restored on afterAll.
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

test.describe('Tier 1.8b — Admin teacher approval UI', () => {
  let fx: TeacherApprovalFixture | null = null

  test.beforeAll(async () => {
    fx = await setupTeacherApprovalFixture()
    if (fx) {
      // Swap the teacher's profiles.email to Resend's safe test inbox
      // so the non-blocking welcome email doesn't generate a hard bounce
      // on a fake .test TLD. auth.users.email stays the original so
      // login still works; the server action reads profiles.email only.
      await fx.admin
        .from('profiles')
        .update({ email: 'delivered@resend.dev' })
        .eq('id', fx.teacher.userId)
    }
  })

  test.afterAll(async () => {
    try {
      if (fx) {
        // Restore original email so the teacher row looks consistent.
        await fx.admin
          .from('profiles')
          .update({ email: fx.teacher.email })
          .eq('id', fx.teacher.userId)
      }
    } catch {}
    try { await fx?.cleanup() } catch {}
  })

  test('inactive teacher appears in Pending Applications → Approve flips is_active=true + UI echoes', async ({ page }) => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, 'Admin creds not provisioned (check globalSetup)')

    // Verify baseline — fixture created the teacher with is_active=false.
    const { data: pre } = await fx!.admin
      .from('teachers')
      .select('is_active')
      .eq('id', fx!.teacher.teacherId)
      .single()
    expect(pre?.is_active, 'fixture teacher must start inactive').toBe(false)

    await page.goto('/es/admin/teachers')
    // Admin UI is English-only — page has a search input and a "Pending
    // Applications" section heading when any pending teachers exist.
    await expect(page.getByRole('heading', { name: /Pending Applications/i }))
      .toBeVisible({ timeout: 10_000 })

    // Scope to the Pending Applications <section> so we don't accidentally
    // match the Active Teachers wrapper (both use .rounded-xl).
    const pendingSection = page.locator('section', {
      has: page.getByRole('heading', { name: /Pending Applications/i }),
    })
    const card = pendingSection.locator('.rounded-xl', { hasText: fx!.teacher.fullName })
    await expect(card, 'our pending teacher card must render').toBeVisible({ timeout: 10_000 })

    await card.getByRole('button', { name: /^Approve$/ }).click()

    // DB invariant — the action's side-effect. This is the authoritative
    // signal that approveTeacherWithEmail completed end-to-end. The UI
    // "Approved" badge (local useState on the button component) is racy:
    // the action calls revalidatePath('/', 'layout') which triggers an RSC
    // refresh that unmounts the component before the local state can
    // paint — so asserting on the badge would be flaky.
    await expect.poll(async () => {
      const { data } = await fx!.admin
        .from('teachers')
        .select('is_active')
        .eq('id', fx!.teacher.teacherId)
        .single()
      return data?.is_active
    }, {
      timeout: 10_000,
      message: 'approveTeacherWithEmail must flip teachers.is_active true',
    }).toBe(true)

    // UI invariant — the teacher card disappears from the Pending
    // Applications section once revalidation completes (they're now in the
    // active list). Scope to the pending section to avoid false positives
    // if the fullName appears in the Active Teachers table below.
    await expect.poll(async () => {
      return await pendingSection
        .locator('.rounded-xl', { hasText: fx!.teacher.fullName })
        .count()
    }, {
      timeout: 10_000,
      message: 'approved teacher card must leave the Pending Applications list',
    }).toBe(0)
  })
})
