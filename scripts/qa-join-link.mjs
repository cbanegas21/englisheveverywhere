// CALL-13 QA — direct join link / auth returnTo + open-redirect safety.
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const BOOKING = process.env.QA_BOOKING || '3ea1f957-1230-4bcc-812d-ada60cfb0227'
const EMAIL = 'carlos_paz2020@outlook.com'
const PASS = 'Maxine2020'
const outDir = path.resolve('docs/qa-screenshots', 'join-link')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const results = []
async function login(page) {
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
}
try {
  // 1) Logged-out → room → must bounce to login?next=<room>
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/es/sala/${BOOKING}`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(1200)
    const url1 = page.url()
    results.push(['logged-out → login w/ next', url1.includes('/login') && url1.includes(`next=`) && decodeURIComponent(url1).includes(`/es/sala/${BOOKING}`), url1])
    await page.screenshot({ path: path.join(outDir, '1-login-with-next.png') })

    // 2) login → land in the room (lobby)
    await login(page)
    await page.waitForURL(`**/sala/${BOOKING}`, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const url2 = page.url()
    results.push(['after login → room', url2.includes(`/sala/${BOOKING}`), url2])
    await page.screenshot({ path: path.join(outDir, '2-landed-in-room.png') })
    await ctx.close()
  }

  // 3) Open-redirect: a malicious next must NOT leave the origin.
  for (const [name, badNext] of [
    ['absolute', 'https://evil.example.com'],
    ['protocol-relative', '//evil.example.com'],
    ['wrong-locale', '/fr/anything'],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/es/login?next=${encodeURIComponent(badNext)}`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(800)
    await login(page)
    await page.waitForTimeout(3000)
    const u = new URL(page.url())
    const safe = u.host === new URL(BASE).host && !u.pathname.startsWith('/fr/')
    results.push([`open-redirect blocked (${name})`, safe, page.url()])
    await ctx.close()
  }
} finally {
  await browser.close()
}
let allPass = true
for (const [name, ok, detail] of results) {
  if (!ok) allPass = false
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ::  ${detail}`)
}
console.log(allPass ? '\nALL PASS' : '\nSOME FAILED')
process.exit(allPass ? 0 : 1)
