// Verify the fixes for the 2026-08-21 adversarial sweep. Runs against whatever
// QA_BASE points at (default live). Each check reproduces the ORIGINAL defect
// first where that is cheap, so a pass means the hole actually closed rather
// than that the assertion drifted.
//
//   AVAIL      teacher's own availability is visible in her editor (migration 062
//              dropped a FOR ALL policy and silently killed the SELECT, so the
//              editor rendered empty and the next save would wipe every slot)
//   BK6-01     admin cancel-with-refund actually cancels AND returns the credit
//              (wrote cancellation_reason 'admin_cancel', which the live CHECK
//              constraint rejects -> 23514 -> threw before the refund)
//   BK5-01     teacher home + ganancias show the real student name, not
//              "Estudiante" / "—" (RLS-null embed swallowed by a || fallback)
//   BK4-1      spending the LAST credit shows the success screen instead of
//              bouncing to /plan
//   BK4-2      reschedule interprets the typed wall-clock in the PROFILE zone,
//              not the browser's
import { chromium } from '@playwright/test'
import * as E from './qa-e2e-lib.mjs'

const R = E.reporter('SWEEP FIXES verify')
let tea, stu, stu2, adminUid
const b = await chromium.launch()

const nuke = async () => {
  if (stu) await E.nukeStudent(stu).catch(() => {})
  if (stu2) await E.nukeStudent(stu2).catch(() => {})
  if (tea) await E.nukeTeacher(tea).catch(() => {})
  if (adminUid) await E.au('DELETE', `/${adminUid}`).catch(() => {})
}

try {
  tea = await E.mkTeacher({ tag: 'fxv', active: true, rate: 20 })
  stu = await E.mkStudent({ tag: 'fxv', credits: 1 })
  // /agendar still (correctly) redirects when intake is incomplete — that guard is
  // untouched. Without this the last-credit test lands on /intake and proves nothing.
  await E.sql(`update students set intake_done=true, placement_test_done=true where id='${stu.sid}'`)
  R.ok('stage teacher + student', !!(tea.tid && stu.sid))

  // ── AVAIL: teacher must SEE her own slots ────────────────────────────────
  await E.sql(`insert into availability_slots (teacher_id, day_of_week, start_time, end_time, is_active)
               values ('${tea.tid}', 2, '09:00:00', '12:00:00', true),
                      ('${tea.tid}', 4, '14:00:00', '17:00:00', true)`)
  {
    const { ctx, p } = await E.loginCtx(b, tea.email, tea.pass, { lang: 'es' })
    await p.goto(`${E.BASE}/es/maestro/dashboard/disponibilidad`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2600)
    const body = (await p.locator('body').innerText().catch(() => '')) || ''
    // The editor renders the saved windows; either time string proves the read worked.
    R.ok('AVAIL: teacher sees her OWN saved availability in the editor',
      /09:00/.test(body) && /14:00/.test(body),
      body.replace(/\s+/g, ' ').slice(0, 120))
    await p.screenshot({ path: 'docs/_qa-evidence/fix-availability.png' }).catch(() => {})
    await ctx.close()
  }
  // And the rows are still there afterwards (no destructive read/replace side effect).
  const stillThere = Number((await E.sql(`select count(*)::int c from availability_slots where teacher_id='${tea.tid}'`))?.[0]?.c)
  R.ok('AVAIL: slots survive an editor visit', stillThere === 2, `slots=${stillThere}`)

  // ── BK5-01: real student name on teacher home + ganancias ────────────────
  const bkPast = await E.mkBooking({ sid: stu.sid, tid: tea.tid, hrs: -48, status: 'completed' })
  await E.sql(`insert into payments (booking_id, student_id, teacher_id, amount_usd, teacher_payout_usd, platform_fee_usd, status)
               values ('${bkPast}', '${stu.sid}', '${tea.tid}', 20, 20, 0, 'completed')`)
  const bkFuture = await E.mkBooking({ sid: stu.sid, tid: tea.tid, hrs: 48, status: 'confirmed' })
  const realName = (await E.sql(`select full_name from profiles where id='${stu.uid}'`))?.[0]?.full_name || ''
  R.ok('staged past+future bookings and know the student name', !!(bkPast && bkFuture && realName), realName)
  {
    const { ctx, p } = await E.loginCtx(b, tea.email, tea.pass, { lang: 'es' })
    await p.goto(`${E.BASE}/es/maestro/dashboard`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2600)
    const home = (await p.locator('body').innerText().catch(() => '')) || ''
    R.ok('BK5-01: teacher HOME shows the real student name (not "Estudiante")',
      home.includes(realName), home.includes('con Estudiante') ? 'still shows "con Estudiante"' : 'name present')

    await p.goto(`${E.BASE}/es/maestro/dashboard/ganancias`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2600)
    const earn = (await p.locator('body').innerText().catch(() => '')) || ''
    R.ok('BK5-01: teacher GANANCIAS shows the real student name (not "—")',
      earn.includes(realName.split(' ')[0]), earn.replace(/\s+/g, ' ').slice(0, 110))
    await p.screenshot({ path: 'docs/_qa-evidence/fix-ganancias-names.png' }).catch(() => {})
    await ctx.close()
  }

  // ── BK6-01: admin cancel-with-refund cancels AND refunds ─────────────────
  {
    const email = `qa-fxv-admin-${Date.now()}@example.com`
    const pass = 'QaFix2026!'
    adminUid = (await E.au('POST', '', { email, password: pass, email_confirm: true, user_metadata: { role: 'admin', full_name: 'QA Fix Admin' } }))?.id
    await E.sql(`update profiles set role='admin' where id='${adminUid}'`)
    const before = await E.credits(stu.sid)
    const { ctx, p } = await E.loginCtx(b, email, pass, { lang: 'es' })
    await p.goto(`${E.BASE}/es/admin/students/${stu.sid}`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2800)
    // Open the Clases tab, cancel the future booking, confirm.
    await p.getByRole('button', { name: /^clases$/i }).first().click().catch(() => {})
    await p.waitForTimeout(1200)
    await p.getByRole('button', { name: /cancelar/i }).first().click().catch(() => {})
    await p.waitForTimeout(900)
    await p.getByRole('button', { name: /s[ií],? cancelar|confirmar/i }).first().click().catch(() => {})
    await p.waitForTimeout(3500)
    const pageTxt = (await p.locator('body').innerText().catch(() => '')) || ''
    R.ok('BK6-01: no CHECK-constraint error surfaces in the admin UI',
      !/violates check constraint|cancellation_reason_check/i.test(pageTxt),
      (pageTxt.match(/violates[^\n]{0,70}/) || ['clean'])[0])
    await p.screenshot({ path: 'docs/_qa-evidence/fix-admin-cancel.png' }).catch(() => {})
    await ctx.close()

    const after = (await E.sql(
      `select (select status from bookings where id='${bkFuture}') as st,
              (select cancellation_reason from bookings where id='${bkFuture}') as reason,
              (select classes_remaining from students where id='${stu.sid}') as cred`))?.[0]
    R.ok('BK6-01: booking actually reached status=cancelled', after?.st === 'cancelled', `status=${after?.st}`)
    R.ok('BK6-01: cancellation_reason is a constraint-legal value', after?.reason === 'admin_refund', `reason=${after?.reason}`)
    R.ok('BK6-01: the student\'s class credit was RETURNED', Number(after?.cred) === before + 1, `${before} -> ${after?.cred}`)
  }

  // ── BK4-1: spending the LAST credit shows the success screen ─────────────
  {
    const bal = await E.credits(stu.sid)
    await E.sql(`update students set classes_remaining=1 where id='${stu.sid}'`)
    const { ctx, p } = await E.loginCtx(b, stu.email, stu.pass, { lang: 'es' })
    await p.goto(`${E.BASE}/es/dashboard/agendar`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2600)
    const free = p.locator('button', { hasText: /libre/i }).first()
    let sawSuccess = false, endedOnPlan = false
    if (await free.count()) {
      await free.click().catch(() => {})
      await p.waitForTimeout(800)
      await p.getByRole('button', { name: /confirmar|reservar/i }).first().click().catch(() => {})
      // Poll for the success screen rather than sampling once — the old bug was a race.
      for (let i = 0; i < 24; i++) {
        await p.waitForTimeout(250)
        const t = (await p.locator('body').innerText().catch(() => '')) || ''
        if (/¡?Reservada!?|Booked!/i.test(t)) { sawSuccess = true; break }
      }
      endedOnPlan = /\/dashboard\/plan/.test(p.url())
    }
    R.ok('BK4-1: booking the LAST credit shows the "¡Reservada!" screen', sawSuccess, `url=${p.url()}`)
    R.ok('BK4-1: student is NOT bounced to /dashboard/plan', !endedOnPlan, p.url())
    await p.screenshot({ path: 'docs/_qa-evidence/fix-lastcredit.png' }).catch(() => {})
    await ctx.close()
    await E.sql(`update students set classes_remaining=${bal} where id='${stu.sid}'`)
  }

  // ── BK4-2: reschedule uses the PROFILE zone, not the browser's ───────────
  {
    // Profile zone Asia/Tokyo, browser America/New_York. Typing a wall-clock must
    // be interpreted as Tokyo time; before the fix it was parsed as New York time.
    stu2 = await E.mkStudent({ tag: 'fxv2', credits: 2, tz: 'Asia/Tokyo' })
    await E.sql(`update students set intake_done=true, placement_test_done=true where id='${stu2.sid}'`)
    const bk = await E.mkBooking({ sid: stu2.sid, tid: tea.tid, hrs: 72, status: 'confirmed' })
    const ctx = await b.newContext({ viewport: { width: 1280, height: 950 }, locale: 'es-HN', timezoneId: 'America/New_York' })
    const p = await ctx.newPage()
    await p.goto(`${E.BASE}/es/login`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(800)
    await p.fill('input[type=email]', stu2.email); await p.fill('input[type=password]', stu2.pass)
    await p.click('button[type=submit]'); await p.waitForTimeout(4000)
    await p.goto(`${E.BASE}/es/dashboard/clases`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2600)

    let requested = false
    // The row's kebab is aria-label="Acciones"; the menu item reads "Reagendar".
    const menu = p.getByRole('button', { name: /^(acciones|actions)$/i }).first()
    if (await menu.count()) { await menu.click().catch(() => {}); await p.waitForTimeout(700) }
    const resched = p.getByRole('button', { name: /^reagendar$/i }).first()
    if (await resched.count()) {
      await resched.click().catch(() => {})
      await p.waitForTimeout(900)
      const input = p.locator('input[type="datetime-local"]').first()
      if (await input.count()) {
        // Pick a fixed far-future wall clock so the assertion is deterministic.
        await input.fill('2026-12-02T15:00').catch(() => {})
        await p.waitForTimeout(400)
        await p.getByRole('button', { name: /^(reagendar|reschedule)$/i }).last().click().catch(() => {})
        await p.waitForTimeout(3500)
        requested = true
      }
    }
    await p.screenshot({ path: 'docs/_qa-evidence/fix-reschedule-tz.png' }).catch(() => {})
    await ctx.close()

    if (requested) {
      // studentRescheduleBooking moves the BOOKING directly (and flips it to
      // pending); reschedule_requests is the teacher-initiated flow. Read the
      // booking, not the request table.
      const row = (await E.sql(
        `select to_char(scheduled_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as utc,
                to_char(scheduled_at at time zone 'Asia/Tokyo', 'HH24:MI') as tokyo
         from bookings where id='${bk}'`))?.[0]
      // 15:00 Tokyo (UTC+9) == 06:00Z. Parsed in the BROWSER zone (New York, UTC-5)
      // it would have landed at 20:00Z — the 2h+ drift the original defect caused.
      R.ok('BK4-2: typed 15:00 stored as 06:00Z (Tokyo profile zone), not 20:00Z (browser zone)',
        String(row?.utc || '').includes('06:00'), `stored=${row?.utc} (=${row?.tokyo} Tokyo)`)
      R.ok('BK4-2: the class reads back as 15:00 in the student own profile zone',
        String(row?.tokyo || '') === '15:00', `tokyo=${row?.tokyo}`)
    } else {
      R.ok('BK4-2: reschedule modal reachable to test', false, 'could not open the reschedule picker')
    }
  }
} catch (e) {
  R.ok('verification completed without throwing', false, String(e).slice(0, 220))
} finally {
  await b.close()
  await nuke()
  R.summary()
}
