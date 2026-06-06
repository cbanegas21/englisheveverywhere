// Drive the Plan checkout flow + screenshot the modals (centering + sales-y).
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const EMAIL = 'testing@remoteacktive.com'
const PASS = 'Test1234!'
const outDir = path.resolve('docs/qa-screenshots', 'dash-plan')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(2000)

  await page.goto(`${BASE}/es/dashboard/plan`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(1600)
  await page.screenshot({ path: path.join(outDir, 'plan-page.png'), fullPage: true })

  // Click a plan → add-more confirm (test student has classes remaining)
  await page.getByRole('button', { name: 'Empezar' }).first().click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, 'modal-addmore.png') })
  console.log('addmore shot')

  // Confirm stacking → payment modal
  await page.getByRole('button', { name: /agregar clases/i }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, 'modal-payment.png') })
  console.log('payment shot')
  await ctx.close()
} finally {
  await browser.close()
}
