/**
 * Live check for Auth-MEDIUM-signin-errors: a failed login must show a friendly
 * LOCALIZED message and never the raw Supabase string. Uses a non-existent email
 * so no real account's lockout counter is touched. Run after deploy.
 *   node scripts/qa-verify-signin-error.mjs
 */
import { chromium } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://englishkolab.com'
const browser = await chromium.launch()
const results = []

async function check(locale, expectFriendly) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/${locale}/login`)
  await page.fill('input[name="email"]', `qa-nonexistent-${locale}@example.com`)
  await page.fill('input[name="password"]', 'definitely-wrong-pw-123')
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  await page.waitForTimeout(2500)
  const body = await page.locator('body').innerText()
  const leakedRaw = /invalid login credentials/i.test(body)
  const hasFriendly = body.includes(expectFriendly)
  const pass = !leakedRaw && hasFriendly
  results.push({ locale, pass, leakedRaw, hasFriendly, url: page.url() })
  console.log(`[${locale}] ${pass ? 'PASS' : 'FAIL'}  friendly=${hasFriendly} rawLeak=${leakedRaw}  url=${page.url()}`)
  await ctx.close()
}

// ES + EN: the localized invalid-credentials message; never the raw provider string.
await check('es', 'Correo o contraseña incorrectos')
await check('en', 'Incorrect email or password')

await browser.close()
const allPass = results.every(r => r.pass)
console.log(`\n${allPass ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(allPass ? 0 : 1)
