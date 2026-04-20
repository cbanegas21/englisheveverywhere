import { test, expect } from '@playwright/test'

// The /sala/:bookingId route is gated by auth + participation checks on the
// server. These tests verify the gate behavior without requiring a live
// LiveKit session.

test.describe('Video room (sala) — gating', () => {
  test('unauth hitting /sala/:id redirects to /login', async ({ page }) => {
    await page.goto('/es/sala/nonexistent-booking-id')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('/sala with a nonsense id renders without client errors (shows error screen or redirect)', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/es/sala/00000000-0000-0000-0000-000000000000')
    // Either redirect to /login (unauth) or render the error screen.
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    expect(errors, `Client errors:\n${errors.join('\n')}`).toHaveLength(0)
  })
})
