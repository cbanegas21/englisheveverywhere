// Diagnostic QA: reproduce specific issues + detect horizontal overflow.
// Usage: node scripts/qa-diagnose.mjs
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const outDir = path.resolve('docs/qa-screenshots', 'diagnose')
await mkdir(outDir, { recursive: true })

// Find any element whose box extends past the viewport (cause of sideways scroll).
const OVERFLOW_FN = () => {
  const vw = document.documentElement.clientWidth
  const bad = []
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    if (r.right > vw + 1 || r.left < -1) {
      bad.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 44),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
      })
    }
  })
  return {
    vw,
    scrollWidth: document.documentElement.scrollWidth,
    overflowX: document.documentElement.scrollWidth - vw,
    offenders: bad.length,
    sample: bad.slice(0, 14),
  }
}

const browser = await chromium.launch()
const report = {}
try {
  // ---- 1. Mobile menu "page slides sideways" ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/es`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(900)
    report.mobileClosed = await page.evaluate(OVERFLOW_FN)
    await page.screenshot({ path: path.join(outDir, 'mobile-menu-closed.png') })
    await page.click('[aria-label="Toggle menu"]')
    await page.waitForTimeout(500)
    report.mobileMenuOpen = await page.evaluate(OVERFLOW_FN)
    report.mobileMenuOpen.scrollX = await page.evaluate(() => window.scrollX)
    await page.screenshot({ path: path.join(outDir, 'mobile-menu-open.png') })
    await ctx.close()
  }
  // ---- 2. Logged-in landing top-gap (simulate ee-role cookie) ----
  for (const vp of [{ n: 'desktop', w: 1440, h: 900, m: false }, { n: 'mobile', w: 390, h: 844, m: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.m, hasTouch: vp.m })
    await ctx.addCookies([{ name: 'ee-role', value: 'student', domain: 'localhost', path: '/' }])
    const page = await ctx.newPage()
    await page.goto(`${BASE}/es`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(900)
    // measure the gap between header bottom and the first hero content
    const gap = await page.evaluate(() => {
      const header = document.querySelector('header')?.getBoundingClientRect()
      const section = document.querySelector('main > section')?.getBoundingClientRect()
      const kicker = document.querySelector('main > section .ek-kicker, main > section [class*="kicker"]')?.getBoundingClientRect()
      return {
        headerBottom: header ? Math.round(header.bottom) : null,
        sectionTop: section ? Math.round(section.top) : null,
        firstContentTop: kicker ? Math.round(kicker.top) : null,
      }
    })
    report[`loggedIn_${vp.n}`] = gap
    await page.screenshot({ path: path.join(outDir, `loggedin-${vp.n}-top.png`), clip: { x: 0, y: 0, width: vp.w, height: Math.min(vp.h, 900) } })
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
