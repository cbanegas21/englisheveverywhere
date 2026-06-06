// Verify LK-01: header stays pinned on scroll + anchor-nav lands below it.
import { chromium } from '@playwright/test'
const BASE = process.env.QA_BASE || 'http://localhost:3000'
const browser = await chromium.launch()
const out = []
for (const vp of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'mobile', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es`, { waitUntil: 'load' })
  await page.waitForTimeout(800)
  // scroll down and check header still at top
  await page.evaluate(() => window.scrollTo(0, 1600))
  await page.waitForTimeout(300)
  const hb = await page.locator('header').first().boundingBox()
  const pinned = hb && Math.abs(hb.y) < 2
  // anchor nav (desktop nav only; mobile is behind hamburger) — test via hash on both
  await page.evaluate(() => { location.hash = '#pricing' })
  await page.waitForTimeout(600)
  const res = await page.evaluate(() => {
    const el = document.getElementById('pricing')
    const r = el.getBoundingClientRect()
    const header = document.querySelector('header').getBoundingClientRect()
    return { sectionTop: Math.round(r.top), headerBottom: Math.round(header.bottom) }
  })
  // section heading should sit at/just below the header bottom (scroll-margin-top), not under it
  const clearsHeader = res.sectionTop >= res.headerBottom - 4
  out.push({ vp: vp.n, pinnedOnScroll: !!pinned, headerY: hb ? Math.round(hb.y) : null, anchorSectionTop: res.sectionTop, headerBottom: res.headerBottom, clearsHeader })
  await ctx.close()
}
await browser.close()
console.log(JSON.stringify(out, null, 2))
