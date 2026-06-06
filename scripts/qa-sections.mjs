// Per-section QA screenshots (readable, for before/after proof).
// Usage:  node scripts/qa-sections.mjs <out-subfolder>
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const OUT = process.argv[2] || 'baseline'
const LANG = process.env.QA_LANG || 'es'
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
]

const outDir = path.resolve('docs/qa-screenshots', OUT, 'sections')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/${LANG}`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(1200)
    // Reveal whileInView sections. Slow, small steps so framer-motion's
    // IntersectionObserver reliably fires on every card (fast scrolling skips
    // observer samples and leaves lower cards at opacity:0).
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const stepPx = Math.round(window.innerHeight * 0.35)
      for (let pass = 0; pass < 2; pass++) {
        window.scrollTo(0, 0)
        await sleep(120)
        let y = 0
        const max = document.body.scrollHeight + window.innerHeight
        while (y < max) {
          window.scrollBy(0, stepPx)
          y += stepPx
          await sleep(140)
        }
        await sleep(200)
      }
    })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(400)
    const blocks = await page.$$('main > *')
    for (let i = 0; i < blocks.length; i++) {
      const id = (await blocks[i].getAttribute('id')) || `block${i}`
      const tag = String(i).padStart(2, '0')
      try {
        await blocks[i].scrollIntoViewIfNeeded()
        await page.waitForTimeout(120)
        await blocks[i].screenshot({ path: path.join(outDir, `${vp.name}-${tag}-${id}.png`) })
      } catch (e) {
        console.log('skip', vp.name, tag, id, e.message)
      }
    }
    console.log('done', vp.name, blocks.length, 'blocks')
    await ctx.close()
  }
} finally {
  await browser.close()
}
