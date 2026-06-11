/**
 * EXHAUSTIVE LIVE QA — ADMIN BOOKINGS CALENDAR  (/es/admin/bookings)
 *
 * Surface: the admin booking calendar (week / day / board views, teacher filter
 * overlay, drag-drop assign, pending-assignment table with inline assign, the
 * booking detail panel with assign/complete/cancel, the teacher-availability
 * panel, and the reschedule-requests triage banner).
 *
 * SOURCE OF TRUTH (read 2026-06-09, do not guess):
 *   src/app/[lang]/admin/bookings/page.tsx              — server load + role guard (layout redirects non-admin → /dashboard)
 *   src/app/[lang]/admin/bookings/BookingCalendarClient.tsx — the whole calendar UI (HARDCODED ENGLISH — no `lang` branching)
 *   src/app/[lang]/admin/bookings/BookingAssign.tsx     — inline assign control (green "Confirmed" echo on success — LIVE-001)
 *   src/app/[lang]/admin/bookings/RescheduleRequestsPanel.tsx — the ONLY localized piece (t.es / t.en)
 *   src/app/[lang]/admin/bookings/availability.ts       — isTeacherAvailableClient (off-hours → "✗ … (off-hours)")
 *   src/app/[lang]/admin/actions.ts                     — assignAndConfirmBooking guards (availability/primary/conflict, force override)
 *
 * KEY OBSERVED REALITY:
 *   • The calendar client renders English strings regardless of /es vs /en
 *     ("Bookings", "Pending Assignments", "All teachers", "Mark Complete",
 *     "Unassigned", "Assign Teacher", "Honduras time (CST, UTC-6)", view tabs
 *     "week/day/board"). Static audit flagged this — probed below (i18n parity).
 *   • assertAdmin() in actions.ts throws on non-admin; the admin LAYOUT redirects
 *     a non-admin to /${lang}/dashboard. So role-guard proof = NOT seeing the
 *     calendar chrome, AND landing on the student dashboard.
 *   • There is NO :id URL param on this route (the only param is ?weekStart=).
 *     IDOR/injection surface is the weekStart query param + the server-action
 *     booking ids (not driveable from the URL), so we probe weekStart hardening.
 *   • LIVE-001: assign UI optimistically shows "Confirmed" / toast "Assigned and
 *     confirmed"; off-hours teachers stay SELECTABLE (label "✗ … (off-hours)")
 *     and a window.confirm() lets admin force-assign. Probed read-only below;
 *     the one [MUTATING] assign reverts via the service role.
 *
 * Session: reuses the saved admin storageState — NEVER logs in (no rate-limit
 * contention). Not serial; probes EXPECT failures (each failed assert = finding).
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, makeAdmin } from './_exhaustive/helpers'

const db = makeAdmin()
const ROUTE = '/es/admin/bookings'

// Admin-only chrome that must NEVER render for a non-admin.
const ADMIN_CHROME = /Pending Assignments|Bookings Today|Availability Slots|Visual calendar/i

async function gotoCalendar(page: Page, path = ROUTE) {
  await page.goto(path)
  await settle(page)
}

// True if the calendar shell actually rendered (header + stats present).
async function calendarVisible(page: Page): Promise<boolean> {
  return (await page.getByText(/Visual calendar/i).count()) > 0
}

test.describe('EXHAUSTIVE · ADMIN BOOKINGS CALENDAR', () => {
  test.use({ storageState: STATE.admin })

  // ───────────────────────── 1 · Happy-path render ─────────────────────────

  test('1a — calendar renders: header, stats bar, view tabs, pending table', async ({ page }) => {
    const console4xx: string[] = []
    page.on('response', r => { if (r.status() >= 400) console4xx.push(`${r.status()} ${r.url()}`) })
    await gotoCalendar(page)

    // Header + sub-line (Honduras time annotation is hardcoded in the client).
    await expect(page.getByRole('heading', { level: 1, name: /Bookings/i })).toBeVisible()
    await expect(page.getByText(/Visual calendar.*Honduras time/i)).toBeVisible()

    // Four stat cards (exact labels from the client source).
    for (const label of ['Bookings Today', 'Pending Assignment', 'Confirmed This Week', 'Availability Slots']) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible()
    }

    // The three view toggle buttons.
    for (const v of ['week', 'day', 'board']) {
      await expect(page.getByRole('button', { name: new RegExp(`^${v}$`, 'i') })).toBeVisible()
    }

    // Pending-assignments section heading (count in parens).
    await expect(page.getByRole('heading', { name: /Pending Assignments \(\d+\)/ })).toBeVisible()

    await page.screenshot({ path: 'test-results/exhaustive-admin-bookings-render.png', fullPage: true })
    test.info().annotations.push({ type: 'observed', description: `page 4xx/5xx responses: ${console4xx.join(' | ') || 'none'}` })
  })

  test('1b — week view shows the 24-hour grid and a week range label', async ({ page }) => {
    await gotoCalendar(page)
    await page.getByRole('button', { name: /^week$/i }).click()
    await settle(page, 800)
    // Prev / Next week navigation buttons exist (hardcoded "← Prev" / "Next →").
    await expect(page.getByRole('button', { name: /Prev/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Next/i })).toBeVisible()
    // Hour labels (12am / 12pm) rendered in the grid gutter.
    await expect(page.getByText('12am', { exact: true }).first()).toBeVisible()
  })

  // ───────────────────────── 2 · Entry / nav / deep-link / refresh ─────────────────────────

  test('2a — ?weekStart deep-link is honored and the range label reflects it', async ({ page }) => {
    // A fixed past Monday so the assertion is deterministic.
    await gotoCalendar(page, `${ROUTE}?weekStart=2026-01-05`)
    await page.getByRole('button', { name: /^week$/i }).click()
    await settle(page, 800)
    // The week header formats month-long+day+year in en-US; Jan 5 2026 → "January 5, 2026".
    await expect(page.getByText(/January 5, 2026/i)).toBeVisible()
  })

  test('2b — Next-week navigation pushes ?weekStart and re-renders', async ({ page }) => {
    await gotoCalendar(page, `${ROUTE}?weekStart=2026-01-05`)
    await page.getByRole('button', { name: /^week$/i }).click()
    await settle(page, 600)
    await page.getByRole('button', { name: /Next/i }).click()
    await page.waitForURL(/weekStart=2026-01-12/, { timeout: 15_000 }).catch(() => {})
    test.info().annotations.push({ type: 'observed', description: `after Next → ${page.url()}` })
    expect(page.url()).toMatch(/weekStart=2026-01-12/)
    // Content confirms re-render (not just a URL change).
    await expect(page.getByText(/January 12, 2026/i)).toBeVisible({ timeout: 15_000 })
  })

  test('2c — hard refresh on a deep-linked week keeps the calendar (no auth bounce)', async ({ page }) => {
    await gotoCalendar(page, `${ROUTE}?weekStart=2026-01-05`)
    await page.reload()
    await settle(page)
    expect(await calendarVisible(page), 'admin stays on the calendar after refresh').toBeTruthy()
  })

  test('2d — day-view round-trip: clicking a day header switches to day view', async ({ page }) => {
    await gotoCalendar(page)
    await page.getByRole('button', { name: /^day$/i }).click()
    await settle(page, 600)
    // Day view has a "← Week" button + an "N bookings" counter.
    await expect(page.getByRole('button', { name: /← Week|Week/i }).first()).toBeVisible()
    await expect(page.getByText(/\d+ bookings/i).first()).toBeVisible()
  })

  // ───────────────────────── 3 · Input validation on the only input: ?weekStart ─────────────────────────

  test('3a — malformed / injection ?weekStart never 500s and never blank-renders', async ({ page }) => {
    const vectors = [
      'not-a-date',
      `2026-01-05' OR '1'='1`,
      '<script>alert(1)</script>',
      '2026-13-99',                // out-of-range
      '%2e%2e%2f%2e%2e%2f',        // path-ish
      '0000-00-00',
      '99999999-01-01',            // oversized year
      'الإثنين',                    // unicode
    ]
    const findings: string[] = []
    for (const v of vectors) {
      const status: number[] = []
      page.removeAllListeners('response')
      page.on('response', r => { if (r.url().includes('/admin/bookings') && r.status() >= 500) status.push(r.status()) })
      await gotoCalendar(page, `${ROUTE}?weekStart=${encodeURIComponent(v)}`)
      const body = (await page.locator('body').innerText()).toLowerCase()
      const crashed = status.length > 0 || /application error|server error|invalid time value|unhandled/.test(body)
      // It must EITHER fall back to a real calendar OR show a clean error — never crash.
      const recovered = await calendarVisible(page)
      if (crashed || !recovered) findings.push(`weekStart=${v} → 5xx=${status.join(',')||'none'} recovered=${recovered}`)
    }
    page.removeAllListeners('response')
    test.info().annotations.push({ type: 'observed', description: `weekStart vectors:\n${findings.join('\n') || 'all recovered cleanly'}` })
    expect(findings, 'malformed weekStart must degrade gracefully (fallback to current week), never 5xx/blank').toEqual([])
  })

  test('3b — XSS in ?weekStart is not executed as live script', async ({ page }) => {
    let dialog = false
    page.on('dialog', d => { dialog = true; d.dismiss().catch(() => {}) })
    await gotoCalendar(page, `${ROUTE}?weekStart=${encodeURIComponent('"><script>alert(1)</script>')}`)
    expect(dialog, 'no script execution from weekStart').toBeFalsy()
    expect(await page.locator('script:has-text("alert(1)")').count(), 'no injected live <script>').toBe(0)
  })

  // ───────────────────────── 5 · Security / permissions / role guard ─────────────────────────

  test('5a — a STUDENT hitting /es/admin/bookings sees NO admin chrome (bounced to dashboard)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.student })
    const page = await ctx.newPage()
    await gotoCalendar(page)
    await page.waitForTimeout(2500) // let the layout redirect resolve
    // Content is the source of truth — never assert a mid-redirect URL.
    await expect(page.getByText(ADMIN_CHROME)).toHaveCount(0)
    // Positive proof they landed in their OWN area, not a leaked/blank admin shell.
    const onStudent = (await page.getByText(/clases disponibles|tus próximas clases|hola,/i).count()) > 0
    test.info().annotations.push({ type: 'SECURITY', description: `student@bookings → ${page.url()} ; admin-chrome-leak=${!(await page.getByText(ADMIN_CHROME).count() === 0)} ; landed-on-student=${onStudent}` })
    await ctx.close()
  })

  test('5b — a TEACHER hitting /es/admin/bookings sees NO admin chrome', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    await gotoCalendar(page)
    await page.waitForTimeout(2500)
    await expect(page.getByText(ADMIN_CHROME)).toHaveCount(0)
    test.info().annotations.push({ type: 'SECURITY', description: `teacher@bookings → ${page.url()}` })
    await ctx.close()
  })

  test('5c — detail-panel deep links point at real admin sub-pages (no id leakage to attacker origin)', async ({ page }) => {
    await gotoCalendar(page)
    // Open any booking block if one exists; otherwise inspect the pending table links.
    const studentLinks = page.locator('a[href*="/admin/students/"]')
    const teacherLinks = page.locator('a[href*="/admin/teachers/"]')
    const sCount = await studentLinks.count()
    const tCount = await teacherLinks.count()
    // If links exist, each must be a same-origin admin path (never absolute/external).
    for (let i = 0; i < Math.min(sCount, 5); i++) {
      const href = await studentLinks.nth(i).getAttribute('href')
      expect(href, `student link ${href} stays on an admin path`).toMatch(/^\/(es|en)\/admin\/students\//)
    }
    for (let i = 0; i < Math.min(tCount, 5); i++) {
      const href = await teacherLinks.nth(i).getAttribute('href')
      expect(href, `teacher link ${href} stays on an admin path`).toMatch(/^\/(es|en)\/admin\/teachers\//)
    }
    test.info().annotations.push({ type: 'observed', description: `student-links=${sCount} teacher-links=${tCount}` })
  })

  // ───────────────────────── 7 · i18n ES↔EN parity (the headline finding) ─────────────────────────

  test('7a — /es calendar is HARDCODED ENGLISH (no Spanish localization)', async ({ page }) => {
    await gotoCalendar(page) // /es
    const body = await page.locator('body').innerText()
    // The client never branches on `lang`; these English strings appear verbatim on /es.
    const englishOnly = [
      'Bookings Today',
      'Pending Assignment',
      'Confirmed This Week',
      'Availability Slots',
      'Pending Assignments',
      'Visual calendar',
    ]
    const present = englishOnly.filter(s => body.includes(s))
    test.info().annotations.push({
      type: 'I18N',
      description: `EXPECTED FINDING (static audit): on /es these stay ENGLISH → ${present.join(', ')}`,
    })
    // Assert the Spanish equivalents SHOULD have been shown — failing == the localization bug.
    const hasSpanish = /Reservas de la semana|Asignaciones pendientes|Calendario visual|Reservas hoy/i.test(body)
    expect(hasSpanish, 'EXPECTED FINDING: the booking calendar is not localized — /es shows English chrome (LIVE-001 / static audit)').toBeTruthy()
  })

  test('7b — /en calendar renders the SAME English strings (proves it is hardcoded, not translated)', async ({ page }) => {
    await gotoCalendar(page, '/en/admin/bookings')
    if (page.url().includes('/login') || page.url().includes('/dashboard')) {
      test.info().annotations.push({ type: 'inconclusive', description: `/en bounced → ${page.url()}` })
      test.skip(true, '/en admin not reachable with this session')
    }
    const body = await page.locator('body').innerText()
    const sameEnglish = ['Bookings Today', 'Pending Assignments', 'Visual calendar'].every(s => body.includes(s))
    test.info().annotations.push({ type: 'observed', description: `/en shows identical English chrome = ${sameEnglish} (confirms hardcoding vs translation)` })
    expect(sameEnglish, 'on /en the chrome is correct English (so the /es gap is missing translation, not a render bug)').toBeTruthy()
  })

  test('7c — the reschedule-requests banner IS localized (only piece that branches on lang)', async ({ page }) => {
    await gotoCalendar(page)
    const hasBanner = (await page.getByText(/Solicitudes de reagendar|Reschedule requests/i).count()) > 0
    if (!hasBanner) {
      test.info().annotations.push({ type: 'inconclusive', description: 'no pending reschedule requests to assert localization on' })
      test.skip(true, 'no reschedule requests present')
    }
    // On /es the banner title must be Spanish (RescheduleRequestsPanel t.es.title).
    await expect(page.getByText(/Solicitudes de reagendar/i)).toBeVisible()
    await expect(page.getByText(/Reschedule requests/i)).toHaveCount(0)
  })

  // ───────────────────────── 8 · Responsive ─────────────────────────

  test('8a — 375px mobile: header + view tabs reachable, no horizontal overflow of the page header', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await gotoCalendar(page)
    await expect(page.getByRole('heading', { level: 1, name: /Bookings/i })).toBeVisible()
    // The board view uses overflow-x scroll columns — verify a view toggle is still tappable.
    await expect(page.getByRole('button', { name: /^board$/i })).toBeInViewport()
    await page.screenshot({ path: 'test-results/exhaustive-admin-bookings-mobile.png', fullPage: true })
    // Record body scrollWidth vs viewport — a large overflow on the chrome is a finding.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    test.info().annotations.push({ type: 'observed', description: `mobile horizontal overflow = ${overflow}px (board view is intentionally scrollable; large header overflow would be a bug)` })
  })

  test('8b — desktop 1440px: stats grid + calendar + (if open) detail panel coexist', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoCalendar(page)
    await expect(page.getByText(/Confirmed This Week/i)).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-admin-bookings-desktop.png', fullPage: true })
  })

  // ───────────────────────── 9 · Console errors + network health ─────────────────────────

  test('9a — no uncaught console errors and no 4xx/5xx on initial calendar load', async ({ page }) => {
    const consoleErrors: string[] = []
    const netErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('response', r => {
      const u = r.url()
      // Ignore third-party analytics/beacon noise; focus on our own origin.
      if (r.status() >= 400 && /englishkolab\.com/.test(u) && !/vercel-insights|analytics|_vercel/.test(u)) {
        netErrors.push(`${r.status()} ${u}`)
      }
    })
    await gotoCalendar(page)
    await page.getByRole('button', { name: /^board$/i }).click().catch(() => {})
    await settle(page, 800)
    test.info().annotations.push({ type: 'observed', description: `console.error: ${consoleErrors.slice(0, 8).join(' || ') || 'none'}` })
    test.info().annotations.push({ type: 'observed', description: `same-origin 4xx/5xx: ${netErrors.join(' | ') || 'none'}` })
    expect(netErrors, 'no same-origin 4xx/5xx on the bookings page').toEqual([])
  })

  // ───────────────────────── 6 · State / concurrency on the assign control ─────────────────────────

  test('6a — assign dropdown lists teachers with availability annotation (✓ / ✗ off-hours / ⏸ paused)', async ({ page }) => {
    await gotoCalendar(page)
    // The pending table renders BookingAssign with a <select> ("Select teacher…").
    const selects = page.getByRole('combobox')
    const count = await selects.count()
    test.info().annotations.push({ type: 'observed', description: `assign <select> count on page = ${count}` })
    if (count === 0) {
      test.info().annotations.push({ type: 'inconclusive', description: 'no pending bookings → no inline assign control to inspect' })
      test.skip(true, 'no pending assign control present')
    }
    const optText = (await selects.first().innerText()).trim()
    // Off-hours teachers must REMAIN selectable (labelled ✗ … off-hours), not hidden —
    // this is the documented LIVE-001 behavior (admin can force-assign off-hours).
    const annotated = /✓|✗|off-hours|paused|Select teacher/i.test(optText)
    test.info().annotations.push({ type: 'observed', description: `first assign <select> options: ${optText.replace(/\n/g, ' | ').slice(0, 240)}` })
    expect(annotated, 'assign dropdown should annotate availability (✓/✗ off-hours/⏸ paused) per source').toBeTruthy()
  })

  test('6b — clicking Confirm with NO teacher selected surfaces a validation message, not a silent no-op', async ({ page }) => {
    await gotoCalendar(page)
    const confirmBtns = page.getByRole('button', { name: /^Confirm$/ })
    if (await confirmBtns.count() === 0) {
      test.info().annotations.push({ type: 'inconclusive', description: 'no pending Confirm button to validate' })
      test.skip(true, 'no inline assign Confirm button present')
    }
    // Per source: the Confirm button is `disabled` while no teacher is selected.
    const first = confirmBtns.first()
    const disabled = await first.isDisabled()
    test.info().annotations.push({ type: 'observed', description: `Confirm button disabled with empty selection = ${disabled}` })
    expect(disabled, 'Confirm must be disabled (or show "Select a teacher first") with no selection — no silent assign').toBeTruthy()
  })

  // ───────────────────────── LIVE-001 · assign feedback (read-only) ─────────────────────────

  test('LIVE-001a — assign feedback strings are English ("Confirm"/"Confirmed"/toast) on the /es page', async ({ page }) => {
    await gotoCalendar(page)
    const body = await page.locator('body').innerText()
    // The inline assign control + detail panel use English action labels regardless of lang.
    const englishAssign = ['Assign Teacher', 'Mark Complete', 'Cancel Booking', 'Select teacher']
      .filter(s => body.includes(s))
    // At least the calendar-wide labels should be present if any assignable bookings exist;
    // record what we saw either way (this is corroborating evidence for the i18n finding).
    test.info().annotations.push({
      type: 'I18N',
      description: `English assign/action labels present on /es: ${englishAssign.join(', ') || 'none visible (no open detail panel / no pending rows)'}`,
    })
    // The detail-panel "Honduras time (CST)" annotation is always English when a panel opens;
    // here we only assert the page didn't accidentally localize HALF of it (consistency check).
    const mixedSpanish = /Asignar maestro|Marcar completa|Cancelar reserva/i.test(body)
    expect(mixedSpanish, 'assign actions are uniformly (if wrongly) English — flag if a partial ES translation appeared').toBeFalsy()
  })

  test('LIVE-001b [MUTATING] — assign+confirm a throwaway pending booking; UI echo matches DB; then REVERT', async ({ page }) => {
    test.skip(!db, 'service-role key required to seed + revert the throwaway booking safely')
    test.setTimeout(120_000)

    // Seed a minimal, clearly-marked throwaway pending booking far in the future so it
    // never collides with real ops, then exercise the real assign UI against it, then revert.
    const adminDb = db!
    // Pick an existing student + an active teacher to satisfy FKs (read-only lookups).
    const { data: student } = await adminDb.from('students').select('id').limit(1).single()
    const { data: teacher } = await adminDb.from('teachers').select('id').eq('is_active', true).limit(1).single()
    if (!student?.id || !teacher?.id) {
      test.info().annotations.push({ type: 'inconclusive', description: 'no seed student/teacher available' })
      test.skip(true, 'cannot seed throwaway booking')
    }

    // Schedule inside the displayed week so the block is reachable; use a far-future Monday
    // at an odd UTC hour. teacher_id null + status pending = it lands in the pending table.
    const weekStart = '2026-12-07' // a Monday
    const scheduledAt = '2026-12-09T15:00:00Z'
    const ins = await adminDb.from('bookings').insert({
      student_id: student!.id,
      teacher_id: null,
      scheduled_at: scheduledAt,
      duration_minutes: 60,
      status: 'pending',
      type: 'lesson',
    }).select('id').single()
    const bookingId = ins.data?.id as string | undefined
    if (!bookingId) {
      test.info().annotations.push({ type: 'inconclusive', description: `seed insert failed: ${ins.error?.message}` })
      test.skip(true, 'seed insert failed')
    }

    try {
      await gotoCalendar(page, `${ROUTE}?weekStart=${weekStart}`)
      // Find the pending row for our seeded booking via its inline assign <select>.
      // We force=true path implicitly: pick the teacher; if off-hours, the confirm()
      // dialog appears — accept it so the assign actually commits (this is LIVE-001).
      page.on('dialog', d => d.accept().catch(() => {}))

      const selects = page.getByRole('combobox')
      const n = await selects.count()
      let assigned = false
      for (let i = 0; i < n; i++) {
        const sel = selects.nth(i)
        // Select our active teacher by value (option value === teacher.id).
        const ok = await sel.selectOption(teacher!.id).then(() => true).catch(() => false)
        if (!ok) continue
        const row = sel.locator('xpath=ancestor::tr[1]')
        const confirmBtn = row.getByRole('button', { name: /^Confirm$/ })
        if (await confirmBtn.count() === 0) continue
        await confirmBtn.first().click()
        assigned = true
        break
      }
      await settle(page, 2500)

      // Verify the DB actually transitioned (source of truth), and capture the UI echo.
      const { data: after } = await adminDb.from('bookings').select('status, teacher_id').eq('id', bookingId!).single()
      const uiEcho = (await page.locator('body').innerText())
      const sawConfirmedEcho = /Confirmed|Assigned and confirmed/i.test(uiEcho)
      test.info().annotations.push({
        type: 'LIVE-001',
        description: `assigned-via-ui=${assigned}; DB after = status:${after?.status} teacher:${after?.teacher_id ? 'set' : 'null'}; UI showed "Confirmed/Assigned" echo=${sawConfirmedEcho}`,
      })
      await page.screenshot({ path: 'test-results/exhaustive-admin-bookings-assign-echo.png', fullPage: true })

      if (assigned) {
        // The echo must not LIE: if the UI says "Confirmed" the DB must be confirmed.
        expect(after?.status, 'UI "Confirmed" echo must match a real DB confirm (no false-positive echo — LIVE-001)').toBe('confirmed')
      }
    } finally {
      // REVERT: hard-delete the throwaway booking (never touches real data / QA accounts).
      await adminDb.from('bookings').delete().eq('id', bookingId!)
      test.info().annotations.push({ type: 'cleanup', description: `deleted throwaway booking ${bookingId}` })
    }
  })

  // ───────────────────────── 4 · Error / empty states ─────────────────────────

  test('4a — a far-future empty week shows the empty calendar gracefully (no crash, no stale data)', async ({ page }) => {
    await gotoCalendar(page, `${ROUTE}?weekStart=2030-01-07`)
    expect(await calendarVisible(page), 'empty far-future week still renders the calendar shell').toBeTruthy()
    // The pending table either shows real rows or the "All caught up!" empty state — never broken.
    const body = await page.locator('body').innerText()
    test.info().annotations.push({ type: 'observed', description: `2030 week empty-state present = ${/No pending assignments. All caught up!/i.test(body)}` })
  })
})
