import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEACHER = { email: 'lesly@englishkolab.com', password: 'Honduras2024!' }
const OUT = join(tmpdir(), 'ek-ganancias'); mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()

async function login(ctx) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="email"]', TEACHER.email)
  await page.fill('input[name="password"]', TEACHER.password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  await page.waitForURL(/\/(es|en)\/maestro/, { timeout: 40000 }).catch(() => {})
  await page.waitForTimeout(1500)
  return page
}

const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } })
const page = await login(ctx)
console.log('logged in ->', page.url())
for (const lang of ['es', 'en']) {
  await page.goto(`${BASE}/${lang}/maestro/dashboard/ganancias`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await page.screenshot({ path: join(OUT, `${lang}.png`), fullPage: true })
  console.log('saved', join(OUT, `${lang}.png`))
}
await browser.close()
