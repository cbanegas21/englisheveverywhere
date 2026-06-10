/**
 * AD-03 Phase 2 drag-to-reschedule verification. Seeds 3 controlled bookings,
 * dispatches native HTML5 DnD events (shared DataTransfer) to (a) move an
 * unassigned booking to an empty slot — expect DB scheduled_at to change — and
 * (b) drop a confirmed class onto the teacher's other confirmed slot — expect the
 * conflict Modal. Screenshots the Modal. Deletes the seed afterwards.
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:3000 node --env-file=.env.local scripts/qa-verify-drag.mjs
 */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const ADMIN = { email: 'admin@englishkolab.com', password: 'Maxine2021.' }
const OUT = join(tmpdir(), 'ad03-shots'); mkdirSync(OUT, { recursive: true })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: student } = await sb.from('students').select('id').limit(1).single()
const { data: teacher } = await sb.from('teachers').select('id').eq('is_active', true).limit(1).single()
// Thu Jun 11 2026; Guatemala = UTC-6. 09:00->15:00Z, 10:00->16:00Z, 11:00->17:00Z
const seed = [
  { tag: 'B1', row: { student_id: student.id, teacher_id: null,       scheduled_at: '2026-06-11T15:00:00Z', duration_minutes: 60, status: 'pending',   type: 'class', meeting_notes: '[AD-03 dragtest] B1 unassigned' } },
  { tag: 'B2', row: { student_id: student.id, teacher_id: teacher.id, scheduled_at: '2026-06-11T16:00:00Z', duration_minutes: 60, status: 'confirmed', type: 'class', meeting_notes: '[AD-03 dragtest] B2 confirmed' } },
  { tag: 'B3', row: { student_id: student.id, teacher_id: teacher.id, scheduled_at: '2026-06-11T17:00:00Z', duration_minutes: 60, status: 'confirmed', type: 'class', meeting_notes: '[AD-03 dragtest] B3 confirmed' } },
]
const ids = {}
for (const s of seed) { const { data } = await sb.from('bookings').insert(s.row).select('id').single(); ids[s.tag] = data.id }
console.log('seeded:', ids)

const ROW_HEIGHT = 48, START_HOUR = 6 // business start (no out-of-hours seed)
async function dispatchDrag(page, srcId, colDayIdx, targetHourGT, grab = 5) {
  return page.evaluate(({ srcId, colDayIdx, targetHourGT, grab, ROW_HEIGHT, START_HOUR }) => {
    const src = document.querySelector(`[data-ek-event][data-ek-id="${srcId}"]`) || document.querySelectorAll('[data-ek-event]')[0]
    const col = document.querySelector(`[data-ek-col="${colDayIdx}"]`)
    if (!src || !col) return { ok: false, reason: 'element not found', haveSrc: !!src, haveCol: !!col }
    const sRect = src.getBoundingClientRect(), cRect = col.getBoundingClientRect()
    const grabClientY = sRect.top + grab
    const dropClientY = cRect.top + (targetHourGT - START_HOUR) * ROW_HEIGHT + grab
    const x = cRect.left + cRect.width / 2
    const dt = new DataTransfer()
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: sRect.left + 10, clientY: grabClientY }))
    col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: dropClientY }))
    col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: dropClientY }))
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }))
    return { ok: true }
  }, { srcId, colDayIdx, targetHourGT, grab, ROW_HEIGHT, START_HOUR })
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto(`${BASE}/es/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name="email"]', ADMIN.email)
await page.fill('input[name="password"]', ADMIN.password)
await page.getByRole('button', { name: /ingresar|log in/i }).click()
await page.waitForURL(/\/(es|en)\/admin/, { timeout: 40000 }).catch(() => {})
await page.goto(`${BASE}/es/admin/bookings?weekStart=2026-06-08`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const results = []
// Test 1: move B1 (unassigned, Thu 09:00) -> Thu 13:00. No teacher gate -> should succeed.
const r1 = await dispatchDrag(page, ids.B1, 3, 13)
await page.waitForTimeout(2500)
const { data: b1after } = await sb.from('bookings').select('scheduled_at').eq('id', ids.B1).single()
const moved = b1after && b1after.scheduled_at !== '2026-06-11T15:00:00+00:00' && b1after.scheduled_at !== '2026-06-11T15:00:00Z'
results.push(['move unassigned -> empty slot', moved, `dispatch=${JSON.stringify(r1)} new=${b1after?.scheduled_at}`])

// Test 2: drop B2 (confirmed, Thu 10:00) onto B3's slot (Thu 11:00) -> teacher conflict Modal.
await page.goto(`${BASE}/es/admin/bookings?weekStart=2026-06-08`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
await dispatchDrag(page, ids.B2, 3, 11)
await page.waitForTimeout(2000)
const modalText = await page.locator('[role="dialog"]').innerText().catch(() => '')
const conflictShown = /confirmed class|atención|heads up|class at this time/i.test(modalText)
if (conflictShown) { await page.screenshot({ path: join(OUT, '06-conflict-modal.png') }); console.log('  saved conflict modal shot') }
results.push(['confirmed -> occupied teacher slot shows conflict Modal', conflictShown, modalText.replace(/\n/g,' ').slice(0,120)])
const { data: b2after } = await sb.from('bookings').select('scheduled_at').eq('id', ids.B2).single()
results.push(['B2 NOT moved into conflict', b2after?.scheduled_at.startsWith('2026-06-11T16:00'), `b2=${b2after?.scheduled_at}`])

await browser.close()
// cleanup
await sb.from('bookings').delete().like('meeting_notes', '[AD-03 dragtest]%')
console.log('\n=== RESULTS ===')
for (const [name, pass, detail] of results) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  | ${detail}`)
console.log(results.every(r => r[1]) ? '\nALL PASS' : '\nSOME FAILED')
process.exit(results.every(r => r[1]) ? 0 : 1)
