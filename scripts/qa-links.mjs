// Landing interaction audit: every link's destination + anchor validity +
// toggle smoke tests. Usage: node scripts/qa-links.mjs
import { chromium } from '@playwright/test'

const BASE = process.env.QA_BASE || 'http://localhost:3000'
const out = { routes: {}, perLang: {}, toggles: {} }

async function checkStatus(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    return { status: res.status, finalUrl: res.url.replace(BASE, '') }
  } catch (e) {
    return { status: 0, error: e.message }
  }
}

const browser = await chromium.launch()
try {
  for (const lang of ['es', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/${lang}`, { waitUntil: 'load' })
    await page.waitForTimeout(900)

    const links = await page.$$eval('a[href]', (els) => {
      const seen = new Map()
      for (const a of els) {
        const href = a.getAttribute('href')
        if (!seen.has(href)) seen.set(href, (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 36))
      }
      return [...seen].map(([href, text]) => ({ href, text }))
    })
    const buttons = await page.$$eval('button', (els) =>
      els
        .map((b) => ({ text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30), label: b.getAttribute('aria-label') || '' }))
        .filter((b) => b.text || b.label),
    )
    const ids = await page.$$eval('[id]', (els) => els.map((e) => e.id).filter(Boolean))
    out.perLang[lang] = { linkCount: links.length, links, buttons }

    for (const { href } of links) {
      if (!href || out.routes[href]) continue
      if (href.startsWith('#') || href.startsWith(`/${lang}#`)) {
        const id = href.split('#')[1]
        out.routes[href] = { type: 'anchor', ok: ids.includes(id), id }
      } else if (href.startsWith('/')) {
        const path = href.split('#')[0]
        out.routes[href] = { type: 'internal', ...(await checkStatus(`${BASE}${path}`)) }
      } else if (href.startsWith('http')) {
        out.routes[href] = { type: 'external', ok: true }
      } else if (href.startsWith('mailto:') || href.startsWith('tel:')) {
        out.routes[href] = { type: 'contact', ok: true }
      } else {
        out.routes[href] = { type: 'other' }
      }
    }
    await ctx.close()
  }

  // Toggle smoke tests (desktop)
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/es`, { waitUntil: 'load' })
    await page.waitForTimeout(800)
    const trig = page.locator('#faq-trigger-2')
    const before = await trig.getAttribute('aria-expanded')
    await trig.click()
    await page.waitForTimeout(300)
    const after = await trig.getAttribute('aria-expanded')
    out.toggles.accordion = { before, after, ok: before !== after }

    await page.goto(`${BASE}/es`, { waitUntil: 'load' })
    await page.waitForTimeout(600)
    await page.locator('button[aria-label^="Switch to"]').first().click()
    await page.waitForTimeout(1100)
    out.toggles.localeSwitch = { url: page.url().replace(BASE, ''), ok: page.url().includes('/en') }

    await page.goto(`${BASE}/es`, { waitUntil: 'load' })
    await page.waitForTimeout(600)
    const curBtn = page.locator('button, [role="button"]').filter({ hasText: /USD|MXN|\$/ }).first()
    out.toggles.currencyPresent = { ok: (await curBtn.count()) > 0 }
    await ctx.close()
  }

  // Mobile drawer
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/es`, { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await page.click('[aria-label="Toggle menu"]')
    await page.waitForTimeout(450)
    const visible = await page.getByText('Idioma', { exact: true }).first().isVisible().catch(() => false)
    out.toggles.mobileDrawer = { ok: visible }
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify(out, null, 2))
