/**
 * EXHAUSTIVE STUDENT-HOME SWEEP — every what-if on /es/dashboard (student home).
 *
 * Surface = the student dashboard landing page: greeting top bar, "classes
 * available" counter + Agendar CTA, conditional banners (placement / out-of-
 * classes / first-plan / primary-teacher), optional "next class" dark hero,
 * the "De un vistazo" stat ledger (4 doorways), the "Tus próximas clases"
 * list (+ empty state), and the "Accesos rápidos" column. The dashboard
 * LAYOUT chrome (sidebar nav + locale toggle + sign-out) is also part of this
 * surface and is exercised here.
 *
 * Runs against LIVE (PLAYWRIGHT_BASE_URL=https://englishkolab.com). This surface
 * is READ-ONLY — it renders pre-fetched server data and links elsewhere; NO
 * probe in this file mutates live data. We reuse the saved student session
 * (STATE.student) so we never log in (no rate-limit contention).
 *
 * Selectors + Spanish/English label text were extracted verbatim from:
 *   src/app/[lang]/dashboard/page.tsx
 *   src/app/[lang]/dashboard/StudentDashboardClient.tsx
 *   src/app/[lang]/dashboard/layout.tsx
 *   src/components/dashboard/Sidebar.tsx
 *   src/components/ui/{DashTopBar,StatLedger,StatusBadge}.tsx
 *   src/components/JoinSessionButton.tsx
 *
 * NOT serial — these probes EXPECT some failures (each failure = a finding);
 * serial mode would abort the whole block on the first one.
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, hasAuthCookie } from './_exhaustive/helpers'

// Reuse the saved authenticated student session for EVERY test in this file.
test.use({ storageState: STATE.student })

// ─────────────────────────── shared expectations ───────────────────────────
// Exact strings the page MUST render (source-of-truth from the components above).
const GREETINGS_ES = /buenos días|buenas tardes|buenas noches/i
const GREETINGS_EN = /good morning|good afternoon|good evening/i
const STAT_KICKERS_ES = ['Disponibles', 'Agendadas', 'Completadas', 'Tiempo total']
const STAT_KICKERS_EN = ['Available', 'Scheduled', 'Completed', 'Total time']
// Sidebar nav labels (studentNav in Sidebar.tsx).
const NAV_ES = ['Inicio', 'Mis clases', 'Agendar', 'Tareas', 'Biblioteca', 'Mi maestro', 'Mi progreso', 'Mi plan', 'Configuración']
const NAV_EN = ['Home', 'My classes', 'Schedule', 'Homework', 'Library', 'My teacher', 'My progress', 'My plan', 'Settings']

// Wait for the dashboard to be the *rendered* page (not a mid-redirect frame).
// Greeting top-bar title is unique to this surface.
async function expectDashboardRendered(page: Page, lang: 'es' | 'en' = 'es') {
  await expect(
    page.getByRole('heading', { name: lang === 'es' ? /^Hola,/i : /^Hi,/i }),
  ).toBeVisible({ timeout: 20_000 })
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
    // Ignore third-party noise (analytics, fonts, livekit pings) — focus on our origin.
    if (r.status() >= 400 && /englishkolab\.com/.test(u) && !/\/sala\//.test(u)) {
      badResponses.push(`${r.status()} ${r.request().method()} ${u}`)
    }
  })
  return { consoleErrors, badResponses, pageErrors }
}

test.describe('EXHAUSTIVE STUDENT-HOME (/es/dashboard)', () => {
  // ───────────────────────── 1 · Happy-path render ─────────────────────────

  test('1a — ES dashboard renders greeting, classes counter, Agendar CTA', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')

    // Greeting flourish (time-of-day word).
    const heading = page.getByRole('heading', { name: /^Hola,/i })
    const headingText = (await heading.innerText()).toLowerCase()
    test.info().annotations.push({ type: 'observed', description: `greeting heading = "${headingText}"` })
    expect(GREETINGS_ES.test(headingText), 'greeting word must be Spanish').toBeTruthy()

    // "N clases disponibles" counter in the top-bar right slot.
    await expect(page.getByText(/clases disponibles/i).first()).toBeVisible()
    // The schedule CTA.
    const addCta = page.getByRole('link', { name: /\+ Agendar clase/i })
    await expect(addCta).toBeVisible()
    expect(await addCta.getAttribute('href')).toMatch(/\/es\/dashboard\/agendar$/)

    await page.screenshot({ path: 'test-results/exhaustive-student-home-1a-render.png', fullPage: true })
  })

  test('1b — the "De un vistazo" stat ledger shows all four stats as doorways', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')

    await expect(page.getByText(/De un vistazo/i)).toBeVisible()
    for (const k of STAT_KICKERS_ES) {
      await expect(page.locator('.lk-stat-kicker', { hasText: k })).toBeVisible()
    }
    // Each stat is a <Link className="lk-stat"> → 4 doorways to plan/clases/progreso/progreso.
    const doorways = page.locator('a.lk-stat')
    await expect(doorways).toHaveCount(4)
    const hrefs = await doorways.evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href')))
    test.info().annotations.push({ type: 'observed', description: `stat doorways → ${hrefs.join(', ')}` })
    expect(hrefs[0]).toMatch(/\/es\/dashboard\/plan$/)
    expect(hrefs[1]).toMatch(/\/es\/dashboard\/clases$/)
    expect(hrefs[2]).toMatch(/\/es\/dashboard\/progreso$/)
    expect(hrefs[3]).toMatch(/\/es\/dashboard\/progreso$/)
  })

  test('1c — upcoming-classes panel renders (list OR empty state, never both)', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')

    // The panel header always renders.
    await expect(page.getByRole('heading', { name: /Tus próximas clases/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Ver todas/i })).toBeVisible()

    const emptyMsg = page.getByText(/No tienes clases agendadas\./i)
    const hasEmpty = (await emptyMsg.count()) > 0
    test.info().annotations.push({ type: 'observed', description: `upcoming list empty-state shown = ${hasEmpty}` })
    if (hasEmpty) {
      // Empty state offers a "Agendar clase →" CTA.
      await expect(page.getByRole('link', { name: /Agendar clase/i }).last()).toBeVisible()
    } else {
      // Non-empty: at least one booking row carries a status badge (ES label).
      await expect(
        page.getByText(/Confirmada|Pendiente|Asignando|En vivo/i).first(),
      ).toBeVisible()
    }
  })

  test('1d — "Accesos rápidos" quick-action column links resolve to real routes', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')

    await expect(page.getByText(/Accesos rápidos/i)).toBeVisible()
    // "Agendar otra clase" + "Mi progreso" always render; placement action is conditional.
    const book = page.getByRole('link', { name: /Agendar otra clase/i })
    const progress = page.getByRole('link', { name: /Mi progreso/i }).last()
    await expect(book).toBeVisible()
    await expect(progress).toBeVisible()
    expect(await book.getAttribute('href')).toMatch(/\/es\/dashboard\/agendar$/)
    expect(await progress.getAttribute('href')).toMatch(/\/es\/dashboard\/progreso$/)
  })

  // ───────────────────────── 2 · Entry / nav / refresh / deep-link ─────────────────────────

  test('2a — deep-link straight to /es/dashboard renders without bouncing to login', async ({ page, context }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    // Authenticated → must NOT be on the login form.
    expect(await page.locator('input[name="password"]').count(), 'should not be sent to login').toBe(0)
    await expectDashboardRendered(page, 'es')
    expect(hasAuthCookie(await context.cookies()), 'session cookie present').toBeTruthy()
  })

  test('2b — a hard refresh re-renders the same dashboard (no flash to login / blank)', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')
    await page.reload()
    await settle(page)
    await expectDashboardRendered(page, 'es')
    expect(await page.locator('input[name="password"]').count()).toBe(0)
  })

  test('2c — every sidebar nav item is present and points at a real /es/dashboard route', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')

    const missing: string[] = []
    for (const label of NAV_ES) {
      // Sidebar links are exact-match labels; scope to <nav> via role link.
      const link = page.getByRole('link', { name: label, exact: true }).first()
      if ((await link.count()) === 0) { missing.push(label); continue }
      const href = await link.getAttribute('href')
      if (!href || !/^\/es\/dashboard(\/|$)/.test(href)) missing.push(`${label}→${href}`)
    }
    test.info().annotations.push({ type: 'observed', description: `nav check; missing/bad = ${missing.join(', ') || 'none'}` })
    expect(missing, 'all student nav items render & target /es/dashboard/*').toEqual([])
  })

  test('2d — clicking a nav item actually navigates to that section (Mi plan)', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')
    await page.getByRole('link', { name: 'Mi plan', exact: true }).first().click()
    await page.waitForURL(/\/es\/dashboard\/plan(\/|$)/, { timeout: 20_000 }).catch(() => {})
    await settle(page)
    // Prove by CONTENT we left the home greeting (not just by URL).
    expect(page.url()).toMatch(/\/es\/dashboard\/plan/)
    await expect(page.getByRole('heading', { name: /^Hola,/i })).toHaveCount(0)
  })

  test('2e — the "Agendar" top-bar CTA navigates to the booking flow', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')
    await page.getByRole('link', { name: /\+ Agendar clase/i }).click()
    await page.waitForURL(/\/es\/dashboard\/agendar(\/|$)/, { timeout: 20_000 }).catch(() => {})
    expect(page.url()).toMatch(/\/es\/dashboard\/agendar/)
  })

  // ───────────────────────── 5 · Security / role guard ─────────────────────────
  // The dashboard layout (layout.tsx) reads profiles.role and redirects
  // teacher → /maestro/dashboard, admin → /admin. Prove a non-student session
  // hitting /es/dashboard is bounced and NEVER sees the student greeting.

  test('5a — a TEACHER session hitting /es/dashboard is bounced to the teacher app', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    try {
      await page.goto('/es/dashboard')
      await settle(page)
      await page.waitForTimeout(2500) // let the layout redirect resolve
      // Content is the source of truth: must NOT render the student greeting.
      await expect(page.getByRole('heading', { name: /^Hola,/i })).toHaveCount(0)
      test.info().annotations.push({ type: 'SECURITY', description: `teacher@ on /es/dashboard landed at ${page.url()}` })
      // Positive proof they reached their own area.
      expect(page.url()).toMatch(/\/maestro\/dashboard|\/maestro\/pending/)
    } finally {
      await ctx.close()
    }
  })

  test('5b — an ADMIN session hitting /es/dashboard is bounced to /admin', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.admin })
    const page = await ctx.newPage()
    try {
      await page.goto('/es/dashboard')
      await settle(page)
      await page.waitForTimeout(2500)
      await expect(page.getByRole('heading', { name: /^Hola,/i })).toHaveCount(0)
      test.info().annotations.push({ type: 'SECURITY', description: `admin@ on /es/dashboard landed at ${page.url()}` })
      expect(page.url()).toMatch(/\/admin(\/|$)/)
    } finally {
      await ctx.close()
    }
  })

  test('5c — a LOGGED-OUT visitor to /es/dashboard is redirected to login (no leak)', async ({ browser }) => {
    // Fresh context with NO storageState → unauthenticated.
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    try {
      await page.goto('/es/dashboard')
      await settle(page)
      await page.waitForTimeout(2000)
      // Must end on the login form, and must not render the dashboard greeting.
      await expect(page.getByRole('heading', { name: /^Hola,/i })).toHaveCount(0)
      const onLogin = await page.locator('input[name="password"]').count()
      test.info().annotations.push({ type: 'observed', description: `anon → ${page.url()} ; login-form=${onLogin > 0}` })
      expect(onLogin, 'anonymous user must be sent to the login form').toBeGreaterThan(0)
    } finally {
      await ctx.close()
    }
  })

  // ───────────────────────── 3 · Input / param robustness ─────────────────────────
  // /es/dashboard takes no input fields and no :id route param (no IDOR vector).
  // The only attacker-controllable input is the query string + locale segment.

  test('3a — junk/SQLi/XSS query params are inert (no crash, no script exec, no 5xx)', async ({ page }) => {
    const { badResponses, pageErrors } = watch(page)
    let dialog = false
    page.on('dialog', (d) => { dialog = true; d.dismiss().catch(() => {}) })
    const qs = `?q=' OR 1=1--&x=<script>alert(1)</script>&n=${'A'.repeat(5000)}&u=%F0%9F%98%80`
    await page.goto(`/es/dashboard${qs}`)
    await settle(page)
    await expectDashboardRendered(page, 'es')
    expect(dialog, 'no XSS dialog from reflected query').toBeFalsy()
    // The literal script tag must not be live markup.
    expect(await page.locator('script:has-text("alert(1)")').count()).toBe(0)
    test.info().annotations.push({ type: 'observed', description: `junk-qs: 4xx5xx=[${badResponses.join('; ')}] pageErrors=[${pageErrors.join('; ')}]` })
    expect(pageErrors, 'no uncaught page errors on junk query').toEqual([])
  })

  test('3b — an unknown locale segment (/xx/dashboard) does not render the student dashboard', async ({ page }) => {
    await page.goto('/xx/dashboard')
    await settle(page)
    // proxy.ts only serves es|en. An unknown locale must NOT yield a working student home.
    const greetingShown = await page.getByRole('heading', { name: /^Hola,|^Hi,/i }).count()
    test.info().annotations.push({ type: 'observed', description: `/xx/dashboard → ${page.url()} ; greeting=${greetingShown > 0}` })
    expect(greetingShown, 'unknown locale must not render the dashboard greeting').toBe(0)
  })

  // ───────────────────────── 7 · i18n parity (ES + EN) ─────────────────────────

  test('7a — EN dashboard renders fully English greeting, stats, nav (no leaked ES)', async ({ page }) => {
    await page.goto('/en/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'en')

    const heading = (await page.getByRole('heading', { name: /^Hi,/i }).innerText()).toLowerCase()
    expect(GREETINGS_EN.test(heading), 'EN greeting word must be English').toBeTruthy()
    expect(GREETINGS_ES.test(heading), 'EN page must not leak a Spanish greeting').toBeFalsy()

    // "classes available", "At a glance", English stat kickers.
    await expect(page.getByText(/classes available/i).first()).toBeVisible()
    await expect(page.getByText(/At a glance/i)).toBeVisible()
    for (const k of STAT_KICKERS_EN) {
      await expect(page.locator('.lk-stat-kicker', { hasText: k })).toBeVisible()
    }
    // EN nav labels present.
    const missing: string[] = []
    for (const label of NAV_EN) {
      if ((await page.getByRole('link', { name: label, exact: true }).count()) === 0) missing.push(label)
    }
    test.info().annotations.push({ type: 'observed', description: `EN nav missing = ${missing.join(', ') || 'none'}` })
    expect(missing, 'EN sidebar nav fully translated').toEqual([])
    await page.screenshot({ path: 'test-results/exhaustive-student-home-7a-en.png', fullPage: true })
  })

  test('7b — the sidebar locale toggle is offered and labelled per-locale', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')
    // On the ES page the toggle offers English.
    await expect(page.getByRole('button', { name: /Switch to English/i })).toBeVisible()
    // The Spanish-side label "Cambiar a Español" must NOT appear on the ES page.
    expect(await page.getByText(/Cambiar a Español/i).count(), 'ES page should not show the "switch to Spanish" label').toBe(0)
  })

  test('7c — clicking the locale toggle actually flips the page to English', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')
    await page.getByRole('button', { name: /Switch to English/i }).click()
    await page.waitForURL(/\/en\/dashboard(\/|$)/, { timeout: 20_000 }).catch(() => {})
    await settle(page)
    await expectDashboardRendered(page, 'en')
    // Prove the body localized: English "At a glance", no Spanish "De un vistazo".
    await expect(page.getByText(/At a glance/i)).toBeVisible()
    expect(await page.getByText(/De un vistazo/i).count(), 'after switch, ES microlabel must be gone').toBe(0)
  })

  // ───────────────────────── 8 · Responsive ─────────────────────────

  test('8a — 375px mobile: hamburger replaces sidebar, opens nav drawer, content fits', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')

    // Desktop sidebar nav links are display:none on mobile; the hamburger button drives nav.
    const hamburger = page.getByRole('button', { name: /Open menu|Close menu/i })
    await expect(hamburger).toBeVisible()
    await hamburger.click()
    await page.waitForTimeout(500) // drawer spring animation
    // Drawer reveals the student nav.
    await expect(page.getByRole('link', { name: 'Mis clases', exact: true }).first()).toBeVisible()

    // Top-bar CTA must not overflow horizontally.
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    test.info().annotations.push({ type: 'observed', description: `375px scrollWidth=${scrollW} (viewport=375)` })
    expect(scrollW, 'no horizontal overflow at 375px').toBeLessThanOrEqual(375 + 2)
    await page.screenshot({ path: 'test-results/exhaustive-student-home-8a-mobile.png', fullPage: true })
  })

  test('8b — desktop 1280px: stat ledger lays out as four columns', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')
    // All four stat doorways visible side-by-side (not collapsed).
    await expect(page.locator('a.lk-stat')).toHaveCount(4)
    const tops = await page.locator('a.lk-stat').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    test.info().annotations.push({ type: 'observed', description: `stat row tops (desktop) = ${tops.join(', ')}` })
    // On a single 4-col row, all four share the same top (allow 2px jitter).
    expect(Math.max(...tops) - Math.min(...tops), 'four stats on one row at 1280px').toBeLessThanOrEqual(2)
  })

  // ───────────────────────── 9 · Console errors + network ─────────────────────────

  test('9a — no console errors, page errors, or 4xx/5xx on first paint', async ({ page }) => {
    const { consoleErrors, badResponses, pageErrors } = watch(page)
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')
    await page.waitForTimeout(1500) // catch late async errors (the once-a-minute tick mounts here)

    // Filter known-benign console noise (favicon/font 404s on other CDNs are excluded by watch()).
    const realConsole = consoleErrors.filter((e) => !/Download the React DevTools|hydration/i.test(e))
    test.info().annotations.push({ type: 'observed', description: `console=[${realConsole.join(' | ')}]` })
    test.info().annotations.push({ type: 'observed', description: `pageErrors=[${pageErrors.join(' | ')}]` })
    test.info().annotations.push({ type: 'observed', description: `bad-network=[${badResponses.join(' | ')}]` })

    expect(pageErrors, 'no uncaught exceptions on the dashboard').toEqual([])
    expect(badResponses, 'no 4xx/5xx from our origin on the dashboard').toEqual([])
    expect(realConsole, 'no console errors on the dashboard').toEqual([])
  })

  // ───────────────────────── 10 · Data integrity ─────────────────────────

  test('10a — top-bar "classes available" counter agrees with the "Disponibles" ledger stat', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')

    // Top-bar counter: the accent number immediately before "clases disponibles".
    const topBarText = await page.locator('header, [class*="DashTopBar"], div').filter({ hasText: /clases disponibles/i }).first().innerText().catch(() => '')
    const topNum = (topBarText.match(/(\d+)\s*clases disponibles/i) || [])[1]

    // Ledger "Disponibles" value is the first .lk-stat-value (accent stat).
    const ledgerVal = (await page.locator('a.lk-stat').first().locator('.lk-stat-value').innerText()).trim()

    test.info().annotations.push({ type: 'observed', description: `topbar counter="${topNum}" vs ledger Disponibles="${ledgerVal}"` })
    // Both come from the same `classesRemaining` prop — they MUST match.
    expect(ledgerVal, 'top-bar counter and ledger Disponibles must reflect the same classesRemaining').toBe(topNum)
  })

  test('10b — "Completadas" and "Tiempo total" are mutually consistent (total time = completed h)', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')
    // Stats array order: [Disponibles, Agendadas, Completadas, Tiempo total].
    const values = await page.locator('a.lk-stat .lk-stat-value').evaluateAll((els) => els.map((e) => (e.textContent || '').trim()))
    test.info().annotations.push({ type: 'observed', description: `ledger values = ${values.join(' | ')}` })
    const completed = values[2]
    const totalTime = values[3]
    // Component renders totalTime as `${completedSessions}h` — must equal "<completed>h".
    expect(totalTime, '"Tiempo total" is derived as `${completed}h`').toBe(`${completed}h`)
  })

  // ───────────────────────── 4 · Failure / stale-session state ─────────────────────────

  test('4a — a corrupted auth cookie does not render a broken half-dashboard', async ({ browser }) => {
    // Tamper the saved student session: garble the auth-token cookie value.
    const ctx = await browser.newContext({ storageState: STATE.student })
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
      await page.goto('/es/dashboard')
      await settle(page)
      await page.waitForTimeout(1500)
      // Either bounced to login OR a clean render — but NEVER a partial dashboard
      // with a broken/blank greeting. We assert it does not leak a half-rendered shell.
      const greeting = await page.getByRole('heading', { name: /^Hola,/i }).count()
      const onLogin = await page.locator('input[name="password"]').count()
      test.info().annotations.push({ type: 'observed', description: `tampered-cookie → ${page.url()} ; greeting=${greeting} login=${onLogin}` })
      // Expectation: invalid session → login form, not a stuck dashboard.
      expect(onLogin > 0 || greeting === 0, 'invalid session should go to login, not a broken dashboard').toBeTruthy()
    } finally {
      await ctx.close()
    }
  })

  // ───────────────────────── 6 · Sign-out / session control ─────────────────────────

  test('6a — sign-out from the dashboard clears the session (revisiting bounces to login)', async ({ browser }) => {
    // Isolated context so we don't disturb the shared STATE.student file for other specs.
    const ctx = await browser.newContext({ storageState: STATE.student })
    const page = await ctx.newPage()
    try {
      await page.goto('/es/dashboard')
      await settle(page)
      await expectDashboardRendered(page, 'es')
      await page.getByRole('button', { name: /Cerrar sesión/i }).click()
      await page.waitForURL(/\/es\/(login|$)|\/es$/, { timeout: 20_000 }).catch(() => {})
      await settle(page)
      // Now revisit the dashboard — should be denied (login form), not rendered.
      await page.goto('/es/dashboard')
      await settle(page)
      await page.waitForTimeout(1500)
      const greeting = await page.getByRole('heading', { name: /^Hola,/i }).count()
      const onLogin = await page.locator('input[name="password"]').count()
      test.info().annotations.push({ type: 'observed', description: `after sign-out, /es/dashboard → ${page.url()} ; greeting=${greeting} login=${onLogin}` })
      expect(greeting, 'signed-out user must not see the dashboard greeting').toBe(0)
      expect(onLogin, 'signed-out user should land on the login form').toBeGreaterThan(0)
    } finally {
      await ctx.close()
    }
  })

  // ───────────────────────── 2(f) · Help/contact link integrity ─────────────────────────

  test('2f — sidebar "Ayuda y contacto" is a working mailto to hola@englishkolab.com', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    await expectDashboardRendered(page, 'es')
    const help = page.getByRole('link', { name: /Ayuda y contacto/i }).first()
    await expect(help).toBeVisible()
    const href = await help.getAttribute('href')
    test.info().annotations.push({ type: 'observed', description: `help link href = ${href}` })
    expect(href, 'help link should be a mailto to the support inbox').toMatch(/^mailto:hola@englishkolab\.com$/)
  })
})
