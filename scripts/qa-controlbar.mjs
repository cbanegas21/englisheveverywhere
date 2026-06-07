// Control-bar QA harness (CALL-03). Logs in as the test student, enters the real
// LiveKit room, and screenshots the new Meet-style control bar on desktop +
// mobile, including the "More" overflow menu.
//   QA_BOOKING=<id> node scripts/qa-controlbar.mjs
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const BOOKING = process.env.QA_BOOKING || '3ea1f957-1230-4bcc-812d-ada60cfb0227'
const EMAIL = 'carlos_paz2020@outlook.com'
const PASS = 'Maxine2020'
const outDir = path.resolve('docs/qa-screenshots', 'call')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const errors = []

async function run(tag, viewport) {
  const ctx = await browser.newContext({ viewport, permissions: ['camera', 'microphone'] })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] ` + m.text()) })
  page.on('pageerror', e => errors.push(`[${tag}] PAGEERROR: ` + e.message))

  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1200)

  await page.goto(`${BASE}/es/sala/${BOOKING}`, { waitUntil: 'load', timeout: 60000 })
  const enter = page.getByRole('button', { name: 'Entrar ahora' })
  await enter.waitFor({ timeout: 20000 }).catch(() => {})
  if (await enter.isVisible().catch(() => false)) await enter.click()
  const chatBtn = page.getByRole('button', { name: 'Chat' })
  await chatBtn.waitFor({ timeout: 35000 })
  await page.waitForTimeout(2500)

  await page.screenshot({ path: path.join(outDir, `cb-${tag}-1-default.png`) })
  console.log(`[${tag}] shot default`)

  // Open the "More" overflow menu. Exact match — "Más" alone would also catch
  // the PiP's "Más grande" / "Más pequeño" resize buttons (strict-mode clash).
  await page.getByRole('button', { name: 'Más', exact: true }).click().catch(() => {})
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(outDir, `cb-${tag}-2-more.png`) })
  console.log(`[${tag}] shot more`)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)

  // Open chat.
  await chatBtn.click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(outDir, `cb-${tag}-3-chat.png`) })
  console.log(`[${tag}] shot chat`)

  await ctx.close()
}

try {
  await run('desktop', { width: 1440, height: 900 })
  await run('mobile', { width: 390, height: 844 })
} finally {
  await browser.close()
}
console.log('--- console errors (' + errors.length + ') ---')
for (const e of errors.slice(0, 25)) console.log(e)
