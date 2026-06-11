import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const OUT = join(tmpdir(), 'ek-pricing'); mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const p = await b.newContext({ viewport: { width: 1300, height: 1000 } }).then(c => c.newPage())

// Landing pricing section (ES + EN)
for (const lang of ['es', 'en']) {
  await p.goto(`${BASE}/${lang}#pricing`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  await p.locator('#pricing').scrollIntoViewIfNeeded().catch(() => {})
  await p.waitForTimeout(900)
  await p.screenshot({ path: join(OUT, `pricing-${lang}.png`) })
  console.log('saved pricing', lang)
}

// Quiz — intro, then click through to the result (ES)
await p.goto(`${BASE}/es/descubre`, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2200)
await p.screenshot({ path: join(OUT, 'quiz-intro.png') })
for (let i = 0; i < 3; i++) {
  await p.locator('.ek-opt').nth(1).click().catch(() => {})
  await p.waitForTimeout(500)
}
await p.waitForTimeout(2200) // processing → result
await p.screenshot({ path: join(OUT, 'quiz-result.png') })
console.log('quiz screens done; saved to', OUT)
await b.close()
