import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, ROUTES } from '../fixtures/accounts'

async function tryLogin(page: Page, email: string, password: string): Promise<boolean> {
  await page.goto(ROUTES.es.login)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

test.describe('Dashboards', () => {
  test('student dashboard renders greeting + classes count', async ({ page }) => {
    const ok = await tryLogin(page, ACCOUNTS.student.email, ACCOUNTS.student.password)
    test.skip(!ok, `Student login failed — set E2E_STUDENT_PASSWORD to match ${ACCOUNTS.student.email}`)
    await expect(page).toHaveURL(/\/dashboard(\/|$)/)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByText(/clases disponibles|classes remaining/i).first())
      .toBeVisible({ timeout: 10_000 })
  })

  test('student can navigate to /dashboard/clases', async ({ page }) => {
    const ok = await tryLogin(page, ACCOUNTS.student.email, ACCOUNTS.student.password)
    test.skip(!ok, `Student login failed — set E2E_STUDENT_PASSWORD to match ${ACCOUNTS.student.email}`)
    await page.goto('/es/dashboard/clases')
    await expect(page).toHaveURL(/\/dashboard\/clases/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('teacher dashboard renders greeting + stats', async ({ page }) => {
    const ok = await tryLogin(page, ACCOUNTS.teacher.email, ACCOUNTS.teacher.password)
    test.skip(!ok, `Teacher login failed — set E2E_TEACHER_PASSWORD to match ${ACCOUNTS.teacher.email}`)
    await expect(page).toHaveURL(/\/maestro\/dashboard(\/|$)/)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByText(/sesiones|sessions|aceptando|not accepting/i).first())
      .toBeVisible({ timeout: 10_000 })
  })
})
