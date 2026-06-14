// QA: audit ACTUAL Resend send-history for encoding/branding/link/dynamic-data
// defects. Reads the last N sent emails via the (full-access) Resend API, fetches
// each one's full html+text+subject, and scans for real-world corruption markers.
//
// Distinct from qa-email-render.mjs (which screenshots hard-coded template samples)
// — this audits what was REALLY sent + delivery status.
//
// NOTE: do NOT pipe Resend curl output through python on Windows — python's cp1252
// stdin codec mangles raw UTF-8 into fake mojibake. Node fetch decodes correctly;
// this script is the source of truth. Regexes use \u escapes so a real Ã³ (U+00C3
// U+00B3) is actually caught — a char class like [-ÿ] is the 2-char set {-,ÿ}, NOT
// a range, and silently misses everything (learned the hard way).
//
// Usage: node scripts/qa-email-audit.mjs [limit]   (default 100)
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const RK = env.RESEND_API_KEY
if (!RK) throw new Error('no RESEND_API_KEY')
const LIMIT = parseInt(process.argv[2] || '100', 10)

// Mojibake signatures (UTF-8 mis-decoded as Latin-1/Win-1252) + lossy decode.
const MOJI = [
  { re: /[ÃÂ][-ÿ]/g, label: "UTF8-as-Latin1 (mojibake)" },
  { re: /â€[-⃿]/g, label: "em-dash/quote mojibake" },
  { re: /�/g, label: "U+FFFD replacement char" },
]
const BRAND = [{ re: /English\s+Everywhere/gi, label: 'WRONG BRAND "English Everywhere"' }]
const LINKS = [{ re: /localhost|127\.0\.0\.1|http:\/\//g, label: 'insecure/local link' }]
const HOLES = [
  { re: /\bundefined\b/g, label: 'undefined' },
  { re: /\bNaN\b/g, label: 'NaN' },
  { re: /\[object Object\]/g, label: '[object Object]' },
]

function scan(s, sets) {
  const hits = []
  for (const { re, label } of sets) {
    const m = s.match(re)
    if (m) hits.push(`${label} x${m.length} [${[...new Set(m)].slice(0, 5).join(' ')}]`)
  }
  return hits
}
async function rget(path, tries = 3) {
  for (let t = 0; t < tries; t++) {
    const r = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${RK}` } })
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 700)); continue }
    if (!r.ok) return { __err: `${r.status}` }
    return r.json()
  }
  return { __err: '429-exhausted' }
}

const list = await rget(`/emails?limit=${LIMIT}`)
const rows = list.data || []
console.log(`Fetched ${rows.length} emails\n`)

const statusTally = {}
const flagged = []
let n = 0
for (const row of rows) {
  statusTally[row.last_event] = (statusTally[row.last_event] || 0) + 1
  const full = await rget(`/emails/${row.id}`)
  if (full.__err) { console.log(`  [${row.id}] fetch err ${full.__err}`); continue }
  const blob = `${full.subject || ''}\n${full.html || ''}\n${full.text || ''}`
  const issues = [
    ...scan(blob, BRAND),
    ...scan(blob, MOJI),
    ...scan(full.html || '', LINKS),
    ...scan(full.text || '', HOLES),
  ]
  if (issues.length) {
    flagged.push({ id: row.id, when: row.created_at?.slice(0, 19), to: (row.to || []).join(','), subject: row.subject, status: row.last_event, issues })
  }
  n++
  await new Promise((res) => setTimeout(res, 120)) // stay under Resend rate limit
}

console.log('Delivery status tally:', JSON.stringify(statusTally))
console.log(`\nScanned ${n} bodies. FLAGGED ${flagged.length}:\n`)
for (const f of flagged) {
  console.log(`* ${f.when} | ${f.status} | ${f.to}`)
  console.log(`   subj: ${f.subject}`)
  for (const i of f.issues) console.log(`   ! ${i}`)
  console.log(`   id: ${f.id}`)
}
