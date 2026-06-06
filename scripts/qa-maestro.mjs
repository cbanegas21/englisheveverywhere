// Authenticated TEACHER-dashboard screenshots (logs in once as the test teacher).
// Usage: node scripts/qa-maestro.mjs <out-subfolder>
//   QA_EMAIL/QA_PASS  teacher creds (default: lesly@englishkolab.com — seeded active)
//   QA_PATHS          comma-separated routes (default: all /maestro/* routes)
//   QA_BASE           default http://localhost:3000
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const OUT = process.argv[2] || 'maestro'
const TARGETS = (
  process.env.QA_PATHS ||
  [
    '/es/maestro/dashboard',
    '/es/maestro/dashboard/agenda',
    '/es/maestro/dashboard/estudiantes',
    '/es/maestro/dashboard/tareas',
    '/es/maestro/dashboard/disponibilidad',
    '/es/maestro/dashboard/materiales',
    '/es/maestro/dashboard/ganancias',
    '/es/maestro/dashboard/configuracion',
  ].join(',')
).split(',')
// lesly@englishkolab.com is seeded with is_active=true + availability + confirmed email.
const EMAIL = process.env.QA_EMAIL || 'lesly@englishkolab.com'
const PASS = process.env.QA_PASS || 'Honduras2024!'

const outDir = path.resolve('docs/qa-screenshots', OUT)
await mkdir(outDir, { recursive: true })

// Slow, small-step scroll so framer-motion whileInView reveals reliably fire
// (fast scrolling skips IntersectionObserver samples → blank/opacity:0 cards).
async function revealAll(p) {
  await p.evaluate(async () => {
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
        await sleep(130)
      }
      await sleep(200)
    }
    window.scrollTo(0, 0)
  })
  await p.waitForTimeout(400)
}

const browser = await chromium.launch()
try {
  // 1) Log in once as the teacher, capture auth state.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(700)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/maestro/**', { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const url = page.url()
  if (!url.includes('/maestro/dashboard')) {
    if (url.includes('/maestro/pending')) {
      console.log(`Logged in but landed on /maestro/pending — ${EMAIL} is NOT an active teacher.`)
      console.log('Use an active teacher (lesly@englishkolab.com) or have an admin approve this account.')
    } else {
      console.log(`Login failed or unexpected redirect: ${url}`)
      console.log('Reset the teacher password with: node scripts/reset-test-passwords.js (student/owner only)')
    }
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
      await p.waitForTimeout(1200)
      await revealAll(p)
      await p.screenshot({ path: path.join(outDir, `${tag}-${vp.n}.png`), fullPage: true })
      console.log('saved', `${tag}-${vp.n}`)
      await c.close()
    }
  }
} finally {
  await browser.close()
}
