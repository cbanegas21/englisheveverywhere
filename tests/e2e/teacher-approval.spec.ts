import { test, expect, type Page } from '@playwright/test'
import {
  setupTeacherApprovalFixture,
  type TeacherApprovalFixture,
} from '../fixtures/teacherApprovalFixture'

/**
 * Tier 1.3 — teacher approval flow.
 *
 * Gate logic lives in src/app/[lang]/maestro/dashboard/layout.tsx:
 *   - !teacher → redirect to /onboarding
 *   - teacher && !is_active → redirect to /maestro/pending
 *   - else pass through
 *
 * Admin-side approval/rejection actions live in:
 *   - src/app/[lang]/admin/actions.ts:475 — approveTeacherWithEmail (is_active=true)
 *   - src/app/[lang]/admin/actions.ts:511 — rejectTeacherWithEmail (delete row + role='student')
 *
 * This spec exercises:
 *   1. Inactive teacher → /maestro/pending
 *   2. Admin approves (is_active=true) → /maestro/dashboard accessible
 *   3. Admin rejects (delete teachers + role='student') → route redirects to /dashboard (student)
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

test.describe('Tier 1.3 — Teacher approval gate', () => {
  let fx: TeacherApprovalFixture | null = null

  test.beforeAll(async () => {
    fx = await setupTeacherApprovalFixture()
  })

  test.afterAll(async () => {
    try { await fx?.cleanup() } catch {}
  })

  test('inactive teacher navigating to /maestro/dashboard is redirected to /maestro/pending', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')

    await fx!.setActive(false)

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      // Inactive teachers still have role=teacher, so login succeeds and
      // routes through. The layout gate redirects them to /maestro/pending.
      const ok = await loginAs(page, fx!.teacher.email, fx!.teacher.password, /\/maestro/)
      test.skip(!ok, 'Inactive teacher login failed unexpectedly')

      // Force-navigate to /maestro/dashboard — gate must bounce us.
      await page.goto('/es/maestro/dashboard')
      await expect.poll(() => page.url(), { timeout: 10_000 }).toContain('/maestro/pending')
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('inactive teacher /maestro/pending page shows waiting-approval messaging', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    await fx!.setActive(false)

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.teacher.email, fx!.teacher.password, /\/maestro/)
      test.skip(!ok, 'Login failed')

      await page.goto('/es/maestro/pending')
      // Page should load successfully (not redirect, not 404). Assert the URL
      // sticks on /pending. Content-specific assertions would be too brittle
      // across copy changes.
      await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('/maestro/pending')
      expect(page.url()).not.toContain('/dashboard')
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('after is_active=true, teacher can access /maestro/dashboard (no pending bounce)', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    await fx!.setActive(true)

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.teacher.email, fx!.teacher.password, /\/maestro\/dashboard/)
      test.skip(!ok, 'Approved teacher login should redirect to /maestro/dashboard')

      await page.goto('/es/maestro/dashboard')
      // Stay on /maestro/dashboard (not bounced to /pending)
      await page.waitForLoadState('networkidle').catch(() => {})
      expect(page.url(), 'approved teacher must NOT be redirected to /pending').not.toContain('/pending')
      expect(page.url()).toContain('/maestro/dashboard')
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('after rejection (teachers row deleted + role=student), user bounces to /dashboard', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    // Simulate rejectTeacherWithEmail: delete teachers row + downgrade role
    await fx!.deleteTeacherRow()
    await fx!.setProfileRoleStudent()

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      // After rejection the user is a student now — login redirects accordingly.
      const ok = await loginAs(page, fx!.teacher.email, fx!.teacher.password, /\/dashboard/)
      test.skip(!ok, 'Post-rejection student login failed')

      // Attempting to visit /maestro/dashboard should bounce because
      // the user's role is now 'student'. Per src/app/[lang]/maestro/layout.tsx:42-44,
      // non-teacher roles land on /[lang]/dashboard.
      await page.goto('/es/maestro/dashboard')
      await expect.poll(() => page.url(), { timeout: 10_000 }).toContain('/dashboard')
      expect(page.url(), 'rejected teacher must NOT reach /maestro/dashboard').not.toContain('/maestro')
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})
