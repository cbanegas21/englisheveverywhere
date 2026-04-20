import { test, expect } from '@playwright/test'
import { ROUTES } from '../fixtures/accounts'

test.describe('Auth guards (security)', () => {
  test('unauth access to /dashboard redirects to /login', async ({ page }) => {
    await page.goto(ROUTES.es.studentDashboard)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('unauth access to /maestro/dashboard redirects to /login', async ({ page }) => {
    await page.goto(ROUTES.es.teacherDashboard)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('unauth access to /admin redirects to /login', async ({ page }) => {
    await page.goto(ROUTES.es.adminDashboard)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
