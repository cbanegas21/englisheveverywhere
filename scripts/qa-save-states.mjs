/**
 * Generate reusable authenticated sessions for the exhaustive live sweep.
 * Logs in each role ONCE via the real UI against PLAYWRIGHT_BASE_URL and saves the
 * session cookies to .auth/<role>.json. Surface specs then `test.use({ storageState })`
 * instead of logging in per-test — eliminating rate-limiter contention at scale.
 *
 * Run: PLAYWRIGHT_BASE_URL=https://englishkolab.com node scripts/qa-save-states.mjs
 */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync } from 'node:fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://englishkolab.com'

// Clear the rate limiter first so three back-to-back logins never trip it.
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
await db.from('auth_attempts').delete().gte('id', 0)

// Passwords from env only — never hardcode live creds. Set E2E_*_PASSWORD before running.
const ACCOUNTS = [
  { role: 'student', email: env.E2E_STUDENT_EMAIL || 'student@englishkolab.com', password: env.E2E_STUDENT_PASSWORD || '' },
  { role: 'teacher', email: env.E2E_TEACHER_EMAIL || 'teacher@englishkolab.com', password: env.E2E_TEACHER_PASSWORD || '' },
  { role: 'admin',   email: env.E2E_ADMIN_EMAIL   || 'admin@englishkolab.com',   password: env.E2E_ADMIN_PASSWORD   || '' },
].filter(a => a.password)

mkdirSync('.auth', { recursive: true })
const browser = await chromium.launch()
let ok = 0
for (const a of ACCOUNTS) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es/login`)
  await page.fill('input[name="email"]', a.email)
  await page.fill('input[name="password"]', a.password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  await page.waitForURL(/\/(es|en)\/(dashboard|maestro|admin|clases|intake|onboarding)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const cookies = await ctx.cookies()
  const authed = cookies.some(c => /^sb-.*-auth-token/.test(c.name))
  await ctx.storageState({ path: `.auth/${a.role}.json` })
  console.log(`${authed ? 'OK  ' : 'WARN'} ${a.role.padEnd(8)} ${page.url()} -> .auth/${a.role}.json`)
  if (authed) ok++
  await ctx.close()
}
await browser.close()
console.log(`\n${ok}/3 sessions saved.`)
process.exit(ok === 3 ? 0 : 1)
