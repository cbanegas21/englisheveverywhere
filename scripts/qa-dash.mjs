// Authenticated dashboard screenshots (logs in once as the test student).
// Usage: node scripts/qa-dash.mjs <out-subfolder>
//   QA_PATHS  comma-separated routes (default /es/dashboard)  · QA_BASE
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const OUT = process.argv[2] || 'dash'
const TARGETS = (process.env.QA_PATHS || process.env.QA_PATH || '/es/dashboard').split(',')
const EMAIL = process.env.QA_EMAIL || 'testing@remoteacktive.com'
const PASS = process.env.QA_PASS || 'Test1234!'

const outDir = path.resolve('docs/qa-screenshots', OUT)
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  // 1) Log in once, capture auth state.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(2500)
  if (!page.url().includes('/dashboard')) {
    console.log('Login failed — run: node scripts/reset-test-passwords.js')
    process.exit(2)
  }
  const state = await ctx.storageState()
  await ctx.close()

  // 2) Screenshot each target at desktop + mobile reusing the auth state.
  for (const TARGET of TARGETS) {
    const tag = TARGET.replace(/\//g, '_').replace(/^_/, '') || 'home'
    for (const vp of [
      { n: 'desktop', w: 1440, h: 900, m: false },
      { n: 'mobile', w: 390, h: 844, m: true },
    ]) {
      const c = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        isMobile: vp.m,
        hasTouch: vp.m,
        storageState: state,
      })
      const p = await c.newPage()
      await p.goto(`${BASE}${TARGET}`, { waitUntil: 'load', timeout: 60000 })
      await p.waitForTimeout(1700)
      await p.screenshot({ path: path.join(outDir, `${tag}-${vp.n}.png`), fullPage: true })
      console.log('saved', `${tag}-${vp.n}`)
      await c.close()
    }
  }
} finally {
  await browser.close()
}
