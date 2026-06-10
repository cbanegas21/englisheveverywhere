/**
 * AD-03 Phase 4 visual capture — unassigned inbox rail + availability overlay.
 * Single in-context login (avoids the flaky storageState restore). Read-only.
 * Run against local dev: PLAYWRIGHT_BASE_URL=http://localhost:3000 node scripts/qa-shot-p4.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const ADMIN = { email: 'admin@englishkolab.com', password: 'Maxine2021.' }
const OUT = join(tmpdir(), 'ad03-p4-shots')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const shots = []
async function shot(page, name) {
  const path = join(OUT, name)
  await page.screenshot({ path, fullPage: true })
  shots.push(path)
  console.log(`  saved ${path}`)
}
async function login(ctx) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="email"]', ADMIN.email)
  await page.fill('input[name="password"]', ADMIN.password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  await page.waitForURL(/\/(es|en)\/admin/, { timeout: 40000 }).catch(() => {})
  await page.waitForTimeout(1500)
  return page
}

// ── Desktop ES: full page (inbox rail) + single-teacher overlay ────────────────
const desktop = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
const dp = await login(desktop)
console.log(`logged in -> ${dp.url()}`)

await dp.goto(`${BASE}/es/admin/bookings`, { waitUntil: 'domcontentloaded' })
await dp.waitForTimeout(2800)
await shot(dp, '01-es-rail.png')
console.log('  inbox cards:', await dp.locator('[data-ek-inbox]').count(), '| teachers:', await dp.locator('.ad03-filter input[type=checkbox]').count())

// Trigger availability overlay: uncheck "all", then check the first individual teacher.
const boxes = dp.locator('.ad03-filter input[type=checkbox]')
const nBoxes = await boxes.count()
if (nBoxes > 1) {
  await boxes.nth(0).uncheck().catch(() => {})           // clear "All teachers"
  await dp.waitForTimeout(300)
  await boxes.nth(1).check().catch(() => {})             // first real teacher
  await dp.waitForTimeout(700)
  await shot(dp, '02-es-overlay.png')
}

// EN
await dp.goto(`${BASE}/en/admin/bookings`, { waitUntil: 'domcontentloaded' })
await dp.waitForTimeout(2800)
await shot(dp, '03-en-rail.png')

// ── Mobile ES (stacked: calendar → inbox → filter) ─────────────────────────────
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const mp = await login(mobile)
await mp.goto(`${BASE}/es/admin/bookings`, { waitUntil: 'domcontentloaded' })
await mp.waitForTimeout(2800)
await shot(mp, '04-es-mobile.png')

await browser.close()
console.log(`\nDONE — ${shots.length} shots in ${OUT}`)
