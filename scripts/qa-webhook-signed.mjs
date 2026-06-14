// Exercise the LIVE Stripe webhook credit engine without a real card: build
// properly-SIGNED synthetic events (STRIPE_WEBHOOK_SECRET) and POST them to
// PROD, asserting credit math, idempotency/replay, amount/plan verification,
// signature rejection, and refund decrement + per-charge guard. Throwaway
// student + full cleanup (purchases + processed_stripe_events + user).
import { readFileSync } from 'node:fs'
import crypto from 'node:crypto'
for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const BASE = 'https://englishkolab.com', SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL, SRK = process.env.SUPABASE_SERVICE_ROLE_KEY, TOK = process.env.SUPABASE_ACCESS_TOKEN
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET
const REF = (SUPA || '').match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
const SPARK_CENTS = 12900, SPARK_CLASSES = 8
async function sql(q) { const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) }); return r.ok ? r.json() : null }
async function au(m, p, b) { const r = await fetch(`${SUPA}/auth/v1/admin/users${p}`, { method: m, headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null }
const bal = async sid => (await sql(`select classes_remaining, current_plan from students where id='${sid}'`))?.[0]
const purchases = async sid => (await sql(`select count(*)::int c from student_purchases where student_id='${sid}'`))?.[0]?.c

// Sign + POST a synthetic Stripe event to the prod webhook (Stripe scheme).
async function postEvent(eventObj, { badSig = false, noSig = false } = {}) {
  const payload = JSON.stringify(eventObj)
  const ts = Math.floor(Date.now() / 1000)
  const secret = badSig ? 'whsec_totally_wrong_secret' : WHSEC
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${payload}`, 'utf8').digest('hex')
  const headers = { 'Content-Type': 'application/json' }
  if (!noSig) headers['stripe-signature'] = `t=${ts},v1=${sig}`
  const r = await fetch(`${BASE}/api/stripe/webhook`, { method: 'POST', headers, body: payload })
  const text = await r.text()
  return { status: r.status, body: text.slice(0, 120) }
}
const evtCheckout = (uid, { id, sessionId, plan = 'spark', cents = SPARK_CENTS, status = 'paid', mode = 'payment', cur = 'usd' }) => ({
  id, type: 'checkout.session.completed',
  data: { object: { id: sessionId, object: 'checkout.session', metadata: { user_id: uid, plan_key: plan }, payment_status: status, mode, currency: cur, amount_total: cents } },
})
const evtRefund = (uid, { id, chargeId, plan = 'spark', amount = SPARK_CENTS, refunded = SPARK_CENTS }) => ({
  id, type: 'charge.refunded',
  data: { object: { id: chargeId, object: 'charge', amount, amount_refunded: refunded, metadata: { user_id: uid, plan_key: plan } } },
})

const TS = Date.now()
const evtIds = []
const email = `qa-wh-${TS}@example.com`
const uid = (await au('POST', '', { email, password: 'QaWh2026!', email_confirm: true, user_metadata: { role: 'student', full_name: 'QA WH' } })).id
await sql(`update profiles set role='student' where id='${uid}'`)
const sid = (await sql(`insert into students (profile_id, classes_remaining) values ('${uid}', 0) returning id`))[0].id
const pass = (b) => b ? '✅' : '❌'
try {
  console.log('webhook secret present:', !!WHSEC, '| spark = $129 / 8 classes\n')

  // 1. valid checkout -> credit 8 + plan spark + purchase row
  const e1 = `evt_qa_${TS}_1`; evtIds.push(e1)
  const r1 = await postEvent(evtCheckout(uid, { id: e1, sessionId: `cs_qa_${TS}_1` }))
  const b1 = await bal(sid)
  console.log(`1) valid checkout: http=${r1.status} ${r1.body} | bal=${b1?.classes_remaining} plan=${b1?.current_plan} purchases=${await purchases(sid)} => ${pass(r1.status === 200 && b1?.classes_remaining === SPARK_CLASSES && b1?.current_plan === 'spark')}`)

  // 2. replay SAME event id -> duplicate, no double-credit
  const r2 = await postEvent(evtCheckout(uid, { id: e1, sessionId: `cs_qa_${TS}_1` }))
  const b2 = await bal(sid)
  console.log(`2) replay same event: http=${r2.status} ${r2.body} | bal=${b2?.classes_remaining} => ${pass(/duplicate/.test(r2.body) && b2?.classes_remaining === SPARK_CLASSES)}`)

  // 3. amount mismatch (new event, wrong amount_total) -> no credit
  const e3 = `evt_qa_${TS}_3`; evtIds.push(e3)
  const r3 = await postEvent(evtCheckout(uid, { id: e3, sessionId: `cs_qa_${TS}_3`, cents: 100 }))
  const b3 = await bal(sid)
  console.log(`3) amount mismatch ($1): http=${r3.status} | bal still ${b3?.classes_remaining} => ${pass(b3?.classes_remaining === SPARK_CLASSES)} (no extra credit)`)

  // 4. unknown plan_key -> no credit
  const e4 = `evt_qa_${TS}_4`; evtIds.push(e4)
  const r4 = await postEvent(evtCheckout(uid, { id: e4, sessionId: `cs_qa_${TS}_4`, plan: 'bogus', cents: SPARK_CENTS }))
  const b4 = await bal(sid)
  console.log(`4) unknown plan_key: http=${r4.status} | bal still ${b4?.classes_remaining} => ${pass(b4?.classes_remaining === SPARK_CLASSES)} (no extra credit)`)

  // 5. forged signature -> 400, no credit
  const e5 = `evt_qa_${TS}_5`
  const r5 = await postEvent(evtCheckout(uid, { id: e5, sessionId: `cs_qa_${TS}_5` }), { badSig: true })
  const b5 = await bal(sid)
  console.log(`5) forged signature: http=${r5.status} ${r5.body} | bal=${b5?.classes_remaining} => ${pass(r5.status === 400 && b5?.classes_remaining === SPARK_CLASSES)}`)

  // 6. no signature -> 400
  const r6 = await postEvent(evtCheckout(uid, { id: `evt_qa_${TS}_6`, sessionId: `cs_qa_${TS}_6` }), { noSig: true })
  console.log(`6) no signature: http=${r6.status} ${r6.body} => ${pass(r6.status === 400)}`)

  // 7. full refund -> decrement to 0 + clear plan
  const e7 = `evt_qa_${TS}_7`; evtIds.push(e7)
  const chId = `ch_qa_${TS}`
  const r7 = await postEvent(evtRefund(uid, { id: e7, chargeId: chId }))
  const b7 = await bal(sid)
  console.log(`7) full refund: http=${r7.status} | bal ${SPARK_CLASSES}->${b7?.classes_remaining} plan=${b7?.current_plan} => ${pass(r7.status === 200 && b7?.classes_remaining === 0 && b7?.current_plan === null)}`)

  // 8. replay refund (new event id, SAME charge) -> per-charge guard, no double-decrement
  const e8 = `evt_qa_${TS}_8`; evtIds.push(e8)
  const r8 = await postEvent(evtRefund(uid, { id: e8, chargeId: chId }))
  const b8 = await bal(sid)
  console.log(`8) replay refund (same charge): http=${r8.status} | bal still ${b8?.classes_remaining} => ${pass(b8?.classes_remaining === 0)} (no double-decrement below 0)`)

  // 9. UNKNOWN EVENT TYPE (signed, well-formed) -> ack 200, no credit, default branch
  const e9 = `evt_qa_${TS}_9`; evtIds.push(e9)
  const r9 = await postEvent({ id: e9, type: 'customer.subscription.updated', data: { object: { id: `sub_qa_${TS}` } } })
  const b9 = await bal(sid)
  console.log(`9) unknown event type: http=${r9.status} ${r9.body} | bal still ${b9?.classes_remaining} => ${pass(r9.status === 200 && b9?.classes_remaining === 0)} (ignored, no credit)`)

  // 10. MALFORMED but SIGNED (checkout with data.object=null) -> must NOT permanently
  //     swallow: handler throws, ledger claim released, 500 for a clean Stripe retry.
  const e10 = `evt_qa_${TS}_10`; evtIds.push(e10)
  const r10 = await postEvent({ id: e10, type: 'checkout.session.completed', data: { object: null } })
  const ledger10 = (await sql(`select count(*)::int c from processed_stripe_events where id='${e10}'`))?.[0]?.c
  const b10 = await bal(sid)
  console.log(`10) malformed signed payload: http=${r10.status} ${r10.body} | ledger-row-kept=${ledger10} bal=${b10?.classes_remaining} => ${pass(r10.status === 500 && ledger10 === 0 && b10?.classes_remaining === 0)} (released for retry, no credit)`)

  // 11. OUT-OF-ORDER: a refund arrives with NO prior matching checkout credit (bal
  //     already 0) -> floored decrement stays 0, never negative, 200.
  const e11 = `evt_qa_${TS}_11`; evtIds.push(e11)
  const chId2 = `ch_qa_${TS}_ooo`
  const r11 = await postEvent(evtRefund(uid, { id: e11, chargeId: chId2 }))
  const b11 = await bal(sid)
  console.log(`11) out-of-order refund (no prior credit): http=${r11.status} | bal=${b11?.classes_remaining} => ${pass(r11.status === 200 && b11?.classes_remaining === 0)} (floored at 0)`)
} catch (e) { console.log('ERR', e.message, e.stack) } finally {
  await sql(`delete from student_purchases where student_id='${sid}'`)
  await sql(`delete from processed_stripe_events where id = any(array[${evtIds.map(i => `'${i}'`).join(',')}, 'refund-ch_qa_${TS}', 'refund-ch_qa_${TS}_ooo'])`)
  await au('DELETE', `/${uid}`)
  console.log('\ncleaned throwaway student + test events')
}
