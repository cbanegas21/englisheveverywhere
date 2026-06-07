// Verify the live-class bug fix: a confirmed class that STARTED 20 min ago must
// still appear in My Classes "Próximas". Creates a temp booking, screenshots,
// then DELETES it so the records stay clean.
// node --env-file=.env.local scripts/qa-bugfix-liveclass.mjs
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const outDir = path.resolve('docs/qa-screenshots', 'bugfix')
await mkdir(outDir, { recursive: true })

// started 20 min ago → would be HIDDEN before the fix, VISIBLE after.
const scheduled_at = new Date(Date.now() - 20 * 60 * 1000).toISOString()
const { data: bk, error: ce } = await sb.from('bookings').insert({
  student_id: '1c16c690-0ea5-4a82-ac6a-e0466d54e5c9',
  teacher_id: 'eb0d520e-1a8c-4027-ae46-14594981a76a',
  scheduled_at, duration_minutes: 60, status: 'confirmed', type: 'class',
}).select('id').single()
if (ce) { console.error('create failed', ce.message); process.exit(1) }
console.log('temp live booking', bk.id, 'started', scheduled_at)

let appeared = false
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(600)
  await page.fill('input[type="email"]', 'carlos_paz2020@outlook.com')
  await page.fill('input[type="password"]', 'Maxine2020')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
  await page.goto(`${BASE}/es/dashboard/clases`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: path.join(outDir, 'clases-live-class.png'), fullPage: true })
  const body = await page.textContent('body')
  appeared = /Entrar a clase|En vivo|Llamada|Clase con/i.test(body || '') && /Próximas \((?!0\))/.test(body || '')
  console.log('Próximas shows the live class:', appeared)
} finally {
  await browser.close()
}

// cleanup — leave records empty
const { error: de } = await sb.from('bookings').delete().eq('id', bk.id)
console.log('cleanup delete:', de ? 'ERR ' + de.message : 'ok')
const { count } = await sb.from('bookings').select('id', { count: 'exact', head: true })
console.log('bookings now:', count)
console.log(appeared ? 'PASS' : 'CHECK SCREENSHOT')
