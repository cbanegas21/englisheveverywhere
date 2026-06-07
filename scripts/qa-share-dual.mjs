// CALL-10 dual-PiP verification. Admin joins + screen-shares (with camera on);
// student joins and should see: shared screen + admin's camera (remote PiP) +
// own camera (local PiP). Screenshots the student's view. Temp booking deleted.
// node --env-file=.env.local scripts/qa-share-dual.mjs
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

async function joinRoom(page) {
  await page.goto(`${BASE}/es/sala/${bk.id}`, { waitUntil: 'load', timeout: 60000 })
  const enter = page.getByRole('button', { name: 'Entrar ahora' })
  if (await enter.isVisible({ timeout: 8000 }).catch(() => false)) await enter.click()
  await page.getByRole('button', { name: 'Compartir pantalla' }).waitFor({ timeout: 35000 })
}
async function login(page, email, pass) {
  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(600)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', pass)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(3500)
}

const browser = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--auto-select-desktop-capture-source=Entire screen',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
let remotePiP = false
const errors = []
try {
  // Admin shares.
  const adminCtx = await browser.newContext({ viewport: { width: 1100, height: 720 }, permissions: ['camera', 'microphone'] })
  const admin = await adminCtx.newPage()
  await login(admin, 'admin@englishkolab.com', 'Maxine2021.')
  await joinRoom(admin)
  await admin.getByRole('button', { name: 'Compartir pantalla' }).click().catch(() => {})
  await admin.waitForTimeout(2500)

  // Student views.
  const stuCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera', 'microphone'] })
  const stu = await stuCtx.newPage()
  stu.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  stu.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
  await login(stu, 'carlos_paz2020@outlook.com', 'Maxine2020')
  await joinRoom(stu)
  await stu.waitForTimeout(6000) // let admin's screen + camera subscribe

  await stu.screenshot({ path: path.join(outDir, 'dual-pip-student-view.png') })
  // Two camera PiPs visible → 2 "hide" buttons (Ocultar mi video + Ocultar su cámara)
  const hideMine = await stu.getByRole('button', { name: 'Ocultar mi video' }).count()
  const hideTheirs = await stu.getByRole('button', { name: 'Ocultar su cámara' }).count()
  remotePiP = hideTheirs > 0
  console.log('local PiP hide btns:', hideMine, ' remote PiP hide btns:', hideTheirs)
} finally {
  await browser.close()
}
const { error: de } = await sb.from('bookings').delete().eq('id', bk.id)
console.log('cleanup:', de ? 'ERR ' + de.message : 'ok')
console.log('console errors:', errors.length)
for (const e of errors.slice(0, 8)) console.log(e)
console.log(remotePiP ? 'PASS (remote PiP present)' : 'CHECK SCREENSHOT')
