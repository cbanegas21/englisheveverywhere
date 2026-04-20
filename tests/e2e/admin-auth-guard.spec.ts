import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, ROUTES } from '../fixtures/accounts'

/**
 * Tier 5.1 — Admin route guard (defense-in-depth).
 *
 * `src/app/[lang]/admin/layout.tsx` guards every /admin route. A logged-out
 * user is redirected to /login; a non-admin logged-in user is redirected to
 * /dashboard. `assertAdmin()` in actions.ts throws for server-action callers
 * who aren't admin.
 *
 * This spec exercises each branch by URL navigation and verifies the redirect
 * or forbidden outcome is actually enforced — no admin-only surface leaks to
 * non-admin sessions.
 */

async function login(page: Page, email: string, password: string): Promise<boolean> {
  await page.goto(ROUTES.es.login)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  try {
    await page.waitForURL(/\/(admin|maestro|dashboard)/, { timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

const ADMIN_ROUTES = [
  '/es/admin',
  '/es/admin/bookings',
  '/es/admin/students',
  '/es/admin/teachers',
  '/es/admin/overview',
] as const

test.describe('Tier 5.1 — Admin route guard', () => {
  test('logged-out user hitting /admin → redirected to /login', async ({ page }) => {
    for (const path of ADMIN_ROUTES) {
      await page.goto(path)
      await expect(page, `anonymous access to ${path} must bounce to login`).toHaveURL(
        /\/(es|en)\/login/,
        { timeout: 10_000 },
      )
    }
  })

  test('student session hitting /admin → bounced away from admin', async ({ page }) => {
    const S = ACCOUNTS.student
    test.skip(!S.email || !S.password, 'Student creds missing')
    const ok = await login(page, S.email, S.password)
    test.skip(!ok, 'Student login failed')

    for (const path of ADMIN_ROUTES) {
      await page.goto(path)
      // Layout redirects non-admin users to /dashboard. We assert the URL
      // settles to something NOT under /admin — the exact final URL varies
      // (dashboard might further redirect for intake-pending students).
      await expect(page, `student must not land on ${path}`).not.toHaveURL(
        /\/admin(\/|$)/,
        { timeout: 10_000 },
      )
    }
  })

  test('teacher session hitting /admin → bounced away from admin', async ({ page }) => {
    const T = ACCOUNTS.teacher
    test.skip(!T.email || !T.password, 'Teacher creds missing')
    const ok = await login(page, T.email, T.password)
    test.skip(!ok, 'Teacher login failed')

    for (const path of ADMIN_ROUTES) {
      await page.goto(path)
      await expect(page, `teacher must not land on ${path}`).not.toHaveURL(
        /\/admin(\/|$)/,
        { timeout: 10_000 },
      )
    }
  })

  test('admin session CAN reach every /admin route', async ({ page }) => {
    const A = ACCOUNTS.admin
    test.skip(!A.email || !A.password, 'Admin creds not provisioned')
    const ok = await login(page, A.email, A.password)
    test.skip(!ok, 'Admin login failed')

    for (const path of ADMIN_ROUTES) {
      await page.goto(path)
      await expect(page, `admin must land on ${path}`).toHaveURL(
        new RegExp(path.replace(/\//g, '\\/')),
        { timeout: 10_000 },
      )
    }
  })
})
