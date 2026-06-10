/**
 * AD-03 Phase 5 visual capture — click-empty-cell → create booking modal.
 * Single in-context login. Read-only (opens the modal, never submits).
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:3000 node scripts/qa-shot-p5.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const ADMIN = { email: 'admin@englishkolab.com', password: 'Maxine2021.' }
const OUT = join(tmpdir(), 'ad03-p5-shots')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const shots = []
async function shot(page, name) {
  const path = join(OUT, name)
  await page.screenshot({ path, fullPage: true })
  shots.push(path); console.log(`  saved ${path}`)
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

async function openCreate(page, lang) {
  await page.goto(`${BASE}/${lang}/admin/bookings`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  // Click an empty cell in the 4th day column (~mid-morning). Use an absolute
  // viewport coordinate inside the already-visible grid to avoid Playwright
  // auto-scrolling the tall column behind the stat ledger.
  const col = page.locator('[data-ek-col]').nth(3)
  const box = await col.boundingBox()
  if (box) await page.mouse.click(box.x + Math.min(40, box.width / 2), box.y + 200)
  await page.waitForTimeout(700)
  const dialog = page.getByRole('dialog')
  console.log(`  ${lang} dialog visible:`, await dialog.count(), '| students:', await page.locator('[role=dialog] select').first().locator('option').count())
}

const desktop = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
const dp = await login(desktop)
console.log(`logged in -> ${dp.url()}`)

await openCreate(dp, 'es')
await shot(dp, '01-es-create.png')
// Pick the first real student so the summary + teacher hints populate.
const sel = dp.locator('[role=dialog] select').first()
const opts = await sel.locator('option').count()
if (opts > 1) { await sel.selectOption({ index: 1 }); await dp.waitForTimeout(400); await shot(dp, '02-es-create-filled.png') }

await openCreate(dp, 'en')
await shot(dp, '03-en-create.png')

// Mobile ES
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const mp = await login(mobile)
await openCreate(mp, 'es')
await shot(mp, '04-es-create-mobile.png')

await browser.close()
console.log(`\nDONE — ${shots.length} shots in ${OUT}`)
