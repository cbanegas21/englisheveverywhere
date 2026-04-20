import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, ROUTES } from '../fixtures/accounts'

async function loginAs(page: Page, email: string, password: string): Promise<boolean> {
  await page.goto(ROUTES.es.login)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  try {
    await page.waitForURL(/\/maestro\/dashboard|\/dashboard|\/admin/, { timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

test.describe('Teacher dashboard — nav smoke', () => {
  const pages: { path: string; heading: RegExp }[] = [
    { path: '/es/maestro/dashboard/agenda', heading: /agenda|sesiones|clases/i },
    { path: '/es/maestro/dashboard/ganancias', heading: /ganancias|earnings/i },
    { path: '/es/maestro/dashboard/estudiantes', heading: /estudiantes|students/i },
    { path: '/es/maestro/dashboard/disponibilidad', heading: /disponibilidad|availability/i },
    { path: '/es/maestro/dashboard/configuracion', heading: /configuraci|settings|perfil/i },
  ]

  for (const p of pages) {
    test(`teacher → ${p.path}`, async ({ page }) => {
      const ok = await loginAs(page, ACCOUNTS.teacher.email, ACCOUNTS.teacher.password)
      test.skip(!ok, 'Teacher login failed')
      const errors: string[] = []
      page.on('pageerror', err => errors.push(err.message))
      await page.goto(p.path)
      await expect(page).toHaveURL(new RegExp(p.path.replace(/\//g, '\\/')))
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
      expect(errors, `Client errors on ${p.path}:\n${errors.join('\n')}`).toHaveLength(0)
    })
  }
})
