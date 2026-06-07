// Live-call QA harness. Launches Chromium with a fake camera/mic, logs in as
// the test student, enters the real LiveKit room for the test booking, and
// screenshots the stacking states that CALL-01/08 fix.
//   node scripts/qa-call.mjs            (desktop)
//   QA_VIEWPORT=mobile node scripts/qa-call.mjs
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const BOOKING = process.env.QA_BOOKING || '3ea1f957-1230-4bcc-812d-ada60cfb0227'
const EMAIL = 'carlos_paz2020@outlook.com'
const PASS = 'Maxine2020'
const isMobile = process.env.QA_VIEWPORT === 'mobile'
const viewport = isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }
const tag = isMobile ? 'mobile' : 'desktop'
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
  const ctx = await browser.newContext({ viewport, permissions: ['camera', 'microphone'] })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))

  // login
  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)

  // enter the room
  await page.goto(`${BASE}/es/sala/${BOOKING}`, { waitUntil: 'load', timeout: 60000 })
  // Lobby → "Entrar ahora"
  const enter = page.getByRole('button', { name: 'Entrar ahora' })
  await enter.waitFor({ timeout: 20000 }).catch(() => {})
  if (await enter.isVisible().catch(() => false)) {
    await enter.click()
  }
  // Wait until the in-room control bar (Chat button) appears = LiveKit connected.
  const chatBtn = page.getByRole('button', { name: 'Chat' })
  await chatBtn.waitFor({ timeout: 35000 })
  await page.waitForTimeout(2500) // let camera track render into the PiP

  await page.screenshot({ path: path.join(outDir, `${tag}-1-default.png`) })
  console.log('shot default')

  // CALL-09 — resize the PiP up two steps (sm→md→lg from md = one step to lg).
  await page.getByRole('button', { name: 'Más grande' }).click().catch(() => {})
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(outDir, `${tag}-1b-pip-large.png`) })
  console.log('shot pip-large')

  // Open chat → the PiP must rest LEFT of the panel, fully visible (CALL-01).
  await chatBtn.click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(outDir, `${tag}-2-chat-open.png`) })
  console.log('shot chat-open')

  // Open the device menu on top of everything (stacking check).
  await page.getByRole('button', { name: 'Ajustes de audio y video' }).click().catch(() => {})
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(outDir, `${tag}-3-devicemenu.png`) })
  console.log('shot devicemenu')
  // close device menu
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)

  // Whiteboard over the stage (should sit above the PiP).
  await page.getByRole('button', { name: 'Pizarra' }).click().catch(() => {})
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(outDir, `${tag}-4-whiteboard.png`) })
  console.log('shot whiteboard')

  await ctx.close()
} finally {
  await browser.close()
}
console.log('--- console errors (' + errors.length + ') ---')
for (const e of errors.slice(0, 25)) console.log(e)
