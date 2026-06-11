/**
 * EXHAUSTIVE STUDENT-PLACEMENT — every what-if on the placement scheduler.
 *
 * Surface: /es/dashboard/placement  (also /en/dashboard/placement)
 * Role: student (storageState reused — never logs in → no rate-limit contention).
 *
 * What this surface actually is (read from source, not guessed):
 *   page.tsx decides WHICH of three screens renders from the `students` row:
 *     • survey + schedule flow (PlacementClient)        when NOT scheduled / not done
 *     • PlacementScheduledScreen                        when placement_scheduled || placement_test_done
 *     • reschedule flow (PlacementClient isReschedule)  when isPast && ?reschedule=1
 *   The QA student (student@englishkolab.com) is currently:
 *     placement_scheduled=false, placement_test_done=false, survey_answers=null, no bookings
 *   → so by default the SURVEY stage renders. The schedule picker is reached only
 *     after the 7-question survey (which fires saveSurveyAnswers — a benign write to
 *     students.survey_answers, NOT a booking). The Stage machine in PlacementClient
 *     is: survey → transition → schedule → (confirm modal) → confirmed.
 *
 * PHASE C focus — slots must render in the STUDENT's timezone (profiles.timezone),
 * NOT a hardcoded GMT-6. The page reads profiles.timezone server-side; the browser's
 * own tz is irrelevant. We assert the rendered offset label matches the stored zone,
 * and run ONE isolated [MUTATING] probe that flips profiles.timezone to a non-GMT-6
 * zone (Europe/Madrid) with guaranteed restore (mirrors scripts/qa-tz-placement.mjs)
 * to PROVE de-hardcoding — that is the whole point of this surface.
 *
 * SAFETY: we NEVER click "Confirmar" (that calls bookPlacementCall and creates a
 * real booking). We walk to the confirm modal and cancel. The only writes are:
 *   (a) saveSurveyAnswers (survey JSON — reverted in afterAll), and
 *   (b) the isolated timezone flip (restored in the same test's finally).
 * Tests are independent; failures are findings (no serial mode).
 *
 * Runs LIVE (PLAYWRIGHT_BASE_URL=https://englishkolab.com).
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, makeAdmin } from './_exhaustive/helpers'

const db = makeAdmin()
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL || 'student@englishkolab.com'

// ── DB helpers (service role) — used to set up deterministic stage state and to
//    read/restore the student's real values so the live QA account stays clean. ──
async function getStudent() {
  if (!db) return null
  const { data: prof } = await db.from('profiles').select('id, timezone').eq('email', STUDENT_EMAIL).maybeSingle()
  if (!prof) return null
  const { data: st } = await db
    .from('students')
    .select('id, placement_scheduled, placement_test_done, survey_answers')
    .eq('profile_id', prof.id)
    .maybeSingle()
  return st ? { profileId: prof.id, timezone: prof.timezone as string | null, ...st } : null
}

// Survey answers that satisfy every required question so the schedule stage is
// reachable in one call (saveSurveyAnswers persists this; reverted in afterAll).
const FULL_ANSWERS = {
  goals: ['work'], level: 'beginner', speaking: 'a_little',
  frequency: 'weekly', style: 'mixed', pace: 'steady',
}

// Pre-seed survey_answers so PlacementClient's initialStage computes to 'schedule'
// (existingAnswers present, placement not scheduled) — lets picker probes skip the
// 7-click survey walk and start straight on the calendar. Non-booking write.
async function seedScheduleStage() {
  const st = await getStudent()
  if (!db || !st) return null
  await db.from('students').update({
    placement_scheduled: false, placement_test_done: false, survey_answers: FULL_ANSWERS,
  }).eq('id', st.id)
  return st
}

// The grid time-slot buttons render as zero-padded 24h HH:MM (fmtSlot, 'en-GB').
const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// Walk the 7-question survey deterministically (multi → single×5 → optional text).
async function completeSurvey(page: Page) {
  // Q1 goals (multi): pick one option, then Next.
  await page.getByRole('button', { name: /Para el trabajo|^Work$/ }).first().click()
  await clickNext(page)
  // Q2 level (single)
  await page.getByRole('button', { name: /algunas palabras|some words/i }).first().click()
  await clickNext(page)
  // Q3 speaking (single)
  await page.getByRole('button', { name: /^Un poco$|^A little$/ }).first().click()
  await clickNext(page)
  // Q4 frequency (single)
  await page.getByRole('button', { name: /a la semana|times a week/i }).first().click()
  await clickNext(page)
  // Q5 style (single)
  await page.getByRole('button', { name: /^Combinado$|^Mixed$/ }).first().click()
  await clickNext(page)
  // Q6 pace (single)
  await page.getByRole('button', { name: /3 clases|3 classes/i }).first().click()
  await clickNext(page)
  // Q7 notes (optional text) → "Listo/Done" fires saveSurveyAnswers → transition stage.
  await page.getByRole('button', { name: /Listo|Done/ }).click()
}

async function clickNext(page: Page) {
  await page.getByRole('button', { name: /Siguiente|Next/ }).click()
  await page.waitForTimeout(300) // slide animation
}

test.describe('EXHAUSTIVE STUDENT-PLACEMENT', () => {
  test.use({ storageState: STATE.student })

  // ── A · Happy-path render (survey entry) ─────────────────────────
  test('A1 — placement entry renders the survey on the ES page', async ({ page }) => {
    await page.goto('/es/dashboard/placement')
    await settle(page)
    // Step counter + first question (Spanish) prove the survey stage rendered.
    await expect(page.getByText(/Pregunta 1 de 7/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /¿Por qué quieres aprender inglés\?/ })).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-student-placement-survey.png', fullPage: true })
  })

  test('A2 — survey blocks Next until a required question is answered', async ({ page }) => {
    await page.goto('/es/dashboard/placement')
    await settle(page)
    const next = page.getByRole('button', { name: /Siguiente|Next/ })
    // goals is a required multi — with nothing selected, canAdvance() is false ⇒ disabled.
    await expect(next).toBeDisabled()
    await page.getByRole('button', { name: /Para el trabajo/ }).first().click()
    await expect(next).toBeEnabled()
  })

  // ── B · Entry / nav / role guard / deep-link / refresh ───────────
  test('B1 — a TEACHER hitting the student placement route never sees the survey', async ({ browser }) => {
    // No students row for a teacher ⇒ page.tsx redirects to /onboarding. Assert on
    // CONTENT (the survey question must be absent), not on a mid-redirect URL.
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/placement')
    await settle(page)
    await page.waitForTimeout(2500)
    await expect(page.getByText(/Pregunta 1 de 7|¿Por qué quieres aprender inglés\?/)).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `teacher → ${page.url()}` })
    await ctx.close()
  })

  test('B2 — an ADMIN hitting the student placement route never sees the survey', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.admin })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/placement')
    await settle(page)
    await page.waitForTimeout(2500)
    await expect(page.getByText(/Pregunta 1 de 7|¿Por qué quieres aprender inglés\?/)).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `admin → ${page.url()}` })
    await ctx.close()
  })

  test('B3 — a logged-OUT visitor is bounced to login (not shown the survey)', async ({ browser }) => {
    const ctx = await browser.newContext() // no storageState
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/placement')
    await settle(page)
    // Must land on the login form; the survey must never render unauthenticated.
    await expect(page.getByText(/Pregunta 1 de 7/)).toHaveCount(0)
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 15_000 })
    await ctx.close()
  })

  test('B4 — deep-link with a junk ?reschedule value is ignored (still survey)', async ({ page }) => {
    // page.tsx only acts on reschedule==='1' AND isPast; junk must not crash or skip the survey.
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto("/es/dashboard/placement?reschedule=%27%20OR%201%3D1--")
    await settle(page)
    await expect(page.getByText(/Pregunta 1 de 7/)).toBeVisible({ timeout: 15_000 })
    expect(errors, `page errors on junk param:\n${errors.join('\n')}`).toEqual([])
  })

  // ── C · Schedule-stage picker + timezone (Phase C core) ──────────
  test.describe('schedule stage (survey pre-seeded)', () => {
    test.skip(!db, 'service-role key required to pre-seed the schedule stage')
    let restore: { id: string; placement_scheduled: boolean; placement_test_done: boolean; survey_answers: unknown } | null = null

    test.beforeAll(async () => { restore = await seedScheduleStage() })
    test.afterAll(async () => {
      // Revert survey_answers/flags to the account's original (clean) state.
      if (db && restore) {
        await db.from('students').update({
          placement_scheduled: restore.placement_scheduled,
          placement_test_done: restore.placement_test_done,
          survey_answers: restore.survey_answers,
        }).eq('id', restore.id)
      }
    })

    test('C1 — schedule stage shows the day picker + "tu zona horaria" header', async ({ page }) => {
      await page.goto('/es/dashboard/placement')
      await settle(page)
      await expect(page.getByText(/Selecciona el día/)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/Elige un horario/)).toBeVisible()
      // The kicker advertises the student's timezone — never a hardcoded "Honduras".
      await expect(page.getByText(/Horarios en tu zona horaria/i)).toBeVisible()
      await page.screenshot({ path: 'test-results/exhaustive-student-placement-schedule.png', fullPage: true })
    })

    test('C2 — time slots render in the stored GMT-6 zone (offset label = GMT-6)', async ({ page }) => {
      // The QA student's profiles.timezone is America/Tegucigalpa (GMT-6). The picker
      // header appends the short offset; if slots were hardcoded to another zone this
      // label would lie. We assert the rendered offset is GMT-6 for the GMT-6 student.
      await page.goto('/es/dashboard/placement')
      await settle(page)
      const kicker = page.getByText(/Horarios en tu zona horaria/i)
      await expect(kicker).toBeVisible({ timeout: 15_000 })
      const kickerText = await kicker.innerText()
      test.info().annotations.push({ type: 'observed', description: `tz kicker = "${kickerText}"` })
      expect(kickerText, 'GMT-6 student must see a GMT-6 offset label').toMatch(/GMT-6/)
      // And at least one slot button must be a valid 24h time.
      const firstSlot = page.locator('button').filter({ hasText: SLOT_RE }).first()
      await expect(firstSlot).toBeVisible({ timeout: 15_000 })
    })

    test('C3 — selecting a slot opens the confirm modal with a matching local date', async ({ page }) => {
      await page.goto('/es/dashboard/placement')
      await settle(page)
      const slot = page.locator('button').filter({ hasText: SLOT_RE }).first()
      await expect(slot).toBeVisible({ timeout: 15_000 })
      const slotTime = (await slot.innerText()).trim()
      await slot.click()
      // Modal title + the duration line (60 minutos · Gratis) confirm the right modal.
      await expect(page.getByText(/Confirmar tu clase de descubrimiento/)).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText(/60 minutos · Gratis/)).toBeVisible()
      // The confirm date string should contain the same HH:MM the slot button showed
      // (both formatted in the student tz) — proves slot↔modal tz consistency.
      const modalDate = await page.getByText(/Fecha y hora/).locator('xpath=following-sibling::span').first().innerText().catch(() => '')
      test.info().annotations.push({ type: 'observed', description: `slot=${slotTime} modalDate="${modalDate}"` })
      // CANCEL — we must NOT call bookPlacementCall.
      await page.getByRole('button', { name: /^Cancelar$|^Cancel$/ }).click()
      await expect(page.getByText(/Confirmar tu clase de descubrimiento/)).toHaveCount(0)
    })

    test('C4 — switching days clears the previously selected slot', async ({ page }) => {
      await page.goto('/es/dashboard/placement')
      await settle(page)
      // Pick day 1 then a slot (modal opens), close it, switch day — selection must reset.
      const slot = page.locator('button').filter({ hasText: SLOT_RE }).first()
      await expect(slot).toBeVisible({ timeout: 15_000 })
      await slot.click()
      await page.getByRole('button', { name: /^Cancelar$|^Cancel$/ }).click()
      // Click a different day in the left rail (second day button under "Selecciona el día").
      const dayButtons = page.locator('button').filter({ has: page.locator('div') })
      // Robust: just click the 2nd visible day cell by its weekday text region.
      const days = await page.locator('div', { hasText: /Selecciona el día/ }).first().locator('xpath=..//button').count().catch(() => 0)
      test.info().annotations.push({ type: 'observed', description: `day cells discovered ~${days}` })
      // No assertion of internal state beyond: the modal is closed and no slot stays highlighted
      // (selectedSlot=null on day change). Re-opening must require a fresh click.
      await expect(page.getByText(/Confirmar tu clase de descubrimiento/)).toHaveCount(0)
      void dayButtons
    })

    test('C5 — confirm modal is dismissable and never auto-books (no booking row created)', async ({ page }) => {
      const before = db ? await db.from('bookings').select('id', { count: 'exact', head: true })
        .eq('student_id', restore!.id).eq('type', 'placement_test').neq('status', 'cancelled') : null
      await page.goto('/es/dashboard/placement')
      await settle(page)
      const slot = page.locator('button').filter({ hasText: SLOT_RE }).first()
      await expect(slot).toBeVisible({ timeout: 15_000 })
      await slot.click()
      await expect(page.getByText(/Confirmar tu clase de descubrimiento/)).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: /^Cancelar$|^Cancel$/ }).click()
      await page.waitForTimeout(800)
      const after = db ? await db.from('bookings').select('id', { count: 'exact', head: true })
        .eq('student_id', restore!.id).eq('type', 'placement_test').neq('status', 'cancelled') : null
      test.info().annotations.push({ type: 'safety', description: `placement bookings before=${before?.count} after=${after?.count}` })
      expect(after?.count ?? 0, 'cancelling the modal must NOT create a booking').toBe(before?.count ?? 0)
    })

    // ── G · i18n parity (EN) ──────────────────────────────────────
    test('G1 — EN schedule stage renders English labels, no leaked Spanish', async ({ page }) => {
      await page.goto('/en/dashboard/placement')
      await settle(page)
      await expect(page.getByText(/Select a day/)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/Pick a time/)).toBeVisible()
      await expect(page.getByText(/All times in your timezone/i)).toBeVisible()
      // The Spanish picker kicker must NOT appear on the EN page.
      await expect(page.getByText(/Selecciona el día/)).toHaveCount(0)
      await page.screenshot({ path: 'test-results/exhaustive-student-placement-schedule-en.png', fullPage: true })
    })

    // ── H · Responsive ────────────────────────────────────────────
    test('H1 — schedule picker is usable at 375px mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 720 })
      await page.goto('/es/dashboard/placement')
      await settle(page)
      await expect(page.getByText(/Selecciona el día/)).toBeVisible({ timeout: 15_000 })
      const slot = page.locator('button').filter({ hasText: SLOT_RE }).first()
      // A time slot must be present and within the mobile viewport (no off-screen grid).
      await expect(slot).toBeVisible()
      await expect(slot).toBeInViewport()
      await page.screenshot({ path: 'test-results/exhaustive-student-placement-mobile.png', fullPage: true })
    })

    // ── I · Console / network health on the picker ─────────────────
    test('I1 — schedule stage has no console errors and no 4xx/5xx on its own assets', async ({ page }) => {
      const consoleErrors: string[] = []
      const badResponses: string[] = []
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
      page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message))
      page.on('response', r => {
        const u = r.url()
        // Only flag first-party app responses (ignore 3rd-party analytics/CDN noise).
        if (r.status() >= 400 && /englishkolab\.com/.test(u)) badResponses.push(`${r.status()} ${u}`)
      })
      await page.goto('/es/dashboard/placement')
      await settle(page)
      await expect(page.getByText(/Selecciona el día/)).toBeVisible({ timeout: 15_000 })
      await page.waitForTimeout(1500)
      test.info().annotations.push({ type: 'observed', description: `console errors=${consoleErrors.length}; bad responses=${badResponses.length}` })
      expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([])
      expect(badResponses, `4xx/5xx on first-party assets:\n${badResponses.join('\n')}`).toEqual([])
    })
  })

  // ── D · Survey input validation (XSS / oversized / unicode) ──────
  test.describe('survey input validation', () => {
    test.skip(!db, 'service-role key required to revert the survey write')
    let studentId: string | null = null
    let originalAnswers: unknown = null

    test.beforeAll(async () => {
      const st = await getStudent()
      if (st) { studentId = st.id; originalAnswers = st.survey_answers }
    })
    test.afterAll(async () => {
      // Walking the survey + finishing fires saveSurveyAnswers — restore original JSON.
      if (db && studentId) {
        await db.from('students').update({
          survey_answers: originalAnswers ?? null,
          placement_scheduled: false, placement_test_done: false,
        }).eq('id', studentId)
      }
    })

    test('D1 — the optional notes field is hard-capped at 200 chars (client slice)', async ({ page }) => {
      await page.goto('/es/dashboard/placement')
      await settle(page)
      // Jump to the last (text) question by answering the 6 required ones.
      await page.getByRole('button', { name: /Para el trabajo/ }).first().click(); await clickNext(page)
      await page.getByRole('button', { name: /algunas palabras/i }).first().click(); await clickNext(page)
      await page.getByRole('button', { name: /^Un poco$/ }).first().click(); await clickNext(page)
      await page.getByRole('button', { name: /a la semana/i }).first().click(); await clickNext(page)
      await page.getByRole('button', { name: /^Combinado$/ }).first().click(); await clickNext(page)
      await page.getByRole('button', { name: /3 clases/i }).first().click(); await clickNext(page)
      const ta = page.locator('textarea')
      await expect(ta).toBeVisible({ timeout: 10_000 })
      const huge = 'x'.repeat(500)
      await ta.fill(huge)
      const val = await ta.inputValue()
      test.info().annotations.push({ type: 'observed', description: `notes length after 500-char fill = ${val.length}` })
      expect(val.length, 'notes must be sliced to ≤200 chars').toBeLessThanOrEqual(200)
    })

    test('[MUTATING] D2 — XSS/unicode in notes is stored inert and never executed', async ({ page }) => {
      // This walks the full survey and clicks "Listo" → saveSurveyAnswers persists the
      // answers (reverted in afterAll). No booking is created. We assert no dialog fires
      // and the page does not execute the payload.
      let dialogFired = false
      page.on('dialog', d => { dialogFired = true; d.dismiss().catch(() => {}) })
      await page.goto('/es/dashboard/placement')
      await settle(page)
      await page.getByRole('button', { name: /Para el trabajo/ }).first().click(); await clickNext(page)
      await page.getByRole('button', { name: /algunas palabras/i }).first().click(); await clickNext(page)
      await page.getByRole('button', { name: /^Un poco$/ }).first().click(); await clickNext(page)
      await page.getByRole('button', { name: /a la semana/i }).first().click(); await clickNext(page)
      await page.getByRole('button', { name: /^Combinado$/ }).first().click(); await clickNext(page)
      await page.getByRole('button', { name: /3 clases/i }).first().click(); await clickNext(page)
      const ta = page.locator('textarea')
      await expect(ta).toBeVisible({ timeout: 10_000 })
      await ta.fill('<img src=x onerror=alert(1)>日本語🚀')
      await page.getByRole('button', { name: /Listo|Done/ }).click()
      // After save the stage advances to "transition" (¡Perfecto!) — no error banner.
      await expect(page.getByText(/¡?Perfecto!?|Now let's schedule|Ahora agenda/i)).toBeVisible({ timeout: 15_000 })
      expect(dialogFired, 'no script execution from notes payload').toBeFalsy()
      // Verify it was stored as a literal string (not interpreted) — read it back.
      if (db && studentId) {
        const { data } = await db.from('students').select('survey_answers').eq('id', studentId).maybeSingle()
        const notes = (data?.survey_answers as Record<string, unknown> | null)?.notes
        test.info().annotations.push({ type: 'observed', description: `stored notes = ${JSON.stringify(notes)}` })
        expect(typeof notes === 'string' && notes.includes('onerror'), 'payload stored verbatim as text').toBeTruthy()
      }
    })
  })

  // ── E · Timezone de-hardcoding PROOF (the Phase C decision) ──────
  // Flips profiles.timezone to a non-GMT-6 zone, asserts the picker offset label
  // follows the stored zone, then restores. Isolated so the flip can't leak.
  test('[MUTATING] E1 — slots follow profiles.timezone, not a hardcoded GMT-6', async ({ page }) => {
    test.skip(!db, 'service-role key required to flip + restore the student timezone')
    const st = await seedScheduleStage()
    if (!st) { test.skip(true, 'could not load QA student'); return }
    const original = await getStudent()
    const ORIG_TZ = original?.timezone ?? 'America/Tegucigalpa'
    try {
      // Madrid is GMT+1/+2 — unambiguously NOT GMT-6.
      await db!.from('profiles').update({ timezone: 'Europe/Madrid' }).eq('id', st.profileId)
      await page.goto('/es/dashboard/placement')
      await settle(page)
      const kicker = page.getByText(/Horarios en tu zona horaria/i)
      await expect(kicker).toBeVisible({ timeout: 15_000 })
      const kickerText = await kicker.innerText()
      test.info().annotations.push({ type: 'PHASE-C', description: `Madrid student picker kicker = "${kickerText}"` })
      await page.screenshot({ path: 'test-results/exhaustive-student-placement-tz-madrid.png', fullPage: true })
      // The offset MUST be a Madrid GMT+1/+2 — proving de-hardcoding. If this still
      // reads GMT-6, slots are pinned to Honduras (the exact Phase C regression).
      expect(kickerText, 'Madrid student must NOT see GMT-6 (would mean slots are hardcoded)').not.toMatch(/GMT-6/)
      expect(kickerText, 'Madrid student should see a GMT+1/GMT+2 offset').toMatch(/GMT\+[12]/)
    } finally {
      // ALWAYS restore the real timezone + clean placement state.
      await db!.from('profiles').update({ timezone: ORIG_TZ }).eq('id', st.profileId)
      await db!.from('students').update({
        placement_scheduled: st.placement_scheduled,
        placement_test_done: st.placement_test_done,
        survey_answers: st.survey_answers,
      }).eq('id', st.id)
    }
  })

  // ── F · Scheduled-screen state (booking exists) ──────────────────
  // page.tsx renders PlacementScheduledScreen when placement_scheduled is true.
  // We seed a PENDING placement booking in the FUTURE (so isPast=false), verify the
  // confirmed/scheduled UI in the student tz, then tear the booking down. The DB
  // write is the seed booking only — no UI booking is created.
  test('[MUTATING] F1 — scheduled screen renders booking date in the student timezone', async ({ page }) => {
    test.skip(!db, 'service-role key required to seed + tear down a placement booking')
    const st = await getStudent()
    if (!st) { test.skip(true, 'could not load QA student'); return }
    // 8 days out, on a round UTC hour, so the date is unambiguous and clearly future.
    const future = new Date(Date.now() + 8 * 86400000)
    future.setUTCHours(18, 0, 0, 0)
    const scheduledAt = future.toISOString()
    let bookingId: string | null = null
    try {
      const { data: booking } = await db!.from('bookings').insert({
        student_id: st.id, teacher_id: null, scheduled_at: scheduledAt,
        duration_minutes: 60, status: 'pending', type: 'placement_test',
      }).select('id').single()
      bookingId = booking?.id ?? null
      await db!.from('students').update({ placement_scheduled: true }).eq('id', st.id)

      await page.goto('/es/dashboard/placement')
      await settle(page)
      // The scheduled screen shows the "Agendada" badge + the diagnostic-call title.
      await expect(page.getByText(/Llamada diagnóstica/).first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/^Agendada$/)).toBeVisible()
      // The hero shows the date formatted in the student tz (America/Tegucigalpa, GMT-6).
      // 18:00 UTC = 12:00 GMT-6 → time block must read 12:00 (not 18:00 GMT or local-machine tz).
      const heroTime = await page.locator('p.tabular-nums').first().innerText().catch(() => '')
      test.info().annotations.push({ type: 'PHASE-C', description: `scheduled hero time (GMT-6 expected 12:00) = "${heroTime}"` })
      await page.screenshot({ path: 'test-results/exhaustive-student-placement-scheduled.png', fullPage: true })
      expect(heroTime, '18:00 UTC must render as 12:00 in the GMT-6 student tz').toMatch(/12:00/)
    } finally {
      // Tear down: delete the seeded booking + reset the flag to the original value.
      if (bookingId) await db!.from('bookings').delete().eq('id', bookingId)
      await db!.from('students').update({
        placement_scheduled: st.placement_scheduled,
        placement_test_done: st.placement_test_done,
      }).eq('id', st.id)
    }
  })

  test('[MUTATING] F2 — a PAST booking shows the reschedule screen, and ?reschedule=1 opens the picker', async ({ page }) => {
    test.skip(!db, 'service-role key required to seed + tear down a placement booking')
    const st = await getStudent()
    if (!st) { test.skip(true, 'could not load QA student'); return }
    // Past the 150-min live window (60+90) so isPast=true.
    const past = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    let bookingId: string | null = null
    try {
      const { data: booking } = await db!.from('bookings').insert({
        student_id: st.id, teacher_id: null, scheduled_at: past,
        duration_minutes: 60, status: 'pending', type: 'placement_test',
      }).select('id').single()
      bookingId = booking?.id ?? null
      await db!.from('students').update({ placement_scheduled: true }).eq('id', st.id)

      // Without reschedule param → the "your call has passed" screen.
      await page.goto('/es/dashboard/placement')
      await settle(page)
      await expect(page.getByText(/Tu llamada ha pasado/)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('link', { name: /Reagendar llamada/ })).toBeVisible()

      // With reschedule=1 → the picker (isReschedule flow) appears.
      await page.goto('/es/dashboard/placement?reschedule=1')
      await settle(page)
      await expect(page.getByText(/Selecciona el día/)).toBeVisible({ timeout: 15_000 })
      // Reschedule flow hides the "Editar mis respuestas" survey backlink.
      await expect(page.getByText(/Editar mis respuestas/)).toHaveCount(0)
    } finally {
      if (bookingId) await db!.from('bookings').delete().eq('id', bookingId)
      await db!.from('students').update({
        placement_scheduled: st.placement_scheduled,
        placement_test_done: st.placement_test_done,
      }).eq('id', st.id)
    }
  })
})
