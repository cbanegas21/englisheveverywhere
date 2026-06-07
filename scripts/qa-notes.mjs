// Teacher notes-panel QA (CALL-03 §7). Logs in as the teacher, joins the room,
// opens More -> Notas, and screenshots the unified glass notes panel.
//   QA_BOOKING=<live booking id> node scripts/qa-notes.mjs
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const BOOKING = process.env.QA_BOOKING
const EMAIL = 'c.banegaspaz2020@gmail.com'
const PASS = 'Test1234!'
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
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera', 'microphone'] })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))

  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)

  await page.goto(`${BASE}/es/sala/${BOOKING}`, { waitUntil: 'load', timeout: 60000 })
  const enter = page.getByRole('button', { name: 'Entrar ahora' })
  await enter.waitFor({ timeout: 20000 }).catch(() => {})
  if (await enter.isVisible().catch(() => false)) await enter.click()
  await page.getByRole('button', { name: /Silenciar|Activar mic/ }).first().waitFor({ timeout: 35000 })
  await page.waitForTimeout(2500)

  // Notes lives under More for the teacher.
  await page.getByRole('button', { name: 'Más', exact: true }).click().catch(() => {})
  await page.waitForTimeout(400)
  await page.getByRole('menuitem', { name: 'Notas de Clase' }).click().catch(() => {})
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, 'panel-notes.png') })
  console.log('shot notes')

  await ctx.close()
} finally {
  await browser.close()
}
console.log('--- console errors (' + errors.length + ') ---')
for (const e of errors.slice(0, 25)) console.log(e)
