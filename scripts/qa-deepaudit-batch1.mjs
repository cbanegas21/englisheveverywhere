// Live verify of the deep-audit fix batch (commit a7a23a6).
// RLS-1 (critical) + OPS-1 already verified at DB level; this covers the
// code-path fixes on the live deploy where drivable, plus a re-confirm of RLS-1.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const BASE = 'https://englishkolab.com'
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY
const out = []
const check = (n, ok, extra = '') => { out.push(ok); console.log(`${ok ? '✅' : '🔴'} ${n}${extra ? ' :: ' + extra : ''}`) }
const rnd = () => Math.floor(Math.random() * 1e9)

// RLS-1 re-confirm on live: throwaway student JWT can NO LONGER self-insert credits.
{
  const email = `qa-da-rls1-${rnd()}@example.com`, pass = 'QaDa1Verify!'
  const uid = (await (await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass, email_confirm: true }) })).json()).id
  await fetch(`${SB}/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'student' }) })
  const jwt = (await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass }) })).json()).access_token
  const r = await fetch(`${SB}/rest/v1/students`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ profile_id: uid, classes_remaining: 999 }) })
  check('RLS-1 credit-minting INSERT blocked on live', r.status >= 400, `status ${r.status}`)
  await fetch(`${SB}/rest/v1/students?profile_id=eq.${uid}`, { method: 'DELETE', headers: { apikey: SR, Authorization: `Bearer ${SR}` } })
  await fetch(`${SB}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: { apikey: SR, Authorization: `Bearer ${SR}` } })
}

// RLS-3 sibling check: availability_slots still teacher-writable? (low, informational — expected still open pre-fix)
// (skipped write test to avoid polluting a real teacher's slots)

const browser = await chromium.launch()

// I18N-1: ES student settings shows a SPANISH validation error (clear the name → save).
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/es/login`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(900)
  await p.fill('input[name="email"]', 'student@englishkolab.com'); await p.fill('input[name="password"]', 'Student2026!')
  await p.click('button[type="submit"]'); await p.waitForURL(/\/dashboard/, { timeout: 40000 })
  await p.goto(`${BASE}/es/dashboard/configuracion`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000)
  // find the name input, clear it, save — expect a Spanish error, not English
  const errs = []
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('pageerror', e => errs.push('PE:' + e.message))
  let sawSpanish = false
  try {
    const nameInput = p.locator('input[type="text"]').first()
    await nameInput.fill('')
    // click the nearest save button
    const saveBtn = p.getByRole('button', { name: /guardar/i }).first()
    await saveBtn.click({ timeout: 5000 })
    await p.waitForTimeout(1500)
    const body = await p.evaluate(() => document.body.innerText)
    // Spanish error copy from P_MSG; must NOT contain the old English "Name is required"
    sawSpanish = /obligatorio|inválid|No autenticado|no se pudo/i.test(body) && !/Name is required|Too many attempts/i.test(body)
  } catch (e) { sawSpanish = false }
  check('I18N-1: ES settings error is localized (no English leak)', sawSpanish)
  const hard = errs.filter(e => !/favicon|DevTools|sentry|web-vitals/i.test(e))
  check('configuracion renders 0 console errors', hard.length === 0, hard[0]?.slice(0, 90) || '')
  await ctx.close()
}

// HYD-1: admin reschedule panel — can't drive without admin 2FA headless; DB/build-verified.

await browser.close()
const fails = out.filter(o => !o).length
console.log(`\n${fails === 0 ? '✅ ALL' : '🔴 ' + fails + ' FAIL of'} ${out.length} checks`)
process.exit(fails === 0 ? 0 : 1)
