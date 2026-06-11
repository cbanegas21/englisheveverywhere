/**
 * EXHAUSTIVE TEACHER-HOME SWEEP — every what-if on the teacher dashboard +
 * agenda: /es/maestro/dashboard and /es/maestro/dashboard/agenda.
 *
 * Surface = the teacher landing page (greeting top bar, the "Accepting
 * students" / accepting_students toggle + its one-line explainer [TE-01],
 * specialization chips, the "De un vistazo" / At-a-glance StatLedger of 3
 * stats, the "Próximas sesiones" upcoming list + JoinSessionButton, the
 * "Acciones rápidas" quick-action column) AND the Agenda page (pending
 * "Clases por confirmar" with confirm/decline, "Sesiones confirmadas
 * próximas" with Join + reschedule modal). The teacher dashboard LAYOUT
 * chrome (Sidebar nav + locale toggle + sign-out, plus the maestro/dashboard
 * is_active gate) is part of this surface and exercised here.
 *
 * Runs against LIVE (PLAYWRIGHT_BASE_URL=https://englishkolab.com). We reuse
 * the saved teacher session (STATE.teacher) so we never log in (no rate-limit
 * contention).
 *
 * SAFETY: this surface is mostly read-only. The ONE real mutation is the
 * accepting_students toggle (writes teachers.accepting_students). Probes that
 * touch it are tagged [MUTATING] and ALWAYS restore the original value. We
 * NEVER confirm/decline a real pending booking (that mutates a student's
 * class) and NEVER submit a real reschedule — we open the modal, validate
 * client-side guards, and cancel WITHOUT submitting.
 *
 * Selectors + ES/EN label text extracted verbatim from:
 *   src/app/[lang]/maestro/dashboard/page.tsx
 *   src/app/[lang]/maestro/dashboard/TeacherDashboardClient.tsx
 *   src/app/[lang]/maestro/dashboard/agenda/page.tsx
 *   src/app/[lang]/maestro/dashboard/agenda/AgendaClient.tsx
 *   src/app/[lang]/maestro/layout.tsx
 *   src/app/[lang]/maestro/dashboard/layout.tsx
 *   src/components/dashboard/Sidebar.tsx
 *   src/components/ui/{DashTopBar,StatLedger,StatusBadge}.tsx
 *   src/components/JoinSessionButton.tsx
 *
 * NOT serial — these probes EXPECT some failures (each failure = a finding);
 * serial mode would abort the whole block on the first one.
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, hasAuthCookie } from './_exhaustive/helpers'

// Reuse the saved authenticated teacher session for EVERY test in this file.
test.use({ storageState: STATE.teacher })

// ─────────────────────────── shared expectations ───────────────────────────
// Exact strings the page MUST render (source-of-truth from the components above).
const GREETINGS_ES = /buenos días|buenas tardes|buenas noches/i
const GREETINGS_EN = /good morning|good afternoon|good evening/i
// StatLedger kickers (TeacherDashboardClient.tsx t.{es,en}.stats).
const STAT_KICKERS_ES = ['Sesiones este mes', 'Total de sesiones', 'Tu calificación']
const STAT_KICKERS_EN = ['Sessions this month', 'Total sessions', 'Your rating']
// Sidebar teacherNav labels (Sidebar.tsx).
const NAV_ES = ['Inicio', 'Mi agenda', 'Mis estudiantes', 'Tareas', 'Disponibilidad', 'Materiales', 'Ganancias', 'Configuración']
const NAV_EN = ['Home', 'My schedule', 'My students', 'Homework', 'Availability', 'Materials', 'Earnings', 'Settings']

// The greeting heading (DashTopBar <h1>) is unique to the teacher home. It reads
// "<greeting>, <firstName> — <subtitle>" so we match on the greeting word.
async function expectTeacherHomeRendered(page: Page, lang: 'es' | 'en' = 'es') {
  await expect(
    page.getByRole('heading', { name: lang === 'es' ? GREETINGS_ES : GREETINGS_EN }),
  ).toBeVisible({ timeout: 20_000 })
}

// The Agenda page top bar title is "Mi agenda" / "My schedule".
async function expectAgendaRendered(page: Page, lang: 'es' | 'en' = 'es') {
  await expect(
    page.getByRole('heading', { name: lang === 'es' ? /^Mi agenda$/i : /^My schedule$/i }),
  ).toBeVisible({ timeout: 20_000 })
}

// The accepting_students toggle is a <button aria-pressed> containing the mono
// kicker "Nuevas reservas" / "New bookings". Locate it by that kicker text.
function acceptingToggle(page: Page) {
  return page.getByRole('button').filter({ hasText: /Nuevas reservas|New bookings/i }).first()
}

// Collect console + network failures while a body runs; return them.
function watch(page: Page) {
  const consoleErrors: string[] = []
  const badResponses: string[] = []
  const pageErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  page.on('response', (r) => {
    const u = r.url()
    // Ignore third-party noise (analytics, fonts, livekit, supabase pings) — focus on our origin pages.
    if (r.status() >= 400 && /englishkolab\.com/.test(u) && !/\/sala\//.test(u)) {
      badResponses.push(`${r.status()} ${r.request().method()} ${u}`)
    }
  })
  return { consoleErrors, badResponses, pageErrors }
}

test.describe('EXHAUSTIVE TEACHER-HOME (/es/maestro/dashboard + /agenda)', () => {

  // ───────────────────────── 1 · Happy-path render ─────────────────────────

  test('1a — ES teacher home renders greeting, accepting toggle + explainer, At-a-glance ledger', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')

    const heading = (await page.getByRole('heading', { name: GREETINGS_ES }).innerText()).toLowerCase()
    test.info().annotations.push({ type: 'observed', description: `greeting heading = "${heading}"` })
    expect(GREETINGS_ES.test(heading), 'greeting word must be Spanish').toBeTruthy()
    // Subtitle flourish lives in the same heading.
    expect(heading, 'subtitle flourish present').toMatch(/resumen de enseñanza/i)

    // The accepting_students toggle: kicker "Nuevas reservas" + state label.
    const toggle = acceptingToggle(page)
    await expect(toggle).toBeVisible()
    const toggleText = (await toggle.innerText())
    expect(toggleText, 'toggle shows ON or paused label').toMatch(/Aceptando estudiantes|En pausa/i)
    // TE-01: the one-line explainer must be present so the meaning is self-evident.
    await expect(page.getByText(/abierto a reservas de nuevos estudiantes\.|no recibirás reservas de nuevos estudiantes/i)).toBeVisible()

    // "De un vistazo" microlabel + the 3-stat ledger.
    await expect(page.getByText(/De un vistazo/i)).toBeVisible()
    for (const k of STAT_KICKERS_ES) {
      await expect(page.locator('.lk-stat-kicker', { hasText: k })).toBeVisible()
    }
    await expect(page.locator('.lk-stat')).toHaveCount(3)

    await page.screenshot({ path: 'test-results/exhaustive-teacher-home-1a-render.png', fullPage: true })
  })

  test('1b — upcoming sessions panel renders (list OR empty state, never both)', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')

    // Section header always renders + "Ver agenda →" link.
    await expect(page.getByRole('heading', { name: /Próximas sesiones/i })).toBeVisible()
    const viewAll = page.getByRole('link', { name: /Ver agenda/i })
    await expect(viewAll).toBeVisible()
    expect(await viewAll.getAttribute('href')).toMatch(/\/es\/maestro\/dashboard\/agenda$/)

    const emptyMsg = page.getByText(/No tienes sesiones próximas\./i)
    const hasEmpty = (await emptyMsg.count()) > 0
    test.info().annotations.push({ type: 'observed', description: `upcoming empty-state shown = ${hasEmpty}` })
    if (hasEmpty) {
      // Empty state offers a "Definir disponibilidad" CTA pointing at the availability editor.
      const cta = page.getByRole('link', { name: /Definir disponibilidad/i }).first()
      await expect(cta).toBeVisible()
      expect(await cta.getAttribute('href')).toMatch(/\/es\/maestro\/dashboard\/disponibilidad$/)
    } else {
      // Non-empty: each row carries an ES status badge.
      await expect(page.getByText(/Confirmada|Pendiente|En vivo/i).first()).toBeVisible()
    }
  })

  test('1c — "Acciones rápidas" quick-action column links resolve to real maestro routes', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')

    await expect(page.getByText(/Acciones rápidas/i)).toBeVisible()
    // Three quick actions: Disponibilidad / Mis estudiantes / Historial de sesiones (→ ganancias).
    const expected = [
      { name: /Disponibilidad/i, href: /\/es\/maestro\/dashboard\/disponibilidad$/ },
      { name: /Mis estudiantes/i, href: /\/es\/maestro\/dashboard\/estudiantes$/ },
      { name: /Historial de sesiones/i, href: /\/es\/maestro\/dashboard\/ganancias$/ },
    ]
    const bad: string[] = []
    for (const e of expected) {
      const link = page.getByRole('link', { name: e.name }).first()
      if ((await link.count()) === 0) { bad.push(`missing ${e.name}`); continue }
      const href = await link.getAttribute('href')
      if (!href || !e.href.test(href)) bad.push(`${e.name}→${href}`)
    }
    test.info().annotations.push({ type: 'observed', description: `quick-actions = ${bad.join(', ') || 'all ok'}` })
    expect(bad, 'all 3 quick-action links resolve to real routes').toEqual([])
  })

  test('1d — Agenda page renders both columns (pending / confirmed) with correct headers', async ({ page }) => {
    await page.goto('/es/maestro/dashboard/agenda')
    await settle(page)
    await expectAgendaRendered(page, 'es')

    await expect(page.getByText(/Gestiona tus clases asignadas/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /Clases por confirmar/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Sesiones confirmadas próximas/i })).toBeVisible()

    // Each column renders either rows or its italic empty state — never a blank/crash.
    const pendingEmpty = await page.getByText(/No hay clases por confirmar\./i).count()
    const confirmedEmpty = await page.getByText(/Sin sesiones próximas\./i).count()
    test.info().annotations.push({ type: 'observed', description: `agenda empties: pending=${pendingEmpty} confirmed=${confirmedEmpty}` })
    await page.screenshot({ path: 'test-results/exhaustive-teacher-home-1d-agenda.png', fullPage: true })
  })

  // ───────────────────────── 2 · Entry / nav / refresh / deep-link ─────────────────────────

  test('2a — deep-link straight to /es/maestro/dashboard renders without bouncing to login', async ({ page, context }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    expect(await page.locator('input[name="password"]').count(), 'should not be sent to login').toBe(0)
    await expectTeacherHomeRendered(page, 'es')
    expect(hasAuthCookie(await context.cookies()), 'session cookie present').toBeTruthy()
  })

  test('2b — a hard refresh re-renders the same teacher home (no flash to login / blank)', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    await page.reload()
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    expect(await page.locator('input[name="password"]').count()).toBe(0)
  })

  test('2c — every sidebar nav item is present and points at a real /es/maestro/dashboard route', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')

    const missing: string[] = []
    for (const label of NAV_ES) {
      const link = page.getByRole('link', { name: label, exact: true }).first()
      if ((await link.count()) === 0) { missing.push(label); continue }
      const href = await link.getAttribute('href')
      if (!href || !/^\/es\/maestro\/dashboard(\/|$)/.test(href)) missing.push(`${label}→${href}`)
    }
    test.info().annotations.push({ type: 'observed', description: `nav check; missing/bad = ${missing.join(', ') || 'none'}` })
    expect(missing, 'all teacher nav items render & target /es/maestro/dashboard/*').toEqual([])
  })

  test('2d — clicking "Mi agenda" actually navigates to the agenda section (proved by content)', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    await page.getByRole('link', { name: 'Mi agenda', exact: true }).first().click()
    await page.waitForURL(/\/es\/maestro\/dashboard\/agenda(\/|$)/, { timeout: 20_000 }).catch(() => {})
    await settle(page)
    // Prove by CONTENT we landed on the agenda (its unique title), not by URL alone.
    await expectAgendaRendered(page, 'es')
    // And we left the home greeting.
    await expect(page.getByRole('heading', { name: GREETINGS_ES })).toHaveCount(0)
  })

  test('2e — the home "Ver agenda" link navigates to the agenda', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    await page.getByRole('link', { name: /Ver agenda/i }).click()
    await page.waitForURL(/\/es\/maestro\/dashboard\/agenda(\/|$)/, { timeout: 20_000 }).catch(() => {})
    await settle(page)
    await expectAgendaRendered(page, 'es')
  })

  test('2f — a hard refresh of the agenda re-renders the agenda (no flash to login)', async ({ page }) => {
    await page.goto('/es/maestro/dashboard/agenda')
    await settle(page)
    await expectAgendaRendered(page, 'es')
    await page.reload()
    await settle(page)
    await expectAgendaRendered(page, 'es')
    expect(await page.locator('input[name="password"]').count()).toBe(0)
  })

  // ───────────────────────── 5 · Security / role guard / IDOR ─────────────────────────
  // maestro/layout.tsx reads profiles.role and bounces admin → /admin, student
  // → /dashboard. maestro/dashboard/layout.tsx additionally requires the teacher
  // record to exist + is_active. Prove other roles never see the teacher home.

  test('5a — a STUDENT session hitting /es/maestro/dashboard is bounced to the student app', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.student })
    const page = await ctx.newPage()
    try {
      await page.goto('/es/maestro/dashboard')
      await settle(page)
      await page.waitForTimeout(2500) // let the layout redirect resolve
      // Content is the source of truth: must NOT render the teacher greeting/ledger.
      await expect(page.getByText(/De un vistazo/i)).toHaveCount(0)
      await expect(page.getByText(/Nuevas reservas/i)).toHaveCount(0)
      test.info().annotations.push({ type: 'SECURITY', description: `student@ on /es/maestro/dashboard landed at ${page.url()}` })
      expect(page.url()).toMatch(/\/es\/dashboard|\/es\/login|\/es\/onboarding/)
    } finally {
      await ctx.close()
    }
  })

  test('5b — an ADMIN session hitting /es/maestro/dashboard is bounced to /admin', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.admin })
    const page = await ctx.newPage()
    try {
      await page.goto('/es/maestro/dashboard')
      await settle(page)
      await page.waitForTimeout(2500)
      await expect(page.getByText(/De un vistazo/i)).toHaveCount(0)
      test.info().annotations.push({ type: 'SECURITY', description: `admin@ on /es/maestro/dashboard landed at ${page.url()}` })
      expect(page.url()).toMatch(/\/admin(\/|$)/)
    } finally {
      await ctx.close()
    }
  })

  test('5c — a LOGGED-OUT visitor to /es/maestro/dashboard is redirected to login (no leak)', async ({ browser }) => {
    const ctx = await browser.newContext() // no storageState → anonymous
    const page = await ctx.newPage()
    try {
      await page.goto('/es/maestro/dashboard')
      await settle(page)
      await page.waitForTimeout(2000)
      await expect(page.getByText(/De un vistazo/i)).toHaveCount(0)
      const onLogin = await page.locator('input[name="password"]').count()
      test.info().annotations.push({ type: 'observed', description: `anon → ${page.url()} ; login-form=${onLogin > 0}` })
      expect(onLogin, 'anonymous user must be sent to the login form').toBeGreaterThan(0)
    } finally {
      await ctx.close()
    }
  })

  test('5d — the agenda is guarded against a STUDENT session too (no booking data leak)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.student })
    const page = await ctx.newPage()
    try {
      await page.goto('/es/maestro/dashboard/agenda')
      await settle(page)
      await page.waitForTimeout(2500)
      // Must NOT render the agenda column headers (which would imply leaked teacher data).
      await expect(page.getByRole('heading', { name: /Clases por confirmar/i })).toHaveCount(0)
      test.info().annotations.push({ type: 'SECURITY', description: `student@ on agenda landed at ${page.url()}` })
      expect(page.url()).toMatch(/\/es\/dashboard|\/es\/login|\/es\/onboarding/)
    } finally {
      await ctx.close()
    }
  })

  // ───────────────────────── 3 · Input / param robustness ─────────────────────────
  // Neither route takes a :id param (no IDOR vector here — IDOR lives on /sala/:id,
  // covered by that surface). The only attacker-controllable input is the query
  // string + locale segment. The reschedule modal's date/time/reason inputs ARE
  // user input and are validated client-side (covered in section 6).

  test('3a — junk/SQLi/XSS query params on the home are inert (no crash, no script exec)', async ({ page }) => {
    const { badResponses, pageErrors } = watch(page)
    let dialog = false
    page.on('dialog', (d) => { dialog = true; d.dismiss().catch(() => {}) })
    const qs = `?q=' OR 1=1--&x=<script>alert(1)</script>&n=${'A'.repeat(5000)}&u=%F0%9F%98%80`
    await page.goto(`/es/maestro/dashboard${qs}`)
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    expect(dialog, 'no XSS dialog from reflected query').toBeFalsy()
    expect(await page.locator('script:has-text("alert(1)")').count()).toBe(0)
    test.info().annotations.push({ type: 'observed', description: `junk-qs: 4xx5xx=[${badResponses.join('; ')}] pageErrors=[${pageErrors.join('; ')}]` })
    expect(pageErrors, 'no uncaught page errors on junk query').toEqual([])
  })

  test('3b — junk/XSS query params on the agenda are inert', async ({ page }) => {
    let dialog = false
    page.on('dialog', (d) => { dialog = true; d.dismiss().catch(() => {}) })
    const { pageErrors } = watch(page)
    await page.goto(`/es/maestro/dashboard/agenda?x=<img src=x onerror=alert(1)>&q=%27%20OR%201=1--`)
    await settle(page)
    await expectAgendaRendered(page, 'es')
    expect(dialog, 'no XSS dialog from reflected query on agenda').toBeFalsy()
    expect(pageErrors, 'no uncaught page errors on agenda junk query').toEqual([])
  })

  test('3c — an unknown locale segment (/xx/maestro/dashboard) does not render the teacher home', async ({ page }) => {
    await page.goto('/xx/maestro/dashboard')
    await settle(page)
    const shown = await page.getByText(/De un vistazo|At a glance/i).count()
    test.info().annotations.push({ type: 'observed', description: `/xx/maestro/dashboard → ${page.url()} ; ledger=${shown > 0}` })
    expect(shown, 'unknown locale must not render the teacher home').toBe(0)
  })

  // ───────────────────────── 7 · i18n parity (ES + EN) ─────────────────────────

  test('7a — EN teacher home renders fully English (greeting, ledger, nav, toggle) — no leaked ES', async ({ page }) => {
    await page.goto('/en/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'en')

    const heading = (await page.getByRole('heading', { name: GREETINGS_EN }).innerText()).toLowerCase()
    expect(GREETINGS_EN.test(heading), 'EN greeting word must be English').toBeTruthy()
    expect(GREETINGS_ES.test(heading), 'EN page must not leak a Spanish greeting').toBeFalsy()
    expect(heading, 'EN subtitle present').toMatch(/teaching overview/i)

    // English ledger microlabel + kickers.
    await expect(page.getByText(/At a glance/i)).toBeVisible()
    expect(await page.getByText(/De un vistazo/i).count(), 'no ES microlabel on EN page').toBe(0)
    for (const k of STAT_KICKERS_EN) {
      await expect(page.locator('.lk-stat-kicker', { hasText: k })).toBeVisible()
    }
    // English toggle kicker + explainer.
    await expect(page.getByText(/New bookings/i).first()).toBeVisible()
    await expect(page.getByText(/open to new student bookings\.|new student bookings are paused/i)).toBeVisible()

    // EN nav labels present.
    const missing: string[] = []
    for (const label of NAV_EN) {
      if ((await page.getByRole('link', { name: label, exact: true }).count()) === 0) missing.push(label)
    }
    test.info().annotations.push({ type: 'observed', description: `EN nav missing = ${missing.join(', ') || 'none'}` })
    expect(missing, 'EN sidebar nav fully translated').toEqual([])
    await page.screenshot({ path: 'test-results/exhaustive-teacher-home-7a-en.png', fullPage: true })
  })

  test('7b — EN agenda renders English headers + buttons (no leaked ES)', async ({ page }) => {
    await page.goto('/en/maestro/dashboard/agenda')
    await settle(page)
    await expectAgendaRendered(page, 'en')
    await expect(page.getByRole('heading', { name: /Classes to confirm/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Upcoming confirmed sessions/i })).toBeVisible()
    // Spanish column titles must not appear on the EN page.
    expect(await page.getByText(/Clases por confirmar|Sesiones confirmadas próximas/i).count(), 'no ES agenda titles on EN page').toBe(0)
  })

  test('7c — clicking the sidebar locale toggle flips the home to English', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    await page.getByRole('button', { name: /Switch to English/i }).click()
    await page.waitForURL(/\/en\/maestro\/dashboard(\/|$)/, { timeout: 20_000 }).catch(() => {})
    await settle(page)
    await expectTeacherHomeRendered(page, 'en')
    await expect(page.getByText(/At a glance/i)).toBeVisible()
    expect(await page.getByText(/De un vistazo/i).count(), 'after switch ES microlabel gone').toBe(0)
  })

  // ───────────────────────── 8 · Responsive (TE: ≤390px overlap was fixed) ─────────────────────────

  test('8a — 375px mobile home: no horizontal overflow, toggle + explainer readable (overlap-fix verify)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')

    // The known ≤390px regression was the right-side toggle/explainer overlapping
    // the title. Verify the explainer is fully visible and nothing overflows.
    await expect(acceptingToggle(page)).toBeVisible()
    await expect(page.getByText(/abierto a reservas de nuevos estudiantes\.|no recibirás reservas de nuevos estudiantes/i)).toBeVisible()

    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    test.info().annotations.push({ type: 'observed', description: `home 375px scrollWidth=${scrollW} (viewport=375)` })
    expect(scrollW, 'no horizontal overflow at 375px').toBeLessThanOrEqual(375 + 2)
    await page.screenshot({ path: 'test-results/exhaustive-teacher-home-8a-mobile.png', fullPage: true })
  })

  test('8b — 390px mobile home: title and toggle do not visually overlap (the reported bug)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')

    const heading = page.getByRole('heading', { name: GREETINGS_ES })
    const toggle = acceptingToggle(page)
    const hb = await heading.boundingBox()
    const tb = await toggle.boundingBox()
    test.info().annotations.push({ type: 'observed', description: `390px: headingBox=${JSON.stringify(hb)} toggleBox=${JSON.stringify(tb)}` })
    if (hb && tb) {
      // DashTopBar flex-wraps; on a narrow viewport the toggle should wrap BELOW
      // the title (its top ≥ heading bottom), not sit on top of it. Allow a small
      // overlap tolerance for line-height padding.
      const overlaps = tb.y < hb.y + hb.height - 6 && tb.y + tb.height > hb.y + 6
      expect(overlaps, 'toggle must not overlap the greeting title at 390px (TE mobile-overlap fix)').toBeFalsy()
    }
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollW, 'no horizontal overflow at 390px').toBeLessThanOrEqual(390 + 2)
    await page.screenshot({ path: 'test-results/exhaustive-teacher-home-8b-390.png', fullPage: true })
  })

  test('8c — 375px mobile home: hamburger opens the teacher nav drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    const hamburger = page.getByRole('button', { name: /Open menu|Close menu/i })
    await expect(hamburger).toBeVisible()
    await hamburger.click()
    await page.waitForTimeout(500) // drawer spring
    await expect(page.getByRole('link', { name: 'Mi agenda', exact: true }).first()).toBeVisible()
  })

  test('8d — 375px mobile agenda: two columns stack, no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/maestro/dashboard/agenda')
    await settle(page)
    await expectAgendaRendered(page, 'es')
    await expect(page.getByRole('heading', { name: /Clases por confirmar/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Sesiones confirmadas próximas/i })).toBeVisible()
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    test.info().annotations.push({ type: 'observed', description: `agenda 375px scrollWidth=${scrollW}` })
    expect(scrollW, 'no horizontal overflow on agenda at 375px').toBeLessThanOrEqual(375 + 2)
    await page.screenshot({ path: 'test-results/exhaustive-teacher-home-8d-agenda-mobile.png', fullPage: true })
  })

  test('8e — desktop 1280px: At-a-glance ledger lays out as three columns on one row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    await expect(page.locator('.lk-stat')).toHaveCount(3)
    const tops = await page.locator('.lk-stat').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    test.info().annotations.push({ type: 'observed', description: `stat row tops (desktop) = ${tops.join(', ')}` })
    expect(Math.max(...tops) - Math.min(...tops), 'three stats share one row at 1280px').toBeLessThanOrEqual(2)
  })

  // ───────────────────────── 9 · Console errors + network ─────────────────────────

  test('9a — no console errors, page errors, or 4xx/5xx on the home first paint', async ({ page }) => {
    const { consoleErrors, badResponses, pageErrors } = watch(page)
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    await page.waitForTimeout(1500) // catch late async errors (minute-tick mounts here)

    const realConsole = consoleErrors.filter((e) => !/Download the React DevTools|hydration/i.test(e))
    test.info().annotations.push({ type: 'observed', description: `console=[${realConsole.join(' | ')}]` })
    test.info().annotations.push({ type: 'observed', description: `pageErrors=[${pageErrors.join(' | ')}]` })
    test.info().annotations.push({ type: 'observed', description: `bad-network=[${badResponses.join(' | ')}]` })

    expect(pageErrors, 'no uncaught exceptions on the teacher home').toEqual([])
    expect(badResponses, 'no 4xx/5xx from our origin on the teacher home').toEqual([])
    expect(realConsole, 'no console errors on the teacher home').toEqual([])
  })

  test('9b — no console/page errors or 4xx/5xx on the agenda first paint', async ({ page }) => {
    const { consoleErrors, badResponses, pageErrors } = watch(page)
    await page.goto('/es/maestro/dashboard/agenda')
    await settle(page)
    await expectAgendaRendered(page, 'es')
    await page.waitForTimeout(1500)
    const realConsole = consoleErrors.filter((e) => !/Download the React DevTools|hydration/i.test(e))
    test.info().annotations.push({ type: 'observed', description: `agenda console=[${realConsole.join(' | ')}]` })
    test.info().annotations.push({ type: 'observed', description: `agenda pageErrors=[${pageErrors.join(' | ')}]` })
    test.info().annotations.push({ type: 'observed', description: `agenda bad-network=[${badResponses.join(' | ')}]` })
    expect(pageErrors, 'no uncaught exceptions on the agenda').toEqual([])
    expect(badResponses, 'no 4xx/5xx from our origin on the agenda').toEqual([])
    expect(realConsole, 'no console errors on the agenda').toEqual([])
  })

  // ───────────────────────── 10 · Data integrity / Join logic ─────────────────────────

  test('10a — the rating ledger stat shows a number ≤ 5 or the "—" no-rating placeholder', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    // Stats array order: [sessions this month, total sessions, rating(accent)].
    const values = await page.locator('.lk-stat .lk-stat-value').evaluateAll((els) => els.map((e) => (e.textContent || '').trim()))
    test.info().annotations.push({ type: 'observed', description: `ledger values = ${values.join(' | ')}` })
    expect(values.length, 'three stat values').toBe(3)
    const rating = values[2]
    // rating renders `rating.toFixed(1)` when > 0, else '—'.
    if (rating !== '—') {
      const n = Number(rating)
      expect(Number.isNaN(n), 'rating is numeric').toBeFalsy()
      expect(n, 'rating must be within 0–5').toBeGreaterThanOrEqual(0)
      expect(n, 'rating must be within 0–5').toBeLessThanOrEqual(5)
    }
  })

  test('10b — Join logic: upcoming-session Join button matches the 24h-before / 90m-after window', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')

    // JoinSessionButton renders "Entrar a clase" (link, joinable), "Empieza en …"
    // (disabled span, too early) or "Sesión terminada" (disabled span, too late).
    const join = page.getByRole('link', { name: /Entrar a clase/i })
    const startsIn = page.getByText(/Empieza en/i)
    const ended = page.getByText(/Sesión terminada/i)
    const hasUpcoming = (await page.getByText(/No tienes sesiones próximas\./i).count()) === 0
    const joinCount = await join.count()
    const startsInCount = await startsIn.count()
    const endedCount = await ended.count()
    test.info().annotations.push({ type: 'observed', description: `upcoming=${hasUpcoming} join=${joinCount} startsIn=${startsInCount} ended=${endedCount}` })

    if (hasUpcoming) {
      // Every upcoming row must surface exactly one Join state; the joinable ones
      // must link to the room. (Page filters out anything past the late cap, so
      // "Sesión terminada" should generally not appear, but we don't hard-fail on it.)
      const total = joinCount + startsInCount + endedCount
      expect(total, 'each upcoming session shows a Join state').toBeGreaterThan(0)
      if (joinCount > 0) {
        const href = await join.first().getAttribute('href')
        expect(href, 'joinable Join button links to /es/sala/<bookingId>').toMatch(/\/es\/sala\/[0-9a-f-]+$/i)
      }
    } else {
      test.info().annotations.push({ type: 'inconclusive', description: 'no upcoming sessions for this teacher — Join logic not exercisable' })
    }
  })

  test('10c — agenda confirmed sessions: Join link (when shown) targets the room; pending offers confirm/decline', async ({ page }) => {
    await page.goto('/es/maestro/dashboard/agenda')
    await settle(page)
    await expectAgendaRendered(page, 'es')

    // Confirmed column: any "Entrar a sala" link must target /es/sala/<id>.
    const join = page.getByRole('link', { name: /Entrar a sala/i })
    const joinCount = await join.count()
    if (joinCount > 0) {
      const href = await join.first().getAttribute('href')
      test.info().annotations.push({ type: 'observed', description: `agenda Join href = ${href}` })
      expect(href, 'agenda Join targets the room route').toMatch(/\/es\/sala\/[0-9a-f-]+$/i)
    }

    // Pending column: if there are pending rows, they expose confirm + decline buttons.
    const hasPending = (await page.getByText(/No hay clases por confirmar\./i).count()) === 0
    if (hasPending) {
      await expect(page.getByRole('button', { name: /Puedo impartirla/i }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: /No puedo/i }).first()).toBeVisible()
    }
    test.info().annotations.push({ type: 'observed', description: `agenda: joins=${joinCount} hasPending=${hasPending}` })
  })

  // ───────────────────────── 6 · State / concurrency / forms ─────────────────────────

  // The accepting_students toggle is the ONLY real mutation on this surface.
  // Each toggle probe reads the current state, flips it, asserts, then RESTORES
  // the original state so we leave the QA teacher account exactly as found.

  test('6a [MUTATING] — accepting toggle flips state + label and restores cleanly', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')

    const toggle = acceptingToggle(page)
    await expect(toggle).toBeVisible()
    const before = await toggle.getAttribute('aria-pressed')
    const beforeLabel = (await toggle.innerText())
    test.info().annotations.push({ type: 'observed', description: `toggle before: aria-pressed=${before} label="${beforeLabel.replace(/\s+/g, ' ')}"` })

    // Flip it (writes teachers.accepting_students via the client supabase update).
    await toggle.click()
    // Button disables on isPending; wait for it to re-enable and the label to flip.
    await expect
      .poll(async () => await acceptingToggle(page).getAttribute('aria-pressed'), { timeout: 15_000 })
      .not.toBe(before)
    const afterLabel = (await acceptingToggle(page).innerText())
    expect(afterLabel, 'label changed after toggle').not.toBe(beforeLabel)
    // The explainer text must track the new state.
    if ((await acceptingToggle(page).getAttribute('aria-pressed')) === 'false') {
      await expect(page.getByText(/no recibirás reservas de nuevos estudiantes/i)).toBeVisible()
    } else {
      await expect(page.getByText(/abierto a reservas de nuevos estudiantes\./i)).toBeVisible()
    }

    // RESTORE: flip back to the original value so the shared QA account is unchanged.
    await acceptingToggle(page).click()
    await expect
      .poll(async () => await acceptingToggle(page).getAttribute('aria-pressed'), { timeout: 15_000 })
      .toBe(before)
    test.info().annotations.push({ type: 'observed', description: `toggle restored to aria-pressed=${before}` })
  })

  test('6b [MUTATING] — toggle survives a reload (state persisted to DB, not just local), then restored', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')

    const before = await acceptingToggle(page).getAttribute('aria-pressed')
    // Flip + wait.
    await acceptingToggle(page).click()
    await expect
      .poll(async () => await acceptingToggle(page).getAttribute('aria-pressed'), { timeout: 15_000 })
      .not.toBe(before)
    const flipped = await acceptingToggle(page).getAttribute('aria-pressed')

    // Reload: the SSR page reads teachers.accepting_students. If persisted, the
    // flipped value survives. (A finding if it reverts → the write didn't land.)
    await page.reload()
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    const afterReload = await acceptingToggle(page).getAttribute('aria-pressed')
    test.info().annotations.push({ type: 'observed', description: `toggle before=${before} flipped=${flipped} afterReload=${afterReload}` })
    expect(afterReload, 'toggle state must persist across reload (DB write landed)').toBe(flipped)

    // RESTORE original.
    await acceptingToggle(page).click()
    await expect
      .poll(async () => await acceptingToggle(page).getAttribute('aria-pressed'), { timeout: 15_000 })
      .toBe(before)
  })

  test('6c — reschedule modal opens, enforces no-past-time guard, and closes WITHOUT submitting (non-mutating)', async ({ page }) => {
    await page.goto('/es/maestro/dashboard/agenda')
    await settle(page)
    await expectAgendaRendered(page, 'es')

    const reschedBtn = page.getByRole('button', { name: /^Solicitar reagendar$/i }).first()
    if ((await reschedBtn.count()) === 0) {
      test.info().annotations.push({ type: 'inconclusive', description: 'no confirmed booking with an open reschedule button — modal not exercisable' })
      return
    }
    await reschedBtn.click()
    // Modal opens with the reschedule title.
    await expect(page.getByRole('heading', { name: /Solicitar reagendar/i })).toBeVisible()
    await expect(page.getByText(/El admin revisará tu nueva hora/i)).toBeVisible()

    // Drive the client-side guard: set a clearly-past date and try to submit.
    await page.locator('input[type="date"]').fill('2020-01-01')
    await page.locator('input[type="time"]').fill('09:00')
    await page.getByRole('button', { name: /^Enviar solicitud$/i }).click()
    // Must surface the past-time validation error and NOT submit.
    await expect(page.getByText(/La hora no puede estar en el pasado/i)).toBeVisible({ timeout: 8_000 })

    // Close without submitting → no live mutation.
    await page.getByRole('button', { name: /^Cancelar$/i }).click()
    await expect(page.getByRole('heading', { name: /Solicitar reagendar/i })).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: 'reschedule modal: past-time guard fired; closed without submit' })
  })

  test('6d — reschedule modal empty-field guard fires (non-mutating)', async ({ page }) => {
    await page.goto('/es/maestro/dashboard/agenda')
    await settle(page)
    await expectAgendaRendered(page, 'es')

    const reschedBtn = page.getByRole('button', { name: /^Solicitar reagendar$/i }).first()
    if ((await reschedBtn.count()) === 0) {
      test.info().annotations.push({ type: 'inconclusive', description: 'no reschedule button available' })
      return
    }
    await reschedBtn.click()
    await expect(page.getByRole('heading', { name: /Solicitar reagendar/i })).toBeVisible()
    // Clear the prefilled date/time, then submit → "Selecciona fecha y hora".
    await page.locator('input[type="date"]').fill('')
    await page.locator('input[type="time"]').fill('')
    await page.getByRole('button', { name: /^Enviar solicitud$/i }).click()
    await expect(page.getByText(/Selecciona fecha y hora/i)).toBeVisible({ timeout: 8_000 })
    // Close without submitting.
    await page.getByRole('button', { name: /^Cancelar$/i }).click()
    await expect(page.getByRole('heading', { name: /Solicitar reagendar/i })).toHaveCount(0)
  })

  // ───────────────────────── 4 · Failure / stale-session state ─────────────────────────

  test('4a — a corrupted auth cookie does not render a broken half teacher-home', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const cookies = await ctx.cookies()
    const authCookies = cookies.filter((c) => /^sb-.*-auth-token/.test(c.name))
    if (authCookies.length === 0) {
      test.info().annotations.push({ type: 'inconclusive', description: 'no sb-* auth cookie found to tamper' })
      await ctx.close()
      return
    }
    await ctx.clearCookies()
    await ctx.addCookies(authCookies.map((c) => ({ ...c, value: 'tampered.' + c.value.slice(0, 12) })))
    const page = await ctx.newPage()
    try {
      await page.goto('/es/maestro/dashboard')
      await settle(page)
      await page.waitForTimeout(1500)
      const ledger = await page.getByText(/De un vistazo/i).count()
      const onLogin = await page.locator('input[name="password"]').count()
      test.info().annotations.push({ type: 'observed', description: `tampered-cookie → ${page.url()} ; ledger=${ledger} login=${onLogin}` })
      // Invalid session → login form (or at least NOT a rendered teacher home), never a stuck half-shell.
      expect(onLogin > 0 || ledger === 0, 'invalid session should go to login, not a broken teacher home').toBeTruthy()
    } finally {
      await ctx.close()
    }
  })

  // ───────────────────────── 2(g) · Sidebar help link + sign-out ─────────────────────────

  test('2g — sidebar "Ayuda y contacto" is a working mailto to hola@englishkolab.com', async ({ page }) => {
    await page.goto('/es/maestro/dashboard')
    await settle(page)
    await expectTeacherHomeRendered(page, 'es')
    const help = page.getByRole('link', { name: /Ayuda y contacto/i }).first()
    await expect(help).toBeVisible()
    const href = await help.getAttribute('href')
    test.info().annotations.push({ type: 'observed', description: `help link href = ${href}` })
    expect(href, 'help link should be a mailto to the support inbox').toMatch(/^mailto:hola@englishkolab\.com$/)
  })

  test('6e — sign-out from the teacher home clears the session (revisiting bounces to login)', async ({ browser }) => {
    // Isolated context so we never disturb the shared STATE.teacher file.
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    try {
      await page.goto('/es/maestro/dashboard')
      await settle(page)
      await expectTeacherHomeRendered(page, 'es')
      await page.getByRole('button', { name: /Cerrar sesión/i }).click()
      await page.waitForURL(/\/es\/(login|$)|\/es$/, { timeout: 20_000 }).catch(() => {})
      await settle(page)
      await page.goto('/es/maestro/dashboard')
      await settle(page)
      await page.waitForTimeout(1500)
      const ledger = await page.getByText(/De un vistazo/i).count()
      const onLogin = await page.locator('input[name="password"]').count()
      test.info().annotations.push({ type: 'observed', description: `after sign-out, /es/maestro/dashboard → ${page.url()} ; ledger=${ledger} login=${onLogin}` })
      expect(ledger, 'signed-out user must not see the teacher home').toBe(0)
      expect(onLogin, 'signed-out user should land on the login form').toBeGreaterThan(0)
    } finally {
      await ctx.close()
    }
  })
})
