import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const OUT = join(tmpdir(), 'ek-admin-payouts'); mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const p = await b.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage())
await p.goto(`${BASE}/es/login`, { waitUntil: 'domcontentloaded' })
await p.fill('input[name="email"]', 'admin@englishkolab.com')
await p.fill('input[name="password"]', 'Maxine2021.')
await p.getByRole('button', { name: /ingresar|log in/i }).click()
await p.waitForURL(/\/(es|en)\/admin/, { timeout: 40000 }).catch(() => {})
await p.waitForTimeout(1500)
await p.goto(`${BASE}/es/admin/payouts`, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2200)
await p.screenshot({ path: join(OUT, 'es.png'), fullPage: true })
console.log('nav has Pagos:', await p.locator('a:has-text("Pagos")').count())
await p.goto(`${BASE}/en/admin/payouts`, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2000)
await p.screenshot({ path: join(OUT, 'en.png'), fullPage: true })
console.log('saved to', OUT)
await b.close()
