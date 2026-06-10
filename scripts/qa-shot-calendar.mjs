/**
 * AD-03 Phase 1 visual capture. Logs in as admin in ONE context (avoids the flaky
 * storageState restore), then screenshots /admin/bookings in ES + EN (desktop) and
 * ES (mobile), plus the booking-detail Drawer. Read-only (single login; no writes).
 * Run against local dev: PLAYWRIGHT_BASE_URL=http://localhost:3000 node scripts/qa-shot-calendar.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const ADMIN = { email: 'admin@englishkolab.com', password: 'Maxine2021.' }
const OUT = join(tmpdir(), 'ad03-shots')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

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

const shots = []
async function shot(page, name) {
  const path = join(OUT, name)
  await page.screenshot({ path, fullPage: true })
  shots.push(path)
  console.log(`  saved ${path}`)
}

// ── Desktop (ES + EN) + Drawer ────────────────────────────────────────────────
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const dpage = await login(desktop)
console.log(`logged in -> ${dpage.url()}`)

await dpage.goto(`${BASE}/es/admin/bookings`, { waitUntil: 'domcontentloaded' })
await dpage.waitForTimeout(2500)
await shot(dpage, '01-es-desktop.png')

// Open the detail Drawer on a confirmed/live event (nth(1)) so its actions show.
const evCount = await dpage.locator('[data-ek-event]').count()
if (evCount) {
  await dpage.locator('[data-ek-event]').nth(evCount > 1 ? 1 : 0).click()
  await dpage.waitForTimeout(900)
  await shot(dpage, '02-es-drawer.png')
  await dpage.keyboard.press('Escape')
  await dpage.waitForTimeout(400)
  // Day view (click today's header so the live booking shows in a single column).
  await dpage.locator('[data-ek-dayhead]').nth(2).click().catch(() => {})
  await dpage.waitForTimeout(700)
  await shot(dpage, '05-es-day.png')
  await dpage.getByRole('button', { name: /^semana$|^week$/i }).click().catch(() => {})
  await dpage.waitForTimeout(400)
} else {
  console.log('  (no events this week — skipped drawer shot)')
}

await dpage.goto(`${BASE}/en/admin/bookings`, { waitUntil: 'domcontentloaded' })
await dpage.waitForTimeout(2500)
await shot(dpage, '03-en-desktop.png')

// ── Mobile (ES) ───────────────────────────────────────────────────────────────
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const mpage = await login(mobile)
await mpage.goto(`${BASE}/es/admin/bookings`, { waitUntil: 'domcontentloaded' })
await mpage.waitForTimeout(2500)
await shot(mpage, '04-es-mobile.png')

await browser.close()
console.log(`\nDONE — ${shots.length} shots in ${OUT}`)
