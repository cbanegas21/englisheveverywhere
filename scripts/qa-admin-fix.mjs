// Authenticated ADMIN screenshots to verify the responsive sidebar fix.
// Usage: node scripts/qa-admin-fix.mjs
//   QA_EMAIL/QA_PASS  admin creds (default: admin@englishkolab.com / Maxine2021.)
//   QA_BASE           default http://localhost:3000
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || 'admin@englishkolab.com'
const PASS = process.env.QA_PASS || 'Maxine2021.'

const outDir = path.resolve('docs/qa-screenshots', 'admin-fix')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  // 1) Log in once as admin, capture auth state.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin**', { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const url = page.url()
  if (!url.includes('/admin')) {
    console.log(`Login failed or unexpected redirect: ${url}`)
    process.exit(2)
  }
  const state = await ctx.storageState()
  await ctx.close()

  const targets = [
    { path: '/es/admin/overview', tag: 'overview' },
    { path: '/es/admin/students', tag: 'students' },
  ]

  // 2) Mobile (390px) — confirm sidebar collapses to a hamburger, full-width content.
  for (const t of targets) {
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      storageState: state,
    })
    const p = await c.newPage()
    await p.goto(`${BASE}${t.path}`, { waitUntil: 'load', timeout: 60000 })
    await p.waitForTimeout(1500)
    await p.screenshot({ path: path.join(outDir, `${t.tag}-mobile-390.png`), fullPage: true })
    console.log('saved', `${t.tag}-mobile-390`)
    // Capture the open drawer state on overview to prove the hamburger works.
    if (t.tag === 'overview') {
      const btn = p.locator('button[aria-label="Open menu"]')
      if (await btn.count()) {
        await btn.first().click()
        await p.waitForTimeout(800)
        await p.screenshot({ path: path.join(outDir, `${t.tag}-mobile-390-drawer-open.png`), fullPage: false })
        console.log('saved', `${t.tag}-mobile-390-drawer-open`)
      }
    }
    await c.close()
  }

  // 3) Desktop (1440px) — confirm the fixed rail is unchanged.
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: state })
    const p = await c.newPage()
    await p.goto(`${BASE}/es/admin/overview`, { waitUntil: 'load', timeout: 60000 })
    await p.waitForTimeout(1500)
    await p.screenshot({ path: path.join(outDir, 'overview-desktop-1440.png'), fullPage: true })
    console.log('saved', 'overview-desktop-1440')
    await c.close()
  }
} finally {
  await browser.close()
}
