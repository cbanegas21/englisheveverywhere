/** AD-03 P2 fix-verify: Drawer (non-drag) reschedule works on an unassigned booking. */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const ADMIN = { email: 'admin@englishkolab.com', password: 'Maxine2021.' }
const OUT = join(tmpdir(), 'ad03-shots'); mkdirSync(OUT, { recursive: true })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: student } = await sb.from('students').select('id').limit(1).single()
const { data: B } = await sb.from('bookings').insert({ student_id: student.id, teacher_id: null, scheduled_at: '2026-06-11T15:00:00Z', duration_minutes: 60, status: 'pending', type: 'class', meeting_notes: '[AD-03 drawertest] B' }).select('id').single()
console.log('seeded', B.id)
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.goto(`${BASE}/es/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name="email"]', ADMIN.email); await page.fill('input[name="password"]', ADMIN.password)
await page.getByRole('button', { name: /ingresar|log in/i }).click()
await page.waitForURL(/\/(es|en)\/admin/, { timeout: 40000 }).catch(() => {})
await page.goto(`${BASE}/es/admin/bookings?weekStart=2026-06-08`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
const results = []
await page.locator(`[data-ek-id="${B.id}"]`).first().click()
await page.waitForTimeout(800)
await page.getByRole('button', { name: /^reprogramar$/i }).click()
await page.waitForTimeout(600)
const hasInputs = await page.locator('input[type="time"]').count() > 0
results.push(['reschedule inputs appear in drawer', hasInputs, ''])
if (hasInputs) await page.screenshot({ path: join(OUT, '07-drawer-reschedule.png') })
await page.fill('input[type="date"]', '2026-06-11')
await page.fill('input[type="time"]', '14:00')
await page.getByRole('button', { name: /^guardar$/i }).click()
await page.waitForTimeout(2500)
const { data: after } = await sb.from('bookings').select('scheduled_at').eq('id', B.id).single()
results.push(['drawer reschedule moved booking to 14:00 GT (20:00Z)', after?.scheduled_at?.startsWith('2026-06-11T20:00'), `new=${after?.scheduled_at}`])
await browser.close()
await sb.from('bookings').delete().like('meeting_notes', '[AD-03 drawertest]%')
console.log('\n=== RESULTS ===')
for (const [n, p, d] of results) console.log(`${p ? 'PASS' : 'FAIL'}  ${n}  | ${d}`)
process.exit(results.every(r => r[1]) ? 0 : 1)
