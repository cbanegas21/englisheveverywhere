// Supporting-screens QA (CALL-03 §4). Captures the de-AI'd Lobby (with countdown)
// and the Ended screen on desktop + mobile.
//   QA_BOOKING=<future-start booking id> node scripts/qa-screens.mjs
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const BOOKING = process.env.QA_BOOKING
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

  // Lobby (before entering).
  await page.goto(`${BASE}/es/sala/${BOOKING}`, { waitUntil: 'load', timeout: 60000 })
  const enter = page.getByRole('button', { name: 'Entrar ahora' })
  await enter.waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(outDir, `screens-${tag}-lobby.png`) })
  console.log(`[${tag}] shot lobby`)

  // Enter → connected → leave → Ended screen.
  await enter.click()
  await page.getByRole('button', { name: 'Chat' }).waitFor({ timeout: 35000 })
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'Salir', exact: true }).click().catch(() => {})
  // Wait for the Ended screen's "return to dashboard" CTA.
  await page.getByText('Volver al inicio').waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, `screens-${tag}-ended.png`) })
  console.log(`[${tag}] shot ended`)

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
