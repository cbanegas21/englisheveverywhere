// The five funnel leaks Carlos found by walking /descubre -> registro.
import { chromium } from '@playwright/test'
const BASE = process.env.QA_BASE || 'https://englishkolab.com'
const R = []
const ok = (n, c, d = '') => { R.push(c); console.log(`${c ? '✅' : '❌'} ${n}${d ? '  — ' + d : ''}`) }
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 }, locale: 'es-HN' })
const p = await ctx.newPage()

await p.goto(`${BASE}/es/descubre`, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(1600)
for (const idx of [3, 1, 1]) { await p.locator('.ek-opt').nth(idx).click().catch(() => {}); await p.waitForTimeout(850) }
await p.waitForTimeout(4200)
let t = ((await p.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
ok('resultado muestra el paquete recomendado', /Trayecto/.test(t), t.slice(0, 90))
ok('LEAK 5: la persona puede elegir cuántas clases', /t[úu] eliges cu[áa]ntas clases/i.test(t))
ok('el recomendado está marcado', /Recomendado/i.test(t))

// switch to the biggest pack — the upsell that used to be impossible
const chips = p.locator('button[aria-pressed]')
await chips.nth(3).click().catch(() => {})
await p.waitForTimeout(2600)
t = ((await p.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
ok('LEAK 5: subir a 20 clases actualiza el precio', /Cumbre/.test(t) && /259/.test(t), t.match(/\$\d+ por clase[^·]*·?[^$]*\$\d+ en total/)?.[0] || t.slice(120, 230))

await p.getByRole('link', { name: /llamada gratis/i }).first().click().catch(() => {})
await p.waitForTimeout(3200)
t = ((await p.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
ok('LEAK 1: ya NO pregunta Estudiante/Maestro', !/Cómo quieres usar la plataforma/.test(t), t.slice(0, 100))
ok('LEAK 4: la página habla de la llamada GRATIS', /gratis/i.test(t) && /diagn[oó]stico/i.test(t))
ok('LEAK 2: recuerda el plan elegido', /Cumbre/.test(t), (t.match(/Guardamos[^.]*\./) || ['no plan noted'])[0])

await p.goBack().catch(() => {})
await p.waitForTimeout(3000)
t = ((await p.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
ok('LEAK 3: ATRÁS conserva el quiz (no lo reinicia)', !/Responde 3 preguntas/.test(t), t.slice(0, 100))
ok('LEAK 3: y conserva el paquete que había elegido', /Cumbre/.test(t))

await b.close()
const pass = R.filter(Boolean).length
console.log(`\n========== FUNNEL LEAKS: ${pass} PASS / ${R.length - pass} FAIL ==========`)
