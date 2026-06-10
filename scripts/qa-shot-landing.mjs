import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = join(tmpdir(), 'ek-landing')
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newContext({ viewport: { width: 1440, height: 1000 } }).then(c => c.newPage())
await page.goto('http://localhost:3000/es', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await page.screenshot({ path: join(OUT, 'hero.png') })
const mb = page.locator('.lk-morning').first()
if (await mb.count()) {
  await mb.scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(OUT, 'morning.png') })
}
console.log('saved to', OUT)
await browser.close()
