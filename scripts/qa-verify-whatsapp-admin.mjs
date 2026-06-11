/**
 * Self-contained live smoke test of the new /admin/whatsapp manual-reminders view.
 * Logs in as admin in ONE context (avoids the flaky storageState restore), then
 * loads /es and /en and checks the localized title renders with no error boundary
 * and no bounce to login. Read-only (single login; no DB writes).
 * Run: node scripts/qa-verify-whatsapp-admin.mjs
 */
import { chromium } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://englishkolab.com'
const ADMIN = { email: 'admin@englishkolab.com', password: 'Maxine2021.' }

const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()

await page.goto(`${BASE}/es/login`)
await page.fill('input[name="email"]', ADMIN.email)
await page.fill('input[name="password"]', ADMIN.password)
await page.getByRole('button', { name: /ingresar|log in/i }).click()
await page.waitForURL(/\/(es|en)\/admin/, { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1500)
console.log(`logged in -> ${page.url()}`)

const ERR = /application error|client-side exception|something went wrong|ocurrió un error/i
const results = []

async function check(locale, mustHave, mustNotHave) {
  await page.goto(`${BASE}/${locale}/admin/whatsapp`)
  await page.waitForTimeout(2500)
  const body = await page.locator('body').innerText()
  const onLogin = /bienvenido de vuelta|welcome back|¿eres administrador|are you an admin/i.test(body)
  const crashed = ERR.test(body)
  const missing = mustHave.filter(s => !body.includes(s))
  const leaked = mustNotHave.filter(s => body.includes(s))
  const pass = !onLogin && !crashed && missing.length === 0 && leaked.length === 0
  results.push({ locale, pass, onLogin, crashed, missing, leaked, url: page.url() })
  console.log(`\n[${locale}] ${pass ? 'PASS' : 'FAIL'}  url=${page.url()}`)
  if (onLogin) console.log('  ! bounced to login')
  if (crashed) console.log('  ! error boundary / client exception')
  if (missing.length) console.log(`  ! missing expected: ${missing.join(' | ')}`)
  if (leaked.length) console.log(`  ! leaked unexpected: ${leaked.join(' | ')}`)
}

// ES shows Spanish title; must NOT leak the EN page title.
await check('es', ['Recordatorios de WhatsApp'], ['WhatsApp reminders'])
// EN shows English title; must NOT leak the ES page title.
await check('en', ['WhatsApp reminders'], ['Recordatorios de WhatsApp'])

await browser.close()
const allPass = results.every(r => r.pass)
console.log(`\n${allPass ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(allPass ? 0 : 1)
