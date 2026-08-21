// Can a real client actually REACH Stripe checkout on LIVE right now?
//
// The signed-webhook harness (qa-webhook-signed.mjs) proves the credit engine
// AFTER Stripe fires. This proves the half before it: a logged-in student on
// the live plan page clicks "Pagar ahora" and lands on a real hosted Stripe
// Checkout page for the right plan at the right amount, with the metadata the
// webhook needs. Creates a live checkout session but NEVER enters a card, so
// nothing is charged (it just expires, like every other session in the account).
//
// Throwaway student, full cleanup.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }

const BASE = 'https://englishkolab.com'
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY
const TOK = process.env.SUPABASE_ACCESS_TOKEN
const SK = process.env.STRIPE_SECRET_KEY
const REF = (SUPA || '').match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]

const R = []
const ok = (n, c, d = '') => { R.push(c); console.log(`${c ? '✅' : '❌'} ${n}${d ? '  — ' + d : ''}`) }

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
const stripe = async path => (await fetch(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${SK}` } })).json()

const email = `qa-checkout-${Date.now()}@example.com`, pass = 'QaPay2026!'
let uid = null
const b = await chromium.launch()

try {
  uid = (await au('POST', '', { email, password: pass, email_confirm: true, user_metadata: { role: 'student', full_name: 'QA Checkout' } })).id
  await sql(`update profiles set role='student' where id='${uid}'`)
  const sid = (await sql(`insert into students (profile_id, classes_remaining, intake_done, level) values ('${uid}', 0, true, 'A2') returning id`))?.[0]?.id
  ok('stage throwaway student', !!sid, `sid=${sid}`)

  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } })
  const p = await ctx.newPage()
  const errs = []
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })

  await p.goto(`${BASE}/es/login`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  await p.fill('input[name="email"]', email)
  await p.fill('input[name="password"]', pass)
  await p.getByRole('button', { name: /^(ingresar|log in)$/i }).click()
  await p.waitForTimeout(3500)

  await p.goto(`${BASE}/es/dashboard/plan`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  ok('plan page loads for student', /\/dashboard\/plan/.test(p.url()), p.url())

  // Each plan card carries an "Empezar" button -> handleSelectPlan -> pay modal.
  // With 0 credits it opens the pay modal directly (no add-more confirm).
  const select = p.getByRole('button', { name: /^(empezar|get started)$/i }).first()
  const hasSelect = (await select.count()) > 0
  ok('plan cards render a select button', hasSelect)
  if (hasSelect) { await select.click(); await p.waitForTimeout(1200) }

  const pay = p.getByRole('button', { name: /pagar ahora|pay now/i }).first()
  const hasPay = (await pay.count()) > 0
  ok('"Pagar ahora" button present', hasPay)

  let stripeUrl = ''
  if (hasPay) {
    await pay.click()
    // The server action returns a URL and the client navigates; give it room.
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(1000)
      if (/checkout\.stripe\.com/.test(p.url())) { stripeUrl = p.url(); break }
    }
  }
  ok('lands on real Stripe Checkout', /checkout\.stripe\.com/.test(stripeUrl), stripeUrl.slice(0, 80))

  if (stripeUrl) {
    await p.waitForLoadState('networkidle').catch(() => {})
    await p.waitForTimeout(2500)
    await p.screenshot({ path: 'docs/_qa-evidence/checkout-live.png' }).catch(() => {})
    // innerText, not textContent — textContent includes <style> bodies and the
    // page ships a large inline stylesheet, which silently matched "$" before.
    // Assert on the line item (stable), NOT on a price string: Adaptive Pricing
    // is enabled, so the amount on screen is the viewer's LOCAL currency
    // (HNL 3,590.00 from Honduras) and hardcoding "129" is a false failure.
    // The authoritative amount check is the Stripe API assertion below.
    const seen = (await p.locator('body').innerText().catch(() => '')) || ''
    ok('checkout page renders the EnglishKolab line item', /englishkolab/i.test(seen), seen.replace(/\s+/g, ' ').slice(0, 100))
  }

  // Verify the session Stripe actually created: live mode, right amount, right metadata.
  const sessions = await stripe(`/checkout/sessions?limit=3`)
  const mine = (sessions.data || []).find(s => (s.metadata || {}).user_id === uid)
  ok('Stripe session created for this user', !!mine, mine ? mine.id : 'none found')
  if (mine) {
    // Amount must match the pinned price for whichever plan was selected — this
    // is the exact figure the webhook re-verifies before granting credit.
    const PRICES = { spark: 12900, drive: 17900, ascent: 21900, peak: 25900 }
    const key = (mine.metadata || {}).plan_key
    ok('metadata carries plan_key the webhook reads', !!PRICES[key], JSON.stringify(mine.metadata))
    ok(`amount matches pinned price for "${key}"`, mine.amount_total === PRICES[key], `amount_total=${mine.amount_total} expected=${PRICES[key]}`)
    ok('currency usd', mine.currency === 'usd', mine.currency)
    ok('LIVE mode (not test keys)', mine.livemode === true, `livemode=${mine.livemode}`)
    ok('unpaid until a card is entered', mine.payment_status === 'unpaid', mine.payment_status)
  }

  ok('no console errors on the paid path', errs.length === 0, errs.slice(0, 2).join(' | '))
  await ctx.close()
} catch (e) {
  ok('harness completed without throwing', false, String(e).slice(0, 160))
} finally {
  await b.close()
  if (uid) {
    await sql(`delete from student_purchases where student_id in (select id from students where profile_id='${uid}')`)
    await au('DELETE', `/${uid}`)
    console.log('cleaned throwaway student')
  }
  const pass_ = R.filter(Boolean).length
  console.log(`\n========== CHECKOUT REACH: ${pass_} PASS / ${R.length - pass_} FAIL ==========`)
}
