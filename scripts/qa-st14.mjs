// ST-14 QA — typography-first icon removal.
// Screenshots: Plan purchase-success modal (ES+EN) + My Classes page (ES+EN).
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const EMAIL = 'carlos_paz2020@outlook.com'
const PASS = 'Maxine2020'
const outDir = path.resolve('docs/qa-screenshots', 'st14')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // login
  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2000)

  const shots = [
    ['plan-success-es', `${BASE}/es/dashboard/plan?success=1&plan=peak`],
    ['plan-success-en', `${BASE}/en/dashboard/plan?success=1&plan=peak`],
    ['clases-es', `${BASE}/es/dashboard/clases`],
    ['clases-en', `${BASE}/en/dashboard/clases`],
  ]
  for (const [name, url] of shots) {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(1800)
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true })
    console.log('shot', name)
  }
  await ctx.close()
} finally {
  await browser.close()
}
