// QA the renamed plans (Departure/Journey/Ascent/Summit) on Plan + Progress, ES+EN.
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const outDir = path.resolve('docs/qa-screenshots', 'plan-names')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', 'carlos_paz2020@outlook.com')
  await page.fill('input[type="password"]', 'Maxine2020')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)

  for (const [name, url] of [
    ['plan-es', `${BASE}/es/dashboard/plan`],
    ['plan-en', `${BASE}/en/dashboard/plan`],
    ['progreso-es', `${BASE}/es/dashboard/progreso`],
    ['progreso-en', `${BASE}/en/dashboard/progreso`],
  ]) {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true })
    const body = (await page.textContent('body')) || ''
    const found = ['Departure', 'Journey', 'Summit', 'Partida', 'Trayecto', 'Cumbre', 'Ascent', 'Ascenso'].filter(w => body.includes(w))
    const stale = ['Spark', 'Chispa', 'Drive', 'Impulso', 'Peak', 'Cima'].filter(w => body.includes(w))
    console.log(name, '| new names:', found.join(',') || '-', '| STALE:', stale.join(',') || 'none')
  }
} finally {
  await browser.close()
}
