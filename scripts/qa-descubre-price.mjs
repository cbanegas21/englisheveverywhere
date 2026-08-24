// The /descubre quiz must end on the recommended plan's PRICE (2026-08-23 decision),
// not a signup wall. Drives all three frequency answers so every pack is covered.
import { chromium } from '@playwright/test'
const BASE = process.env.QA_BASE || 'https://englishkolab.com'
const R = []
const ok = (n, c, d = '') => { R.push(c); console.log(`${c ? '✅' : '❌'} ${n}${d ? '  — ' + d : ''}`) }
const b = await chromium.launch()
const EXPECT = { 0: ['129', '16'], 1: ['179', '15'], 2: ['219', '14'], 3: ['259', '13'] }
for (const lang of ['es', 'en']) {
  for (const pick of [0, 3]) {
    const p = await (await b.newContext()).newPage()
    await p.goto(`${BASE}/${lang}/descubre`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(1600)
    for (let q = 0; q < 3; q++) {
      await p.locator('.ek-opt').nth(q === 2 ? pick : 1).click().catch(() => {})
      await p.waitForTimeout(850)
    }
    await p.waitForTimeout(3800)
    const t = ((await p.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
    const [total, per] = EXPECT[pick]
    ok(`[${lang}] pack ${pick}: shows total $${total}`, t.includes(total), t.slice(t.indexOf('CUEST') > 0 ? t.indexOf('CUEST') : 0, 140))
    ok(`[${lang}] pack ${pick}: shows per-class $${per}`, t.includes(`$${per} `), '')
    ok(`[${lang}] pack ${pick}: competitor frame present`, /83.139/.test(t))
    ok(`[${lang}] pack ${pick}: CTA leads with the free call`, /llamada gratis|free call/i.test(t))
    await p.context().close()
  }
}
await b.close()
const pass = R.filter(Boolean).length
console.log(`\n========== DESCUBRE PRICE: ${pass} PASS / ${R.length - pass} FAIL ==========`)
