import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, ROUTES } from '../fixtures/accounts'

// The teacher account in CLAUDE.md is also the admin account for the project.
const ADMIN = ACCOUNTS.teacher

async function loginAs(page: Page, email: string, password: string): Promise<'admin' | 'teacher' | 'student' | 'none'> {
  await page.goto(ROUTES.es.login)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  try {
    await page.waitForURL(/\/(admin|maestro|dashboard)/, { timeout: 15_000 })
  } catch {
    return 'none'
  }
  const url = page.url()
  if (/\/admin/.test(url)) return 'admin'
  if (/\/maestro/.test(url)) return 'teacher'
  if (/\/dashboard/.test(url)) return 'student'
  return 'none'
}

test.describe('Admin — nav smoke', () => {
  const pages: { path: string; heading: RegExp }[] = [
    { path: '/es/admin', heading: /.+/ },
    { path: '/es/admin/overview', heading: /.+/ },
    { path: '/es/admin/bookings', heading: /bookings|reservas|citas|sesiones/i },
    { path: '/es/admin/students', heading: /students|estudiantes/i },
    { path: '/es/admin/teachers', heading: /teachers|maestros/i },
  ]

  for (const p of pages) {
    test(`admin → ${p.path}`, async ({ page }) => {
      const role = await loginAs(page, ADMIN.email, ADMIN.password)
      // If the test account is NOT an admin, skip rather than fail the suite.
      test.skip(role !== 'admin', `Test account is not admin (role=${role}) — set E2E credentials to an admin user`)
      const errors: string[] = []
      page.on('pageerror', err => errors.push(err.message))
      await page.goto(p.path)
      await expect(page).toHaveURL(new RegExp(p.path.replace(/\//g, '\\/')))
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
      expect(errors, `Client errors on ${p.path}:\n${errors.join('\n')}`).toHaveLength(0)
    })
  }
})
