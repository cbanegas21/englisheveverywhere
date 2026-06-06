// Wide-matrix full-page QA capture for a formatting/display audit.
// Usage: node scripts/qa-audit.mjs <out-subfolder>   (default: audit)
//   QA_BASE  (default http://localhost:3000)
//   QA_LANGS (default "es,en")
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const OUT = process.argv[2] || 'audit'
const LANGS = (process.env.QA_LANGS || 'es,en').split(',')
const WIDTHS = [
  { name: 'mobile-375', w: 375, h: 812, m: true },
  { name: 'mobile-414', w: 414, h: 896, m: true },
  { name: 'tablet-768', w: 768, h: 1024, m: true },
  { name: 'laptop-1024', w: 1024, h: 768, m: false },
  { name: 'desktop-1280', w: 1280, h: 800, m: false },
  { name: 'desktop-1440', w: 1440, h: 900, m: false },
]

const outDir = path.resolve('docs/qa-screenshots', OUT)
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  for (const lang of LANGS) {
    for (const vp of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: 1,
        isMobile: vp.m,
        hasTouch: vp.m,
      })
      const page = await ctx.newPage()
      await page.goto(`${BASE}/${lang}`, { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(1200)
      // Slow reveal so framer-motion whileInView cards aren't blank.
      await page.evaluate(async () => {
        const s = (ms) => new Promise((r) => setTimeout(r, ms))
        const step = Math.round(window.innerHeight * 0.35)
        for (let p = 0; p < 2; p++) {
          window.scrollTo(0, 0)
          await s(120)
          let y = 0
          const max = document.body.scrollHeight + window.innerHeight
          while (y < max) { window.scrollBy(0, step); y += step; await s(130) }
          await s(150)
        }
      })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(outDir, `${lang}-${vp.name}.png`), fullPage: true })
      console.log('saved', lang, vp.name)
      await ctx.close()
    }
  }
} finally {
  await browser.close()
}
