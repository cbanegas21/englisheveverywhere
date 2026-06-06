// Phase A visual QA — logs in per role, screenshots each target at desktop+mobile,
// and records console errors per page to console-errors.json in the out dir.
// Usage: node scripts/qa-phaseA.mjs <role> <out-subfolder>
//   role ∈ student | teacher | admin
//   QA_PATHS  comma-separated routes (required)
//   QA_BASE   default http://localhost:3000
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const ROLE = process.argv[2] || 'student'
const OUT = process.argv[3] || ROLE
const TARGETS = (process.env.QA_PATHS || '').split(',').map((s) => s.trim()).filter(Boolean)

const CREDS = {
  student: { email: 'testing@remoteacktive.com', pass: 'Test1234!' },
  teacher: { email: 'c.banegaspaz2020@gmail.com', pass: 'Test1234!' },
  admin: { email: 'admin@englishkolab.com', pass: 'Maxine2021' },
}
const { email, pass } = CREDS[ROLE]
// Where login should land for each role (used to confirm success).
const LANDING = { student: '/dashboard', teacher: '/maestro', admin: '/admin' }[ROLE]

const outDir = path.resolve('docs/qa-screenshots', OUT)
await mkdir(outDir, { recursive: true })

// Slow, small-step scroll so framer-motion whileInView reveals reliably fire.
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
        await sleep(120)
      }
      await sleep(200)
    }
    window.scrollTo(0, 0)
  })
  await p.waitForTimeout(400)
}

const consoleLog = {}

const browser = await chromium.launch()
try {
  // 1) Log in once, capture auth state.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/es/login`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(800)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', pass)
  await page.click('button[type="submit"]')
  await page.waitForURL(`**${LANDING}**`, { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const landed = page.url()
  if (!landed.includes(LANDING)) {
    console.log(`LOGIN FAILED for ${ROLE} (${email}). Landed: ${landed}`)
    await page.screenshot({ path: path.join(outDir, `_login-failed-${ROLE}.png`), fullPage: true })
    process.exit(2)
  }
  console.log(`Logged in as ${ROLE}, landed ${landed}`)
  const state = await ctx.storageState()
  await ctx.close()

  // 2) Screenshot each target at desktop + mobile reusing auth state.
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
      const key = `${tag}-${vp.n}`
      consoleLog[key] = []
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleLog[key].push(msg.text())
      })
      p.on('pageerror', (err) => consoleLog[key].push('PAGEERROR: ' + err.message))
      const resp = await p.goto(`${BASE}${TARGET}`, { waitUntil: 'load', timeout: 60000 }).catch((e) => {
        consoleLog[key].push('NAV ERROR: ' + e.message)
        return null
      })
      if (resp) consoleLog[key].push('__status:' + resp.status())
      await p.waitForTimeout(1400)
      await revealAll(p)
      await p.screenshot({ path: path.join(outDir, `${key}.png`), fullPage: true })
      console.log('saved', key, 'finalUrl', p.url())
      consoleLog[key].push('__finalUrl:' + p.url())
      await c.close()
    }
  }
} finally {
  await browser.close()
  await writeFile(path.join(outDir, 'console-errors.json'), JSON.stringify(consoleLog, null, 2))
}
