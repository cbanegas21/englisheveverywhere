// Phase C QA — prove the placement scheduler renders in the STUDENT's timezone.
// Temporarily forces the test student into Europe/Madrid (GMT+2) + the schedule
// stage, screenshots, then restores the original values.
//   node --env-file=.env.local scripts/qa-tz-placement.mjs
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const EMAIL = 'carlos_paz2020@outlook.com'
const PASS = 'Maxine2020'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const outDir = path.resolve('docs/qa-screenshots', 'tz')
await mkdir(outDir, { recursive: true })

const { data: profile } = await sb.from('profiles').select('id, timezone').eq('email', EMAIL).single()
const { data: student } = await sb.from('students').select('id, placement_scheduled, placement_test_done, survey_answers').eq('profile_id', profile.id).single()
const orig = { tz: profile.timezone, ps: student.placement_scheduled, pd: student.placement_test_done, sa: student.survey_answers }
console.log('original:', JSON.stringify(orig))

const errors = []
try {
  // Force Madrid + the schedule stage (survey answers present, placement not yet scheduled).
  await sb.from('profiles').update({ timezone: 'Europe/Madrid' }).eq('id', profile.id)
  await sb.from('students').update({
    placement_scheduled: false,
    placement_test_done: false,
    survey_answers: { goals: ['work'], level: 'beginner', speaking: 'a_little', frequency: 'weekly', style: 'mixed', pace: 'steady' },
  }).eq('id', student.id)

  const browser = await chromium.launch()
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))

    await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(700)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASS)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
    await page.goto(`${BASE}/es/dashboard/placement`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(1800)
    await page.screenshot({ path: path.join(outDir, 'placement-madrid-schedule.png'), fullPage: true })
    console.log('shot schedule')

    // Open the confirm modal on the first slot to verify the booking-date format.
    const slot = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first()
    if (await slot.isVisible().catch(() => false)) {
      await slot.click()
      await page.waitForTimeout(700)
      await page.screenshot({ path: path.join(outDir, 'placement-madrid-confirm.png') })
      console.log('shot confirm modal')
    }
    await ctx.close()
  } finally {
    await browser.close()
  }
} finally {
  // Always restore the originals.
  await sb.from('profiles').update({ timezone: orig.tz }).eq('id', profile.id)
  await sb.from('students').update({ placement_scheduled: orig.ps, placement_test_done: orig.pd, survey_answers: orig.sa }).eq('id', student.id)
  console.log('restored originals')
}
console.log('console errors:', errors.length)
for (const e of errors.slice(0, 10)) console.log(e)
