import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002'
const OUT = join(tmpdir(), 'ek-login'); mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newContext({ viewport: { width: 1100, height: 820 } }).then(c => c.newPage())

await page.goto(`${BASE}/es/login`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
const checkboxes = await page.locator('form input[type="checkbox"]').count()
console.log('checkboxes on login form:', checkboxes, '(expect 0)')
await page.screenshot({ path: join(OUT, 'login.png') })

await page.fill('input[name="email"]', 'admin@englishkolab.com')
await page.fill('input[name="password"]', 'Maxine2021.')
await page.getByRole('button', { name: /ingresar|log in/i }).click()
await page.waitForURL(/\/(es|en)\/admin/, { timeout: 40000 }).catch(() => {})
await page.waitForTimeout(1500)
console.log('after login ->', page.url())

// Navigate within the app — the new proxy must NOT bounce an active session.
await page.goto(`${BASE}/es/admin/bookings`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
console.log('after navigate ->', page.url(), page.url().includes('/admin/bookings') ? 'OK (stayed)' : 'BOUNCED')

await browser.close()
