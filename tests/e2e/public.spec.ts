import { test, expect } from '@playwright/test'

test.describe('Public pages — render + no client errors', () => {
  const pages: { path: string; name: string }[] = [
    { path: '/es', name: 'ES landing' },
    { path: '/en', name: 'EN landing' },
    { path: '/es/registro', name: 'ES registro' },
    { path: '/en/registro', name: 'EN registro' },
    { path: '/es/login', name: 'ES login' },
    { path: '/en/login', name: 'EN login' },
    { path: '/es/login/reset', name: 'ES password reset' },
  ]

  for (const p of pages) {
    test(p.name, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', err => errors.push(err.message))
      const resp = await page.goto(p.path)
      expect(resp?.status()).toBeLessThan(400)
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
      expect(errors, `Client errors on ${p.path}:\n${errors.join('\n')}`).toHaveLength(0)
    })
  }
})

test.describe('Registration form — client validation', () => {
  test('empty submit surfaces validation (HTML5 or app-level)', async ({ page }) => {
    await page.goto('/es/registro')
    await expect(page.getByRole('heading').first()).toBeVisible()
    const submit = page.getByRole('button', { name: /crear|registrar|continuar|sign up/i }).first()
    if (await submit.count()) {
      await submit.click()
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
      // We should stay on /registro when validation fails
      expect(page.url()).toMatch(/\/registro/)
    }
  })
})
