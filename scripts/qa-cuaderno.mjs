// Mobile cuaderno bottom-sheet QA (CALL-03 §2). On mobile the cuaderno opens via
// the control bar's "More" → "Transcripción". Verifies the sheet slides up over
// the stage and keeps the control bar visible below it.
//   QA_BOOKING=<id> node scripts/qa-cuaderno.mjs
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
  await page.getByRole('button', { name: 'Chat' }).waitFor({ timeout: 35000 })
  await page.waitForTimeout(2500)

  // Mobile: cuaderno lives under More → Transcripción.
  await page.getByRole('button', { name: 'Más', exact: true }).click().catch(() => {})
  await page.waitForTimeout(450)
  await page.getByRole('menuitem', { name: 'Transcripción' }).click().catch(() => {})
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(outDir, `cuaderno-${tag}-sheet.png`) })
  console.log(`[${tag}] shot cuaderno sheet`)

  await ctx.close()
}

try {
  await run('mobile', { width: 390, height: 844 })
} finally {
  await browser.close()
}
console.log('--- console errors (' + errors.length + ') ---')
for (const e of errors.slice(0, 25)) console.log(e)
