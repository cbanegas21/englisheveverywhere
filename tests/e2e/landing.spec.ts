import { test, expect } from '@playwright/test'

test.describe('Marketing / landing', () => {
  test('root redirects to /es', async ({ page }) => {
    const response = await page.goto('/')
    await expect(page).toHaveURL(/\/es(\/|$)/)
    expect(response?.status()).toBeLessThan(400)
  })

  test('ES landing renders without client errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/es')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    expect(errors, `Client errors:\n${errors.join('\n')}`).toHaveLength(0)
  })

  test('EN landing renders without client errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/en')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    expect(errors, `Client errors:\n${errors.join('\n')}`).toHaveLength(0)
  })
})
