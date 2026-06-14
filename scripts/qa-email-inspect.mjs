// QA: inspect representative REAL sent emails (one per type) + verify all CTA
// links resolve. Groups recent sends by normalized subject, picks the latest
// delivered one per group, prints its text body + extracted href links, then
// HTTP-checks every unique link.
//
// Usage: node scripts/qa-email-inspect.mjs [limit]
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const RK = env.RESEND_API_KEY
const LIMIT = parseInt(process.argv[2] || '80', 10)
async function rget(p, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const r = await fetch(`https://api.resend.com${p}`, { headers: { Authorization: `Bearer ${RK}` } })
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 800)); continue }
    if (!r.ok) return { __err: r.status }
    return r.json()
  }
  return { __err: '429' }
}
// normalize a subject into a type key: drop trailing " — Name", dates, digits.
function typeKey(s) {
  return (s || '').replace(/—.*$/, '').replace(/[0-9]+/g, '#').trim().toLowerCase()
}
const list = await rget(`/emails?limit=${LIMIT}`)
const rows = list.data || []
const byType = new Map()
for (const r of rows) {
  const k = typeKey(r.subject)
  // prefer a delivered send to a real (non example/englishkolab-test) inbox
  const realish = /gmail|outlook|yahoo|hotmail|clienttether/.test((r.to || []).join(','))
  const prev = byType.get(k)
  const score = (r.last_event === 'delivered' ? 2 : 0) + (realish ? 1 : 0)
  if (!prev || score > prev.score) byType.set(k, { row: r, score })
}
const links = new Set()
console.log(`=== ${byType.size} email types (representative real send each) ===\n`)
for (const { row } of [...byType.values()]) {
  const full = await rget(`/emails/${row.id}`)
  if (full.__err) { console.log(`[${row.subject}] fetch err ${full.__err}`); continue }
  const hrefs = [...(full.html || '').matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  hrefs.forEach((h) => { if (/^https?:/.test(h)) links.add(h) })
  console.log(`● ${row.subject}`)
  console.log(`   to:${(row.to || []).join(',')}  status:${row.last_event}  ${row.created_at?.slice(0, 16)}`)
  console.log(`   links: ${[...new Set(hrefs)].join('  ') || '(none)'}`)
  const txt = (full.text || '').replace(/\n{2,}/g, ' / ').slice(0, 280)
  console.log(`   text: ${txt}`)
  console.log('')
  await new Promise((s) => setTimeout(s, 130))
}
// HTTP-check unique links (mailto excluded).
console.log(`=== link health (${links.size} unique) ===`)
for (const u of [...links].sort()) {
  if (/^mailto:/.test(u)) continue
  try {
    const r = await fetch(u, { method: 'GET', redirect: 'manual' })
    const loc = r.headers.get('location')
    console.log(`   ${r.status}${loc ? ' -> ' + loc : ''}  ${u}`)
  } catch (e) {
    console.log(`   ERR ${e.message}  ${u}`)
  }
}
