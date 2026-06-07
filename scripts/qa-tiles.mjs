// Two-participant tile QA (CALL-03 §6). Student + teacher join the SAME room so
// there's a real remote tile, then we verify the premium name label, the
// persistent mute badge (mute the teacher), and the grid layout.
//   QA_BOOKING=<live booking id> node scripts/qa-tiles.mjs
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const BOOKING = process.env.QA_BOOKING
const STUDENT = { email: 'carlos_paz2020@outlook.com', pass: 'Maxine2020' }
const TEACHER = { email: 'c.banegaspaz2020@gmail.com', pass: 'Test1234!' }
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

async function joinRoom(label, who, viewport) {
  const ctx = await browser.newContext({ viewport, permissions: ['camera', 'microphone'] })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] ` + m.text()) })
  page.on('pageerror', e => errors.push(`[${label}] PAGEERROR: ` + e.message))

  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', who.email)
  await page.fill('input[type="password"]', who.pass)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)

  await page.goto(`${BASE}/es/sala/${BOOKING}`, { waitUntil: 'load', timeout: 60000 })
  const enter = page.getByRole('button', { name: 'Entrar ahora' })
  await enter.waitFor({ timeout: 20000 }).catch(() => {})
  if (await enter.isVisible().catch(() => false)) await enter.click()
  // in-room when the mic toggle is present
  await page.getByRole('button', { name: /Silenciar|Activar mic/ }).first().waitFor({ timeout: 35000 })
  return { ctx, page }
}

try {
  const student = await joinRoom('student', STUDENT, { width: 1440, height: 900 })
  const teacher = await joinRoom('teacher', TEACHER, { width: 1440, height: 900 })
  // Let both subscribe to each other's camera.
  await student.page.waitForTimeout(5000)

  await student.page.screenshot({ path: path.join(outDir, 'tiles-speaker.png') })
  console.log('shot speaker (remote tile + label)')

  // Mute the teacher → student should see the mute badge on the teacher tile.
  await teacher.page.getByRole('button', { name: 'Silenciar' }).click().catch(() => {})
  await student.page.waitForTimeout(2500)
  await student.page.screenshot({ path: path.join(outDir, 'tiles-muted.png') })
  console.log('shot muted (badge)')

  // Grid layout on the student side (the layout toggle lives in the More menu).
  await student.page.getByRole('button', { name: 'Más', exact: true }).click().catch(() => {})
  await student.page.waitForTimeout(400)
  await student.page.getByRole('menuitem', { name: 'Lado a lado' }).click().catch(() => {})
  await student.page.waitForTimeout(1500)
  await student.page.screenshot({ path: path.join(outDir, 'tiles-grid.png') })
  console.log('shot grid')

  await teacher.ctx.close()
  await student.ctx.close()
} finally {
  await browser.close()
}
console.log('--- console errors (' + errors.length + ') ---')
for (const e of errors.slice(0, 25)) console.log(e)
