// Probe the screen-share branch (CALL-10). Tries to trigger getDisplayMedia in
// Chromium; if it activates, screenshots the share layout (local PiP over the
// shared screen). Single participant, so no remote PiP — verifies the branch +
// local PiP + no regression. Creates + deletes a temp booking.
// node --env-file=.env.local scripts/qa-share.mjs
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const outDir = path.resolve('docs/qa-screenshots', 'share')
await mkdir(outDir, { recursive: true })

const scheduled_at = new Date(Date.now() - 2 * 60 * 1000).toISOString()
const { data: bk, error: ce } = await sb.from('bookings').insert({
  student_id: '1c16c690-0ea5-4a82-ac6a-e0466d54e5c9',
  teacher_id: 'eb0d520e-1a8c-4027-ae46-14594981a76a',
  scheduled_at, duration_minutes: 60, status: 'confirmed', type: 'class',
}).select('id').single()
if (ce) { console.error('create failed', ce.message); process.exit(1) }
console.log('temp booking', bk.id)

const errors = []
let shareActive = false
const browser = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--auto-select-desktop-capture-source=Entire screen',
    '--auto-accept-this-tab-capture',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera', 'microphone'] })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))

  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', 'carlos_paz2020@outlook.com')
  await page.fill('input[type="password"]', 'Maxine2020')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
  await page.goto(`${BASE}/es/sala/${bk.id}`, { waitUntil: 'load', timeout: 60000 })
  const enter = page.getByRole('button', { name: 'Entrar ahora' })
  if (await enter.isVisible({ timeout: 8000 }).catch(() => false)) await enter.click()
  await page.getByRole('button', { name: 'Compartir pantalla' }).waitFor({ timeout: 35000 })
  await page.waitForTimeout(2000)

  await page.getByRole('button', { name: 'Compartir pantalla' }).click().catch(() => {})
  await page.waitForTimeout(3500)
  // share is active if a "Dejar de compartir" control appears (control bar +
  // the presenter badge both expose one now, so match the first).
  shareActive = await page.getByRole('button', { name: 'Dejar de compartir' }).first().isVisible().catch(() => false)
  await page.screenshot({ path: path.join(outDir, 'share-layout.png') })
  console.log('screen-share activated:', shareActive)
} finally {
  await browser.close()
}

const { error: de } = await sb.from('bookings').delete().eq('id', bk.id)
console.log('cleanup:', de ? 'ERR ' + de.message : 'ok')
console.log('console errors:', errors.length)
for (const e of errors.slice(0, 8)) console.log(e)
