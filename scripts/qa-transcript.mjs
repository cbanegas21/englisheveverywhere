// End-to-end Deepgram transcript test. Feeds a real speech WAV as the fake mic,
// joins a temp live class, waits for chunks to transcribe server-side, then
// checks the cuaderno Transcripción tab shows real words. Deletes the booking.
// node --env-file=.env.local scripts/qa-transcript.mjs
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const wav = path.resolve('scripts/qa-speech-sample.wav')
// Self-contained: grab a speech sample for the fake mic if it's not present.
if (!existsSync(wav)) {
  const r = await fetch('https://dpgr.am/spacewalk.wav')
  await writeFile(wav, Buffer.from(await r.arrayBuffer()))
  console.log('downloaded speech sample')
}
const outDir = path.resolve('docs/qa-screenshots', 'transcript')
await mkdir(outDir, { recursive: true })

// temp live class (started 2 min ago → joinable now, no lobby)
const scheduled_at = new Date(Date.now() - 2 * 60 * 1000).toISOString()
const { data: bk, error: ce } = await sb.from('bookings').insert({
  student_id: '1c16c690-0ea5-4a82-ac6a-e0466d54e5c9',
  teacher_id: 'eb0d520e-1a8c-4027-ae46-14594981a76a',
  scheduled_at, duration_minutes: 60, status: 'confirmed', type: 'class',
}).select('id').single()
if (ce) { console.error('create failed', ce.message); process.exit(1) }
console.log('temp booking', bk.id)

const errors = []
let transcriptText = ''
const browser = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
})
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera', 'microphone'] })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')))

  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', 'carlos_paz2020@outlook.com')
  await page.fill('input[type="password"]', 'Maxine2020')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})

  await page.goto(`${BASE}/es/sala/${bk.id}`, { waitUntil: 'load', timeout: 60000 })
  // live → straight into room; if a lobby shows, click enter
  const enter = page.getByRole('button', { name: 'Entrar ahora' })
  if (await enter.isVisible({ timeout: 8000 }).catch(() => false)) await enter.click()
  // wait for the control bar (= connected)
  await page.getByRole('button', { name: 'Chat' }).waitFor({ timeout: 35000 })

  // Let several 6s chunks upload + transcribe.
  await page.waitForTimeout(22000)

  // Switch the cuaderno to the Transcripción tab.
  await page.getByRole('button', { name: 'Transcripción' }).last().click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(outDir, 'cuaderno-transcript.png'), fullPage: true })

  const body = (await page.textContent('body')) || ''
  // spacewalk.wav speech includes these words
  transcriptText = /spacewalk|female|team|celebrating|worth/i.test(body) ? 'FOUND' : 'not found'
  console.log('transcript words present:', transcriptText)
} finally {
  await browser.close()
}

const { error: de } = await sb.from('bookings').delete().eq('id', bk.id)
console.log('cleanup:', de ? 'ERR ' + de.message : 'ok')
const { count } = await sb.from('bookings').select('id', { count: 'exact', head: true })
console.log('bookings now:', count)
console.log('--- console errors (' + errors.length + ') ---')
for (const e of errors.slice(0, 15)) console.log(e)
console.log(transcriptText === 'FOUND' ? 'PASS' : 'CHECK SCREENSHOT')
