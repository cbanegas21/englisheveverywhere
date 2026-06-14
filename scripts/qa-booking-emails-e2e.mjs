// LIVE end-to-end verification of the consolidated booking-email path (post the
// double-send fix). Stages a throwaway student (Mexico City tz / es) + teacher
// (Madrid tz / en) + a pending class booking, then:
//   1) teacher logs in + confirms  -> confirmBooking -> scheduleBookingReminders
//      ASSERT: exactly ONE confirmation per recipient (no double-send), each in
//      the recipient's OWN timezone (GMT-5 student / GMT+2 teacher, NOT Honduras
//      GMT-6) and OWN language (es / en), plus 4 reminders scheduled on Resend.
//   2) student logs in + cancels   -> studentCancelBooking -> cancelBookingReminders
//      ASSERT: all 4 scheduled reminder sends flip to 'canceled'.
// Cleans up the throwaway accounts + cancels any leftover scheduled emails.
//
// Run: node scripts/qa-booking-emails-e2e.mjs
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const BASE = 'https://englishkolab.com'
const RK = env.RESEND_API_KEY
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PW = 'QaEmail2026!'
const stamp = Date.now()
const studentEmail = `c.banegaspaz2020+ekbkS${stamp}@gmail.com`
const teacherEmail = `c.banegaspaz2020+ekbkT${stamp}@gmail.com`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function rget(p, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const r = await fetch(`https://api.resend.com${p}`, { headers: { Authorization: `Bearer ${RK}` } })
    if (r.status === 429) { await sleep(700); continue }
    if (!r.ok) return { __err: r.status }
    return r.json()
  }
  return { __err: '429' }
}
async function resendTo(addr) {
  const j = await rget('/emails?limit=100')
  return (j.data || []).filter((e) => (e.to || []).includes(addr))
}
const PASS = []; const FAIL = []
const check = (cond, msg) => (cond ? PASS : FAIL).push(msg)

let sUserId, tUserId, sStudentId, tTeacherId, bookingId
try {
  // ── Stage accounts ─────────────────────────────────────────────────────────
  const mk = async (email, role, full, tz, lang) => {
    const { data, error } = await sb.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: { full_name: full, role } })
    if (error) throw new Error(`createUser ${role}: ${error.message}`)
    const id = data.user.id
    await sb.from('profiles').update({ role, full_name: full, timezone: tz, preferred_language: lang, email }).eq('id', id)
    return id
  }
  // Teacher Madrid (GMT+2 CEST in June), student New York (GMT-4 EDT in June) —
  // both DISTINCT from Honduras GMT-6, so per-recipient tz is unambiguous. (Avoid
  // Mexico City: it dropped DST in 2023, so it's GMT-6 year-round = same as Honduras.)
  tUserId = await mk(teacherEmail, 'teacher', 'QA EmailTeacher', 'Europe/Madrid', 'en')
  sUserId = await mk(studentEmail, 'student', 'QA EmailStudent', 'America/New_York', 'es')
  ;({ data: { id: tTeacherId } } = await sb.from('teachers').upsert({ profile_id: tUserId, is_active: true, hourly_rate: 20, bio: 'qa', specializations: [] }, { onConflict: 'profile_id' }).select('id').single())
  ;({ data: { id: sStudentId } } = await sb.from('students').upsert({ profile_id: sUserId, classes_remaining: 5 }, { onConflict: 'profile_id' }).select('id').single())
  const scheduledAt = new Date(stamp + 3 * 86400000).toISOString()
  ;({ data: { id: bookingId } } = await sb.from('bookings').insert({ student_id: sStudentId, teacher_id: tTeacherId, scheduled_at: scheduledAt, duration_minutes: 60, status: 'pending', type: 'class' }).select('id').single())
  console.log('staged: booking', bookingId, '| student', studentEmail, '| teacher', teacherEmail, '| at', scheduledAt)

  // ── Step 1: teacher confirms ─────────────────────────────────────────────────
  const b = await chromium.launch()
  const tctx = await b.newContext({ locale: 'es-HN' })
  const tp = await tctx.newPage()
  await tp.goto(`${BASE}/es/login`, { waitUntil: 'load' }); await tp.waitForTimeout(500)
  await tp.fill('input[type=email]', teacherEmail); await tp.fill('input[type=password]', PW)
  await tp.click('button[type=submit]'); await tp.waitForURL('**/maestro/**', { timeout: 30000 }).catch(() => {})
  await tp.goto(`${BASE}/es/maestro/dashboard/agenda`, { waitUntil: 'load' }); await tp.waitForTimeout(1500)
  const confirmBtn = tp.getByRole('button', { name: 'Puedo impartirla' }).first()
  const hasConfirm = await confirmBtn.count()
  check(hasConfirm > 0, `teacher agenda shows the pending booking + confirm button (${hasConfirm})`)
  if (hasConfirm) { await confirmBtn.click(); await tp.waitForTimeout(2500) }
  await tctx.close()

  // poll DB for scheduled_email_ids to persist (scheduleBookingReminders is fire-and-forget)
  let ids = []
  for (let i = 0; i < 12; i++) {
    const { data } = await sb.from('bookings').select('status, scheduled_email_ids').eq('id', bookingId).single()
    if (data?.scheduled_email_ids?.length) { ids = data.scheduled_email_ids; break }
    await sleep(2500)
  }
  check(ids.length === 4, `4 reminder emails scheduled + persisted on booking (got ${ids.length})`)
  await sleep(3000) // let confirmation sends index in Resend

  // confirmations: exactly one per recipient, in their own tz + lang
  const sMail = await resendTo(studentEmail)
  const tMail = await resendTo(teacherEmail)
  const sConf = sMail.filter((e) => /confirmada|confirmed/i.test(e.subject || ''))
  const tConf = tMail.filter((e) => /confirmada|confirmed/i.test(e.subject || ''))
  check(sConf.length === 1, `student got exactly ONE confirmation (got ${sConf.length}: ${sConf.map((e) => e.subject).join(' | ')})`)
  check(tConf.length === 1, `teacher got exactly ONE confirmation (got ${tConf.length}: ${tConf.map((e) => e.subject).join(' | ')})`)
  if (sConf[0]) {
    const full = await rget(`/emails/${sConf[0].id}`)
    const body = `${full.html || ''}${full.text || ''}`
    check(/está confirmada/i.test(full.subject || ''), `student confirmation is Spanish ("${full.subject}")`)
    check(/GMT-4/.test(body), `student confirmation renders New York tz GMT-4 (not Honduras GMT-6)`)
    check(!/hora de Honduras|Honduras time/i.test(body), `student confirmation NOT hardcoded Honduras`)
  }
  if (tConf[0]) {
    const full = await rget(`/emails/${tConf[0].id}`)
    const body = `${full.html || ''}${full.text || ''}`
    check(/is confirmed/i.test(full.subject || ''), `teacher confirmation is English ("${full.subject}")`)
    check(/GMT\+2/.test(body), `teacher confirmation renders Madrid tz GMT+2 (not Honduras)`)
  }
  // scheduled reminders have a future scheduled_at
  let schedOk = 0
  for (const id of ids) { const e = await rget(`/emails/${id}`); if (e.scheduled_at) schedOk++ }
  check(schedOk === ids.length && ids.length > 0, `all ${ids.length} reminders have a scheduled_at (${schedOk})`)

  // ── Step 2: student cancels -> cancelBookingReminders ────────────────────────
  const sctx = await b.newContext({ locale: 'es-HN' })
  const spg = await sctx.newPage()
  await spg.goto(`${BASE}/es/login`, { waitUntil: 'load' }); await spg.waitForTimeout(500)
  await spg.fill('input[type=email]', studentEmail); await spg.fill('input[type=password]', PW)
  await spg.click('button[type=submit]'); await spg.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
  await spg.goto(`${BASE}/es/dashboard/clases`, { waitUntil: 'load' }); await spg.waitForTimeout(1500)
  // The per-class actions (Reagendar / Cancelar clase / Reportar) live behind a
  // kebab menu (aria-label "Acciones"). Open it first, then click Cancelar clase.
  const kebab = spg.getByRole('button', { name: 'Acciones' }).first()
  const hasKebab = await kebab.count()
  check(hasKebab > 0, `student My Classes shows the confirmed class + actions menu (${hasKebab})`)
  if (hasKebab) {
    await kebab.click(); await spg.waitForTimeout(400)
    const cancelItem = spg.getByRole('button', { name: 'Cancelar clase' }).first()
    if (await cancelItem.count()) { await cancelItem.click(); await spg.waitForTimeout(600) }
    const yes = spg.getByRole('button', { name: 'Sí, cancelar' }).first()
    if (await yes.count()) { await yes.click(); await spg.waitForTimeout(3000) }
  }
  await sctx.close(); await b.close()

  // verify the scheduled reminders were canceled
  await sleep(3000)
  let canceled = 0
  for (const id of ids) { const e = await rget(`/emails/${id}`); if ((e.last_event || '') === 'canceled') canceled++ }
  check(ids.length > 0 && canceled === ids.length, `all ${ids.length} scheduled reminders canceled after student cancel (${canceled})`)
  const { data: after } = await sb.from('bookings').select('status, scheduled_email_ids').eq('id', bookingId).single()
  check((after?.scheduled_email_ids || []).length === 0, `booking.scheduled_email_ids cleared after cancel`)
  check(after?.status === 'cancelled', `booking status = cancelled (${after?.status})`)
} catch (e) {
  FAIL.push('EXCEPTION: ' + e.message)
  console.error(e)
} finally {
  // cleanup: cancel any leftover scheduled emails, delete throwaway data
  try {
    if (bookingId) {
      const { data } = await sb.from('bookings').select('scheduled_email_ids').eq('id', bookingId).single()
      for (const id of (data?.scheduled_email_ids || [])) { await fetch(`https://api.resend.com/emails/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${RK}` } }).catch(() => {}) }
      await sb.from('bookings').delete().eq('id', bookingId)
    }
    if (sStudentId) await sb.from('students').delete().eq('id', sStudentId)
    if (tTeacherId) await sb.from('teachers').delete().eq('id', tTeacherId)
    if (sUserId) await sb.auth.admin.deleteUser(sUserId)
    if (tUserId) await sb.auth.admin.deleteUser(tUserId)
    console.log('cleanup done')
  } catch (e) { console.log('cleanup ERR (manual):', e.message, '| student', studentEmail, '| teacher', teacherEmail) }
}

console.log('\n===== RESULTS =====')
for (const p of PASS) console.log('  PASS ✅', p)
for (const f of FAIL) console.log('  FAIL ❌', f)
console.log(`\n${PASS.length} passed, ${FAIL.length} failed`)
process.exit(FAIL.length ? 1 : 0)
