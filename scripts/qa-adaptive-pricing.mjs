// ⚠ HIGHEST-RISK QUESTION ON THE PLATFORM:
// Stripe Adaptive Pricing is ENABLED on the live account, so a Honduran client
// sees "HNL 3,590.00" selected by default, not "$129.00". The webhook credits
// classes ONLY when `session.currency === 'usd'` AND `amount_total === 12900`.
// If a paid-in-HNL session reports currency 'hnl' / amount 359000, the customer
// is charged and receives NOTHING but a Sentry error.
//
// This proves the answer end-to-end instead of guessing at docs:
//   1. create a TEST-mode session shaped exactly like createCheckoutSession
//   2. drive the hosted page, SELECT HNL, pay with test card 4242
//   3. read back what Stripe actually put in currency / amount_total
//   4. take that real event object, point it at a throwaway student, sign it
//      with the LIVE webhook secret and POST it to the LIVE webhook
//   5. assert whether classes actually landed
//
// No real money: the card charge is test-mode. Step 4 exercises the real
// production credit engine with a throwaway student, then cleans up.
import { readFileSync } from 'node:fs'
import crypto from 'node:crypto'
import { chromium } from '@playwright/test'
for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }

const BASE = 'https://englishkolab.com'
const TSK = process.env.STRIPE_TEST_SECRET_KEY
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY
const TOK = process.env.SUPABASE_ACCESS_TOKEN
const REF = (SUPA || '').match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]

const R = []
const ok = (n, c, d = '') => { R.push(c); console.log(`${c ? '✅' : '❌'} ${n}${d ? '  — ' + d : ''}`) }
const note = s => console.log(`   ℹ ${s}`)

const sapi = async (path, body) => (await fetch(`https://api.stripe.com/v1${path}`, {
  method: body ? 'POST' : 'GET',
  headers: { Authorization: `Bearer ${TSK}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
})).json()
async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  return r.ok ? r.json() : null
}
async function au(m, p, b) {
  const r = await fetch(`${SUPA}/auth/v1/admin/users${p}`, {
    method: m, headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  })
  const t = await r.text(); return t ? JSON.parse(t) : null
}

// ---- 1. test-mode session mirroring the app -------------------------------
const form = new URLSearchParams()
form.set('mode', 'payment')
form.set('line_items[0][quantity]', '1')
form.set('line_items[0][price_data][currency]', 'usd')
form.set('line_items[0][price_data][unit_amount]', '12900')
form.set('line_items[0][price_data][product_data][name]', 'EnglishKolab Classes')
form.set('success_url', `${BASE}/es/dashboard/plan?success=1&plan=spark`)
form.set('cancel_url', `${BASE}/es/dashboard/plan?cancelled=1`)
form.set('metadata[plan_key]', 'spark')
form.set('metadata[lang]', 'es')
const session = await sapi('/checkout/sessions', form)
ok('test-mode checkout session created', !!session.url, session.id || JSON.stringify(session.error || {}).slice(0, 140))
if (!session.url) process.exit(1)
note(`adaptive_pricing in TEST mode: ${JSON.stringify(session.adaptive_pricing)}`)
note(`presentment: ${JSON.stringify(session.presentment_details)}`)

// ---- 2. pay in HNL on the hosted page -------------------------------------
const browser = await chromium.launch()
const ctx = await browser.newContext()
const p = await ctx.newPage()
let pickedHnl = false
try {
  await p.goto(session.url, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(4000)
  // Adaptive Pricing renders a currency chooser; pick the LOCAL one (HNL).
  const hnl = p.getByText(/HNL\s?[\d,]/i).first()
  if (await hnl.count()) { await hnl.click().catch(() => {}); pickedHnl = true; await p.waitForTimeout(2000) }
  ok('local-currency (HNL) option offered and selected', pickedHnl)

  const fill = async (sel, val) => { const el = p.locator(sel).first(); if (await el.count()) await el.fill(val).catch(() => {}) }
  await fill('input#email, input[name="email"]', 'qa-adaptive@example.com')
  await fill('input#cardNumber, input[name="cardNumber"]', '4242424242424242')
  await fill('input#cardExpiry, input[name="cardExpiry"]', '12 / 34')
  await fill('input#cardCvc, input[name="cardCvc"]', '123')
  await fill('input#billingName, input[name="billingName"]', 'QA Adaptive')
  await fill('input#billingPostalCode, input[name="billingPostalCode"]', '11101')
  await p.waitForTimeout(800)
  await p.locator('button[type="submit"], .SubmitButton').first().click().catch(() => {})
  await p.waitForURL(u => !/checkout\.stripe\.com/.test(u.href), { timeout: 45000 }).catch(() => {})
} catch (e) { note(`drive note: ${String(e).slice(0, 100)}`) }
await p.screenshot({ path: 'docs/_qa-evidence/adaptive-hnl.png' }).catch(() => {})
await browser.close()

// ---- 3. what did Stripe actually record? ----------------------------------
await new Promise(r => setTimeout(r, 3000))
const paidSession = await sapi(`/checkout/sessions/${session.id}`)
ok('test payment completed', paidSession.payment_status === 'paid', `payment_status=${paidSession.payment_status}`)
console.log('\n──────── WHAT STRIPE SENDS AFTER AN HNL PAYMENT ────────')
for (const k of ['currency', 'amount_total', 'amount_subtotal', 'currency_conversion', 'presentment_details']) {
  console.log(`   ${k}: ${JSON.stringify(paidSession[k])}`)
}
console.log('────────────────────────────────────────────────────────\n')

const gatePasses = paidSession.currency === 'usd' && paidSession.amount_total === 12900
ok('webhook gate (currency===usd && amount_total===12900) would PASS', gatePasses,
  `currency=${paidSession.currency} amount_total=${paidSession.amount_total}`)

// ---- 4/5. replay that real object at the LIVE webhook, throwaway student ---
let uid = null
try {
  const email = `qa-adaptive-${Date.now()}@example.com`
  uid = (await au('POST', '', { email, password: 'QaPay2026!', email_confirm: true, user_metadata: { role: 'student', full_name: 'QA Adaptive' } })).id
  await sql(`update profiles set role='student' where id='${uid}'`)
  const sid = (await sql(`insert into students (profile_id, classes_remaining, intake_done) values ('${uid}', 0, true) returning id`))?.[0]?.id
  ok('throwaway student staged (0 credits)', !!sid, `sid=${sid}`)

  // Real paid-session object, retargeted at our throwaway student.
  const obj = { ...paidSession, metadata: { ...(paidSession.metadata || {}), user_id: uid, plan_key: 'spark', lang: 'es' } }
  const event = {
    id: `evt_qa_adaptive_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: { object: obj },
  }
  const payload = JSON.stringify(event)
  const ts = Math.floor(Date.now() / 1000)
  const sig = crypto.createHmac('sha256', WHSEC).update(`${ts}.${payload}`, 'utf8').digest('hex')
  const res = await fetch(`${BASE}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` },
    body: payload,
  })
  const body = await res.text()
  note(`live webhook responded ${res.status} ${body.slice(0, 120)}`)

  await new Promise(r => setTimeout(r, 2500))
  const row = (await sql(`select classes_remaining, current_plan from students where id='${sid}'`))?.[0]
  const credited = (row?.classes_remaining || 0) === 8
  ok('⭐ REAL-WORLD VERDICT: an HNL payment credits the student', credited,
    `classes_remaining=${row?.classes_remaining} plan=${row?.current_plan}`)
  if (!credited) console.log('\n   🔴 A client paying in local currency would be CHARGED AND GET NOTHING.\n')

  await sql(`delete from student_purchases where student_id='${sid}'`)
  await sql(`delete from processed_stripe_events where id='${event.id}'`)
} catch (e) {
  ok('live-webhook replay completed', false, String(e).slice(0, 160))
} finally {
  if (uid) { await au('DELETE', `/${uid}`); console.log('cleaned throwaway student') }
  const pass = R.filter(Boolean).length
  console.log(`\n========== ADAPTIVE PRICING: ${pass} PASS / ${R.length - pass} FAIL ==========`)
}
