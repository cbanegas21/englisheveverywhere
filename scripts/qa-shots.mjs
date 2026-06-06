// QA screenshot helper for the landing page (before/after proof).
// Usage:  node scripts/qa-shots.mjs <out-subfolder>
//   QA_BASE   (default http://localhost:3000)
//   QA_LANGS  (default "es")   e.g. "es,en"
// Captures full-page + hero-only shots at desktop (1440) and mobile (390).
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const OUT = process.argv[2] || 'baseline'
const LANGS = (process.env.QA_LANGS || 'es').split(',')
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
]

const outDir = path.resolve('docs/qa-screenshots', OUT)
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  for (const lang of LANGS) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
      })
      const page = await ctx.newPage()
      const url = `${BASE}/${lang}`
      await page.goto(url, { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(1500)
      // Trigger framer-motion whileInView (viewport once) by scrolling through.
      await page.evaluate(async () => {
        await new Promise((res) => {
          let y = 0
          const step = () => {
            window.scrollBy(0, Math.round(window.innerHeight * 0.8))
            y += window.innerHeight * 0.8
            if (y < document.body.scrollHeight + window.innerHeight) setTimeout(step, 110)
            else res()
          }
          step()
        })
      })
      await page.waitForTimeout(500)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(400)
      const tag = `${lang}-${vp.name}`
      await page.screenshot({ path: path.join(outDir, `landing-${tag}.png`), fullPage: true })
      const hero = await page.$('main > section:first-of-type')
      if (hero) await hero.screenshot({ path: path.join(outDir, `hero-${tag}.png`) })
      console.log('saved', tag)
      await ctx.close()
    }
  }
} finally {
  await browser.close()
}
