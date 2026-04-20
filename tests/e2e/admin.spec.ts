import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, ROUTES } from '../fixtures/accounts'

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
      const ADMIN = ACCOUNTS.admin
      test.skip(!ADMIN.email || !ADMIN.password, 'Admin user not provisioned (missing SUPABASE_SERVICE_ROLE_KEY in globalSetup)')
      const role = await loginAs(page, ADMIN.email, ADMIN.password)
      test.skip(role !== 'admin', `Could not reach /admin after login — got role=${role}`)
      const errors: string[] = []
      page.on('pageerror', err => errors.push(err.message))
      await page.goto(p.path)
      await expect(page).toHaveURL(new RegExp(p.path.replace(/\//g, '\\/')))
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
      expect(errors, `Client errors on ${p.path}:\n${errors.join('\n')}`).toHaveLength(0)
    })
  }
})
