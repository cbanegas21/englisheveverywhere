/** AD-03 P3 Month view: seed a June spread, screenshot ES/EN month, verify day-drill, cleanup. */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const ADMIN = { email: 'admin@englishkolab.com', password: 'Maxine2021.' }
const OUT = join(tmpdir(), 'ad03-shots'); mkdirSync(OUT, { recursive: true })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: student } = await sb.from('students').select('id').limit(1).single()
const { data: teacher } = await sb.from('teachers').select('id').eq('is_active', true).limit(1).single()
const T = teacher.id, S = student.id
const rows = [
  { student_id: S, teacher_id: T,    scheduled_at: '2026-06-03T15:00:00Z', duration_minutes: 60, status: 'confirmed', type: 'class', meeting_notes: '[AD-03 monthtest]' },
  { student_id: S, teacher_id: null, scheduled_at: '2026-06-11T15:00:00Z', duration_minutes: 60, status: 'pending',   type: 'class', meeting_notes: '[AD-03 monthtest]' },
  { student_id: S, teacher_id: T,    scheduled_at: '2026-06-11T16:00:00Z', duration_minutes: 60, status: 'confirmed', type: 'class', meeting_notes: '[AD-03 monthtest]' },
  { student_id: S, teacher_id: T,    scheduled_at: '2026-06-11T17:00:00Z', duration_minutes: 60, status: 'confirmed', type: 'class', meeting_notes: '[AD-03 monthtest]' },
  { student_id: S, teacher_id: T,    scheduled_at: '2026-06-11T20:00:00Z', duration_minutes: 60, status: 'confirmed', type: 'class', meeting_notes: '[AD-03 monthtest]' },
  { student_id: S, teacher_id: null, scheduled_at: '2026-06-18T22:00:00Z', duration_minutes: 45, status: 'confirmed', type: 'placement_test', meeting_notes: '[AD-03 monthtest]' },
  { student_id: S, teacher_id: T,    scheduled_at: '2026-06-25T14:00:00Z', duration_minutes: 60, status: 'completed', type: 'class', meeting_notes: '[AD-03 monthtest]' },
]
await sb.from('bookings').insert(rows)
console.log('seeded', rows.length)
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
await page.goto(`${BASE}/es/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name="email"]', ADMIN.email); await page.fill('input[name="password"]', ADMIN.password)
await page.getByRole('button', { name: /ingresar|log in/i }).click()
await page.waitForURL(/\/(es|en)\/admin/, { timeout: 40000 }).catch(() => {})
const shots = []
async function shot(p, n) { const path = join(OUT, n); await p.screenshot({ path, fullPage: true }); shots.push(n) }
await page.goto(`${BASE}/es/admin/bookings?weekStart=2026-06-10&view=month`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
const results = []
const monthShown = await page.locator('[data-ek-monthcell]').count()
results.push(['month grid renders (42 cells)', monthShown === 42, `cells=${monthShown}`])
await shot(page, '08-es-month.png')
await page.goto(`${BASE}/en/admin/bookings?weekStart=2026-06-10&view=month`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
await shot(page, '09-en-month.png')
// Drill: click June 11 cell -> should navigate to that day's week + day view (URL day=2026-06-11)
await page.goto(`${BASE}/es/admin/bookings?weekStart=2026-06-10&view=month`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
await page.locator('[data-ek-monthcell="2026-5-11"]').click()
await page.waitForTimeout(2500)
const url = page.url()
results.push(['day-drill navigates with day=2026-06-11', /day=2026-06-11/.test(url), url])
await browser.close()
await sb.from('bookings').delete().like('meeting_notes', '[AD-03 monthtest]%')
console.log('\n=== RESULTS ===')
for (const [n, p, d] of results) console.log(`${p ? 'PASS' : 'FAIL'}  ${n}  | ${d}`)
console.log('shots:', shots.join(', '))
process.exit(results.every(r => r[1]) ? 0 : 1)
