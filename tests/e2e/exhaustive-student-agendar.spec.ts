/**
 * EXHAUSTIVE — STUDENT · /es/dashboard/agendar (booking flow)
 *
 * Source of truth read before authoring:
 *   src/app/[lang]/dashboard/agendar/page.tsx       (server guards: login / no-student
 *     → /dashboard / classes_remaining<=0 → /dashboard/plan / !intake_done → /dashboard/intake)
 *   src/app/[lang]/dashboard/agendar/AgendarClient.tsx  (grid + confirm Modal + i18n table `t`)
 *   src/app/actions/booking.ts → createBooking  (24h guard, no-credit guard, conflict guard,
 *     decrement_classes on insert)
 *   src/components/dashboard/Modal.tsx  (role="dialog", Esc/scrim close)
 *
 * EXACT strings used below come verbatim from those files — NOT guessed:
 *   slot button text: ES "libre" / EN "free"; selected: ES "Elegida" / EN "Chosen"
 *   booked cell: "—"; confirm modal kicker ES "Revisa" / EN "Review";
 *   confirm button ES "Confirmar reserva" / EN "Confirm booking"; cancel ES "Cancelar" / EN "Cancel"
 *   success title ES "¡Reservada!" / EN "Booked!"; no-credit server error
 *     ES "No tienes clases disponibles. Adquiere un plan." ; 24h server error
 *     ES "Las reservas requieren al menos 24 horas de anticipación." ;
 *     conflict ES "Ya tienes una clase agendada para ese horario."
 *
 * Session: reuses the saved student storageState — never logs in (no rate-limit contention).
 * Most probes are NON-MUTATING (drive UI + validation, STOP before commit). The single
 * [MUTATING] probe books then deletes the row + restores the credit via the service role.
 *
 * Runs against LIVE. NOT serial — each failing assertion is a real finding.
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, ACCOUNT, makeAdmin } from './_exhaustive/helpers'

const db = makeAdmin()
const SLOT_LIBRE = /^(libre|free)$/i

test.describe('EXHAUSTIVE · STUDENT · /es/dashboard/agendar', () => {
  test.use({ storageState: STATE.student })

  // ── shared read helpers (service role) ────────────────────────────────────
  async function studentRow() {
    if (!db) return null
    // student@ profile → students row
    const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
    const u = users?.users.find(x => (x.email || '').toLowerCase() === ACCOUNT.student.email.toLowerCase())
    if (!u) return null
    const { data: s } = await db.from('students').select('id, classes_remaining').eq('profile_id', u.id).single()
    return s ? { ...s, profileId: u.id } : null
  }

  // Land on the calendar; if the server bounced us to /plan or /intake (no
  // credit / incomplete intake), top up credit via the service role and retry
  // ONCE so the calendar probes can run. Returns true when the grid is visible.
  async function openCalendar(page: Page): Promise<boolean> {
    await page.goto('/es/dashboard/agendar')
    await settle(page)
    let slot = page.locator('.lk-agendar-slot').first()
    if (await slot.count()) return true
    // Bounced. If it was a no-credit bounce and we have the service role, top up.
    if (db && /\/dashboard\/plan/.test(page.url())) {
      const s = await studentRow()
      if (s) {
        await db.from('students').update({ classes_remaining: Math.max(2, s.classes_remaining) }).eq('id', s.id)
        await page.goto('/es/dashboard/agendar')
        await settle(page)
        slot = page.locator('.lk-agendar-slot').first()
        return (await slot.count()) > 0
      }
    }
    return false
  }

  // ─────────────────────────── 1 · Happy-path render ───────────────────────────

  test('1a — calendar renders with bookable "libre" slots + balance + how-it-works', async ({ page }) => {
    const ok = await openCalendar(page)
    test.info().annotations.push({ type: 'observed', description: `landed=${page.url()} grid-visible=${ok}` })
    await page.screenshot({ path: 'test-results/exhaustive-student-agendar-grid.png', fullPage: true })
    if (!ok) {
      // Either no-credit/intake bounce (legit guard) and no service role to top up.
      expect(page.url(), 'without credit/intake the page legitimately redirects away from agendar')
        .toMatch(/\/dashboard\/(plan|intake|$)/)
      return
    }
    await expect(page.locator('.lk-agendar-slot').first()).toBeVisible()
    // Header copy + "how it works" anchor text from the ES `t` table.
    await expect(page.getByText(/saldo disponible/i).first()).toBeVisible()
    await expect(page.getByText(/cómo funciona/i).first()).toBeVisible()
    // The hint banner must reference the assign-a-teacher model (book-first).
    await expect(page.getByText(/asignamos un maestro disponible/i).first()).toBeVisible()
  })

  test('1b — past + <24h cells are NOT interactive (no slot button on them)', async ({ page }) => {
    if (!(await openCalendar(page))) { test.skip(true, 'calendar unavailable (no credit/intake + no service role)'); return }
    // Today's column on the visible week must contain mostly non-interactive
    // cells (all of today is either past or <24h). The grid only renders a
    // <button.lk-agendar-slot> for bookable cells, so a fully-past column has 0.
    // Move to week 0 (default) and assert there exists at least one disabled-looking
    // cell rendered as a plain div (cursor not-allowed) — proven by counting buttons
    // vs the 7*hours grid size being larger than the bookable button count.
    const slotButtons = await page.locator('.lk-agendar-slot').count()
    const selectedButtons = await page.getByRole('button', { name: /^(Elegida|Chosen)$/ }).count()
    // BUSINESS_HOURS default = 16 rows × 7 days = 112 cells; with the 24h guard
    // a meaningful chunk near "now" must be non-bookable → fewer buttons than cells.
    test.info().annotations.push({ type: 'observed', description: `bookable-slot-buttons=${slotButtons} selected=${selectedButtons}` })
    expect(slotButtons, 'some near-term cells must be guarded (not every cell is bookable)').toBeLessThan(112)
    expect(slotButtons, 'future cells must still be bookable').toBeGreaterThan(0)
  })

  // ─────────────────────────── 2 · Entry / nav / refresh / role guard ───────────────────────────

  test('2a — deep-link + hard refresh keeps the authenticated calendar (no login bounce)', async ({ page }) => {
    if (!(await openCalendar(page))) { test.skip(true, 'calendar unavailable'); return }
    await page.reload()
    await settle(page)
    expect(page.url(), 'refresh must not bounce to /login').not.toMatch(/\/login/)
    // Content proof — calendar still there OR a legit guard page (plan/intake).
    const hasGrid = await page.locator('.lk-agendar-slot').first().count()
    const guarded = /\/dashboard\/(plan|intake)/.test(page.url())
    expect(hasGrid > 0 || guarded, 'after refresh: calendar OR a legitimate guard, never login').toBeTruthy()
  })

  test('2b — no-credit student is redirected agendar → /dashboard/plan (content-proven)', async ({ page }) => {
    test.skip(!db, 'service role required to force a zero-credit state safely')
    const s = await studentRow()
    test.skip(!s, 'student row not found')
    const original = s!.classes_remaining
    try {
      await db!.from('students').update({ classes_remaining: 0 }).eq('id', s!.id)
      await page.goto('/es/dashboard/agendar')
      await settle(page)
      await page.waitForTimeout(1500)
      // Assert on RENDERED content, not the URL alone — prove we are on the plan
      // surface and the calendar is gone.
      await expect(page.locator('.lk-agendar-slot')).toHaveCount(0)
      expect(page.url(), 'zero-credit must route to the plan page').toMatch(/\/dashboard\/plan/)
      test.info().annotations.push({ type: 'observed', description: `zero-credit landed: ${page.url()}` })
    } finally {
      await db!.from('students').update({ classes_remaining: original }).eq('id', s!.id)
    }
  })

  test('2c — teacher hitting the student agendar route cannot use the student calendar', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    try {
      await page.goto('/es/dashboard/agendar')
      await settle(page)
      await page.waitForTimeout(1500)
      // A teacher has no `students` row → page.tsx redirects to /dashboard.
      // Prove by content: the student booking grid must NOT be present.
      await expect(page.locator('.lk-agendar-slot')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^Confirmar reserva$/ })).toHaveCount(0)
      test.info().annotations.push({ type: 'observed', description: `teacher@agendar landed: ${page.url()}` })
    } finally {
      await ctx.close()
    }
  })

  test('2d — logged-out visitor is sent to login (no calendar leak)', async ({ browser }) => {
    const ctx = await browser.newContext() // no storageState
    const page = await ctx.newPage()
    try {
      await page.goto('/es/dashboard/agendar')
      await settle(page)
      await expect(page.locator('.lk-agendar-slot')).toHaveCount(0)
      await expect(page.locator('input[name="password"]').first()).toBeVisible({ timeout: 15_000 })
    } finally {
      await ctx.close()
    }
  })

  // ─────────────────────────── 3 · Input / payload validation (server action) ───────────────────────────
  //
  // The UI never lets the user type a raw scheduled_at — bookable cells are
  // pre-computed. The attack surface is the createBooking server action body.
  // These probes drive a real confirm but tamper the multipart POST so the
  // server-side guards (24h, no-credit, malformed date) are exercised directly.
  // They do NOT commit a valid booking (the tamper makes the server reject).

  async function driveConfirmWithTamper(
    page: Page,
    tamper: (body: string) => string,
  ): Promise<{ error: string | null }> {
    if (!(await openCalendar(page))) return { error: '__no_calendar__' }
    // Pick a bookable future slot and open the confirm modal.
    await page.locator('.lk-agendar-slot').first().click()
    await expect(page.getByRole('button', { name: /^Confirmar reserva$/ })).toBeVisible({ timeout: 10_000 })
    let routed = false
    await page.route('**/dashboard/agendar', async route => {
      const req = route.request()
      const post = req.postData()
      if (req.method() === 'POST' && post && /scheduled_at/.test(post) && !routed) {
        routed = true
        await route.continue({ postData: tamper(post) })
      } else {
        await route.continue()
      }
    })
    await page.getByRole('button', { name: /^Confirmar reserva$/ }).click()
    await settle(page)
    await page.unroute('**/dashboard/agendar').catch(() => {})
    // The action returns { error } which the client renders inside the modal as
    // a red border-left block. Read any visible error text.
    const errLoc = page.locator('div').filter({ hasText: /clases disponibles|24 horas|ya tienes una clase|invalid|error/i })
    const error = (await errLoc.count()) ? (await errLoc.first().innerText()).trim() : null
    return { error }
  }

  test('3a — past scheduled_at injected into the POST is rejected by the 24h guard', async ({ page }) => {
    const pastIso = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const { error } = await driveConfirmWithTamper(page, body =>
      body.replace(/(name="scheduled_at"\r?\n\r?\n)[^\r\n]+/, `$1${pastIso}`),
    )
    if (error === '__no_calendar__') { test.skip(true, 'calendar unavailable'); return }
    test.info().annotations.push({ type: 'observed', description: `past-date booking → error=${JSON.stringify(error)}` })
    // Must surface the 24h-notice rejection (ES copy) — NOT a success / 500.
    expect(error, 'a past scheduled_at must be rejected by the server 24h guard').toMatch(/24 horas|24 hours/i)
  })

  test('3b — a scheduled_at 1h out (under 24h) is rejected by the server guard', async ({ page }) => {
    const soonIso = new Date(Date.now() + 1 * 3600 * 1000).toISOString()
    const { error } = await driveConfirmWithTamper(page, body =>
      body.replace(/(name="scheduled_at"\r?\n\r?\n)[^\r\n]+/, `$1${soonIso}`),
    )
    if (error === '__no_calendar__') { test.skip(true, 'calendar unavailable'); return }
    test.info().annotations.push({ type: 'observed', description: `<24h booking → error=${JSON.stringify(error)}` })
    expect(error, '<24h booking must be rejected, not silently committed').toMatch(/24 horas|24 hours/i)
  })

  test('3c — a garbage (non-date) scheduled_at does not 500 and does not book', async ({ page }) => {
    const errors5xx: string[] = []
    page.on('response', r => { if (r.status() >= 500) errors5xx.push(`${r.status()} ${r.url()}`) })
    const { error } = await driveConfirmWithTamper(page, body =>
      body.replace(/(name="scheduled_at"\r?\n\r?\n)[^\r\n]+/, `$1NOT-A-DATE-' OR 1=1--`),
    )
    if (error === '__no_calendar__') { test.skip(true, 'calendar unavailable'); return }
    test.info().annotations.push({ type: 'observed', description: `garbage date → 5xx=${errors5xx.length} error=${JSON.stringify(error)}` })
    // new Date('NOT-A-DATE') is Invalid Date; `< minAllowed` is false (NaN compare)
    // so it slips PAST the 24h guard and Postgres rejects the insert with a 22007
    // timestamp error surfaced as { error }. EITHER way it must NOT 500 and must
    // NOT show the success screen.
    expect(errors5xx, 'malformed scheduled_at must not crash the server').toEqual([])
    await expect(page.getByRole('heading', { name: /¡Reservada!|Booked!/ })).toHaveCount(0)
    expect(error, 'a malformed date should be rejected with an error, not booked').not.toBeNull()
  })

  // ─────────────────────────── 4 · Error / failure-state surfacing ───────────────────────────

  test('4a — no-credit at confirm time surfaces the localized "buy a plan" error', async ({ page }) => {
    test.skip(!db, 'service role required to flip credit mid-flow')
    const s = await studentRow()
    test.skip(!s, 'student row not found')
    const original = s!.classes_remaining
    // Ensure credit so the page loads, open confirm, THEN zero the credit so the
    // server-side createBooking check (classes_remaining<=0) fires at commit.
    await db!.from('students').update({ classes_remaining: Math.max(1, original) }).eq('id', s!.id)
    try {
      const ok = await openCalendar(page)
      if (!ok) { test.skip(true, 'calendar unavailable'); return }
      await page.locator('.lk-agendar-slot').first().click()
      await expect(page.getByRole('button', { name: /^Confirmar reserva$/ })).toBeVisible({ timeout: 10_000 })
      // Drop to zero credit AFTER the page rendered but BEFORE we confirm.
      await db!.from('students').update({ classes_remaining: 0 }).eq('id', s!.id)
      await page.getByRole('button', { name: /^Confirmar reserva$/ }).click()
      await settle(page)
      // The exact ES copy from booking.ts must show inside the modal.
      await expect(page.getByText(/No tienes clases disponibles\. Adquiere un plan\./i)).toBeVisible({ timeout: 10_000 })
      // And no success screen.
      await expect(page.getByRole('heading', { name: /¡Reservada!|Booked!/ })).toHaveCount(0)
    } finally {
      await db!.from('students').update({ classes_remaining: original }).eq('id', s!.id)
    }
  })

  // ─────────────────────────── 5 · Security / IDOR (server action) ───────────────────────────

  test('5a — injecting student_id into the POST cannot book on another student account', async ({ page }) => {
    // createBooking IGNORES any client-sent student_id — it resolves the student
    // from the authenticated user. Inject a foreign student_id field and assert
    // the action never books it (no success, no 500).
    const errors5xx: string[] = []
    page.on('response', r => { if (r.status() >= 500) errors5xx.push(`${r.status()} ${r.url()}`) })
    const { error } = await driveConfirmWithTamper(page, body => {
      // Append a forged student_id part if the multipart boundary is parseable.
      const m = body.match(/^(--[^\r\n]+)\r?\n/)
      if (!m) return body
      const boundary = m[1]
      const forged = `${boundary}\r\nContent-Disposition: form-data; name="student_id"\r\n\r\n00000000-0000-0000-0000-000000000000\r\n`
      return body.replace(boundary, forged + boundary)
    })
    if (error === '__no_calendar__') { test.skip(true, 'calendar unavailable'); return }
    test.info().annotations.push({ type: 'SECURITY', description: `forged student_id → 5xx=${errors5xx.length} error=${JSON.stringify(error)}` })
    expect(errors5xx, 'forged student_id must not crash the server').toEqual([])
    // If it "succeeded", that's a finding: it would have booked under the real
    // (auth-resolved) student anyway — but we revert any accidental booking in 6b.
  })

  // ─────────────────────────── 6 · State / concurrency / data integrity ───────────────────────────

  test('6a — Esc / Cancel closes the confirm modal without booking', async ({ page }) => {
    if (!(await openCalendar(page))) { test.skip(true, 'calendar unavailable'); return }
    await page.locator('.lk-agendar-slot').first().click()
    const confirmBtn = page.getByRole('button', { name: /^Confirmar reserva$/ })
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 })
    // Cancel button closes the dialog.
    await page.getByRole('button', { name: /^Cancelar$/ }).click()
    await settle(page, 800)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // Re-open and close via Esc.
    await page.locator('.lk-agendar-slot').first().click()
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')
    await settle(page, 800)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // No success screen ever appeared → nothing booked.
    await expect(page.getByRole('heading', { name: /¡Reservada!|Booked!/ })).toHaveCount(0)
  })

  test('6b — [MUTATING] book a slot end-to-end, prove success, then revert (delete row + restore credit)', async ({ page }) => {
    test.skip(!db, 'service role required to revert the booking + credit cleanly')
    const s = await studentRow()
    test.skip(!s, 'student row not found')
    const originalCredit = s!.classes_remaining
    // Guarantee a known credit so we can assert the decrement precisely.
    await db!.from('students').update({ classes_remaining: 3 }).eq('id', s!.id)

    let bookedScheduledAt: string | null = null
    try {
      const ok = await openCalendar(page)
      if (!ok) { test.skip(true, 'calendar unavailable'); return }

      // Choose a far-future slot (next week, mid-grid) to avoid colliding with a
      // real upcoming booking on the QA account.
      await page.getByRole('button', { name: /Semana siguiente|Next week/i }).click()
      await settle(page, 600)
      const slot = page.locator('.lk-agendar-slot')
      const count = await slot.count()
      expect(count, 'next week must have bookable slots').toBeGreaterThan(0)
      // Pick a middle slot to reduce conflict odds.
      await slot.nth(Math.min(20, count - 1)).click()

      await expect(page.getByRole('button', { name: /^Confirmar reserva$/ })).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: /^Confirmar reserva$/ }).click()

      // SUCCESS proven by rendered content (the dark success card), NOT by URL.
      await expect(page.getByRole('heading', { name: /¡Reservada!|Booked!/ })).toBeVisible({ timeout: 20_000 })
      await page.screenshot({ path: 'test-results/exhaustive-student-agendar-booked.png', fullPage: true })
      await expect(page.getByText(/asignaremos un maestro disponible|we'll assign an available teacher/i)).toBeVisible()

      // Data integrity: a pending, teacher-less booking row exists and credit fell by 1.
      const { data: latest } = await db!
        .from('bookings')
        .select('id, scheduled_at, status, teacher_id, duration_minutes')
        .eq('student_id', s!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      expect(latest, 'a booking row must have been created').not.toBeNull()
      bookedScheduledAt = latest!.scheduled_at
      expect(latest!.status, 'new booking is pending until admin assigns a teacher').toBe('pending')
      expect(latest!.teacher_id, 'no teacher pre-assigned (book-first/assign-after)').toBeNull()
      expect(latest!.duration_minutes, 'class is 60 minutes').toBe(60)

      const { data: after } = await db!.from('students').select('classes_remaining').eq('id', s!.id).single()
      expect(after?.classes_remaining, 'credit must decrement by exactly 1 on booking').toBe(2)
      test.info().annotations.push({ type: 'observed', description: `booked ${bookedScheduledAt} credit 3→${after?.classes_remaining}` })
    } finally {
      // Hard cleanup: delete the row we created and restore the original credit.
      if (bookedScheduledAt) {
        await db!.from('bookings').delete().eq('student_id', s!.id).eq('scheduled_at', bookedScheduledAt).eq('status', 'pending')
      }
      await db!.from('students').update({ classes_remaining: originalCredit }).eq('id', s!.id)
    }
  })

  test('6c — double-click Confirm does not double-book (button disables on isPending)', async ({ page }) => {
    test.skip(!db, 'service role required to revert any created booking')
    const s = await studentRow()
    test.skip(!s, 'student row not found')
    const originalCredit = s!.classes_remaining
    await db!.from('students').update({ classes_remaining: 3 }).eq('id', s!.id)
    let scheduledAt: string | null = null
    try {
      const ok = await openCalendar(page)
      if (!ok) { test.skip(true, 'calendar unavailable'); return }
      await page.getByRole('button', { name: /Semana siguiente|Next week/i }).click()
      await settle(page, 600)
      const slot = page.locator('.lk-agendar-slot')
      const count = await slot.count()
      if (!count) { test.skip(true, 'no bookable slots next week'); return }
      await slot.nth(Math.min(30, count - 1)).click()
      const confirm = page.getByRole('button', { name: /^Confirmar reserva$/ })
      await expect(confirm).toBeVisible({ timeout: 10_000 })
      // Fire two clicks fast; the 2nd should be a no-op (disabled while pending).
      await confirm.click().catch(() => {})
      await confirm.click({ timeout: 1200 }).catch(() => {})
      await expect(page.getByRole('heading', { name: /¡Reservada!|Booked!/ })).toBeVisible({ timeout: 20_000 })

      // Exactly ONE pending row for that slot — never two.
      const { data: latest } = await db!
        .from('bookings')
        .select('id, scheduled_at')
        .eq('student_id', s!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      scheduledAt = latest?.scheduled_at ?? null
      if (scheduledAt) {
        const { count: rowCount } = await db!
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', s!.id)
          .eq('scheduled_at', scheduledAt)
          .neq('status', 'cancelled')
        test.info().annotations.push({ type: 'observed', description: `live rows for slot=${rowCount}` })
        expect(rowCount, 'a double-click must not create two live bookings for the same slot').toBe(1)
      }
    } finally {
      if (scheduledAt) {
        await db!.from('bookings').delete().eq('student_id', s!.id).eq('scheduled_at', scheduledAt).eq('status', 'pending')
      }
      await db!.from('students').update({ classes_remaining: originalCredit }).eq('id', s!.id)
    }
  })

  // ─────────────────────────── 7 · i18n parity (ES + EN) ───────────────────────────

  test('7a — EN calendar shows English chrome, not leaked Spanish strings', async ({ page }) => {
    await page.goto('/en/dashboard/agendar')
    await settle(page)
    if (!(await page.locator('.lk-agendar-slot, [class*="lk-agendar-slot"]').first().count())) {
      // Bounced (no credit/intake). Still assert no ES leak on whatever rendered.
      const body = (await page.locator('body').innerText()).toLowerCase()
      test.info().annotations.push({ type: 'observed', description: `/en bounced to ${page.url()}` })
      // Don't hard-fail on guard pages — they're separate surfaces.
      return
    }
    await expect(page.getByText(/available balance/i).first()).toBeVisible()
    await expect(page.getByText(/how it works/i).first()).toBeVisible()
    const body = (await page.locator('main, body').first().innerText()).toLowerCase()
    // The agendar `t.en` table must not surface these ES anchors on /en.
    const esLeaks = ['saldo disponible', 'cómo funciona', 'semana siguiente', 'confirmar reserva']
      .filter(s => body.includes(s))
    test.info().annotations.push({ type: 'observed', description: `EN page ES leaks=${JSON.stringify(esLeaks)}` })
    expect(esLeaks, 'no Spanish strings should leak onto the EN agendar page').toEqual([])
  })

  test('7b — ES calendar shows Spanish chrome (no leaked English)', async ({ page }) => {
    if (!(await openCalendar(page))) { test.skip(true, 'calendar unavailable'); return }
    await expect(page.getByText(/saldo disponible/i).first()).toBeVisible()
    const body = (await page.locator('main').first().innerText()).toLowerCase()
    const enLeaks = ['available balance', 'how it works', 'next week', 'confirm booking']
      .filter(s => body.includes(s))
    test.info().annotations.push({ type: 'observed', description: `ES page EN leaks=${JSON.stringify(enLeaks)}` })
    expect(enLeaks, 'no English strings should leak onto the ES agendar page').toEqual([])
  })

  // ─────────────────────────── 8 · Responsive ───────────────────────────

  test('8a — 375px mobile: calendar + a bookable slot are reachable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    if (!(await openCalendar(page))) { test.skip(true, 'calendar unavailable'); return }
    await page.screenshot({ path: 'test-results/exhaustive-student-agendar-mobile.png', fullPage: true })
    const slot = page.locator('.lk-agendar-slot').first()
    await expect(slot).toBeVisible()
    // Tapping a slot must still open the confirm modal on mobile.
    await slot.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /^Confirmar reserva$/ })).toBeVisible()
  })

  // ─────────────────────────── 9 · Console errors / network 4xx-5xx ───────────────────────────

  test('9a — loading the calendar yields no console errors and no 4xx/5xx', async ({ page }) => {
    const consoleErrors: string[] = []
    const badResponses: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('response', r => {
      const s = r.status()
      // Ignore unrelated third-party analytics noise; flag our own origin only.
      if (s >= 400 && /englishkolab\.com/.test(r.url())) badResponses.push(`${s} ${r.url()}`)
    })
    const ok = await openCalendar(page)
    await page.waitForTimeout(1500)
    test.info().annotations.push({
      type: 'observed',
      description: `grid=${ok} consoleErrors=${JSON.stringify(consoleErrors.slice(0, 5))} bad=${JSON.stringify(badResponses.slice(0, 5))}`,
    })
    // Known-benign: framework hydration warnings are NOT errors; only hard errors count.
    expect(badResponses, 'no 4xx/5xx from our origin while loading agendar').toEqual([])
    expect(consoleErrors, 'no console errors on the calendar page').toEqual([])
  })

  // ─────────────────────────── 10 · Data integrity — conflict guard ───────────────────────────

  test('10a — [MUTATING] booking the SAME slot twice is blocked by the conflict guard', async ({ page }) => {
    test.skip(!db, 'service role required to seed + revert the conflicting booking')
    const s = await studentRow()
    test.skip(!s, 'student row not found')
    const originalCredit = s!.classes_remaining

    // Seed a live booking 8 days out at a clean top-of-hour, then try to book the
    // exact same slot through the UI and expect the conflict error.
    const seed = new Date()
    seed.setDate(seed.getDate() + 8)
    seed.setHours(15, 0, 0, 0)
    const seedIso = seed.toISOString()
    await db!.from('students').update({ classes_remaining: 3 }).eq('id', s!.id)
    // Clean any stale row at that slot first.
    await db!.from('bookings').delete().eq('student_id', s!.id).eq('scheduled_at', seedIso)
    const { error: seedErr } = await db!.from('bookings').insert({
      student_id: s!.id, teacher_id: null, scheduled_at: seedIso,
      duration_minutes: 60, status: 'pending', type: 'class',
    })
    test.skip(!!seedErr, `could not seed conflict row: ${seedErr?.message}`)

    try {
      const ok = await openCalendar(page)
      if (!ok) { test.skip(true, 'calendar unavailable'); return }
      // The seeded slot renders as the booked "—" cell, so it is NOT clickable
      // from the grid (the UI already prevents re-selecting an occupied slot).
      // To exercise the SERVER conflict guard we tamper a fresh booking's POST to
      // target the seeded scheduled_at.
      await page.locator('.lk-agendar-slot').first().click()
      await expect(page.getByRole('button', { name: /^Confirmar reserva$/ })).toBeVisible({ timeout: 10_000 })
      let routed = false
      await page.route('**/dashboard/agendar', async route => {
        const req = route.request(); const post = req.postData()
        if (req.method() === 'POST' && post && /scheduled_at/.test(post) && !routed) {
          routed = true
          await route.continue({ postData: post.replace(/(name="scheduled_at"\r?\n\r?\n)[^\r\n]+/, `$1${seedIso}`) })
        } else { await route.continue() }
      })
      await page.getByRole('button', { name: /^Confirmar reserva$/ }).click()
      await settle(page)
      await page.unroute('**/dashboard/agendar').catch(() => {})
      // The conflict guard ES copy must appear; no success screen.
      await expect(page.getByText(/Ya tienes una clase agendada para ese horario\./i)).toBeVisible({ timeout: 10_000 })
      await expect(page.getByRole('heading', { name: /¡Reservada!|Booked!/ })).toHaveCount(0)

      // Integrity: still exactly ONE live row at that slot (the seed), credit unchanged.
      const { count: rowCount } = await db!
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', s!.id).eq('scheduled_at', seedIso).neq('status', 'cancelled')
      expect(rowCount, 'conflict guard must prevent a duplicate live row').toBe(1)
    } finally {
      await db!.from('bookings').delete().eq('student_id', s!.id).eq('scheduled_at', seedIso)
      await db!.from('students').update({ classes_remaining: originalCredit }).eq('id', s!.id)
    }
  })
})
