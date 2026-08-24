// Pricing-leak probe (Public-section QA). The gated-pricing funnel hides pack
// prices VISUALLY, but the public client components (Pricing.tsx, DescubreClient.tsx)
// import the full PRICING_PLANS — which carries priceUsd per pack (129/179/219/259).
// If those values reach the browser JS, any teacher/competitor can read the margin +
// pack structure from devtools, defeating the gate (Carlos's explicit intent).
// This fetches the prod public pages + every /_next/static JS chunk they load and
// greps for the pack prices. Read-only.
const BASE = process.env.QA_BASE || 'https://englishkolab.com'
const PAGES = ['/en', '/es', '/en/descubre', '/es/descubre']
const PRICES = ['129', '179', '219', '259']      // pack USD prices — must NOT ship public
const UA = { headers: { 'user-agent': 'Mozilla/5.0 (qa-leak-probe)' } }

const chunks = new Set()
console.log('=== PAGES ===')
for (const pg of PAGES) {
  let html = '', status = 0
  try { const r = await fetch(BASE + pg, UA); status = r.status; html = await r.text() } catch (e) { console.log(pg, 'FETCH-ERR', String(e).slice(0, 80)); continue }
  for (const m of html.matchAll(/(\/_next\/static\/[^"'\\)]+?\.js)/g)) chunks.add(m[1])
  const inlinePriceUsd = html.includes('priceUsd')
  const inlinePack = PRICES.filter(p => html.includes('priceUsd:' + p) || html.includes('priceUsd": ' + p) || html.includes('priceUsd\\":' + p))
  console.log(`${pg} [${status}] len=${html.length} inline.priceUsd=${inlinePriceUsd} inline.packPrices=${JSON.stringify(inlinePack)}`)
}
console.log(`\nunique JS chunks referenced: ${chunks.size}`)

const hits = []
let scanned = 0
for (const c of chunks) {
  let js = ''
  try { const r = await fetch(BASE + c, UA); js = await r.text() } catch (e) { continue }
  scanned++
  const hasPriceUsd = js.includes('priceUsd')
  const hasNames = js.includes('Departure') && js.includes('Summit')

  // A price only counts as leaked when it is BOUND to the price concept. A bare
  // substring search for "129" is worthless in minified JS — it matches React's
  // bitmask (t.flags&=-129), webpack module ids (146219) and SVG path data
  // (1.504 179.235). All three were flagged as leaks before this was tightened.
  const bound = new RegExp(String.raw`priceUsd\?["']?\s*:\s*(` + PRICES.join('|') + ')')
  const pricesFound = bound.test(js) ? PRICES.filter(p => bound.test(js) && js.includes(p)) : []

  // Two real signatures: a priceUsd:<value> literal, or a full pricing table
  // (plan names shipped alongside every pack price).
  const definitive = bound.test(js) || (hasNames && PRICES.every(p => js.includes(p)))
  const leaks = definitive
  if (leaks) {
    let snippet = ''
    const m = js.match(bound)
    const i = m ? js.indexOf(m[0]) : js.indexOf('priceUsd')
    if (i >= 0) snippet = js.slice(Math.max(0, i - 30), i + 140).replace(/\s+/g, ' ')
    hits.push({ chunk: c, definitive, hasPriceUsd, pricesFound, hasNames, snippet })
  }
}
console.log(`\nscanned ${scanned} chunks`)
console.log('\n=== PRICE-LEAK RESULT ===')
if (!hits.length) console.log('✅ CLEAN — no pack PRICE VALUE in any public JS chunk (the bare `priceUsd` identifier is expected: /descubre reads it off the runtime server-action result)')
else for (const h of hits) {
  console.log(`${h.definitive ? '🔴 DEFINITIVE LEAK (key + all four prices)' : '🔴 PRICE VALUE IN BUNDLE'}  ${h.chunk}`)
  console.log(`   pricesFound=${JSON.stringify(h.pricesFound)} planNames=${h.hasNames}`)
  if (h.snippet) console.log(`   snippet: …${h.snippet}…`)
}
