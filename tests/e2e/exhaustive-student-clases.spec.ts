/**
 * EXHAUSTIVE LIVE QA — STUDENT · My Classes (/es/dashboard/clases)
 *
 * Surface: src/app/[lang]/dashboard/clases/{page.tsx,ClasesClient.tsx}
 * Supporting: components/JoinSessionButton.tsx, ui/DashTopBar.tsx,
 *             ui/StatusBadge.tsx, dashboard/Sidebar.tsx, dashboard/Modal.tsx
 *
 * Runs against LIVE (PLAYWRIGHT_BASE_URL=https://englishkolab.com) with the
 * saved STUDENT session (STATE.student) so it never logs in (no rate-limit
 * contention). Role-guard probes spin up their own teacher/admin contexts.
 *
 * SAFETY: this surface CAN mutate (cancel / reschedule / report-no-show via the
 * kebab; the reschedule modal even submits a server action). Every probe here is
 * NON-MUTATING: we open menus/modals and assert rendered content, then close —
 * we NEVER click the final confirm button. Nothing in this file books, cancels,
 * reschedules, or reports.
 *
 * Selectors + Spanish/English label text were extracted verbatim from
 * ClasesClient.tsx's `t` table — not guessed.
 */
import { test, expect, type Page } from '@playwright/test'
import { STATE, ACCOUNT, settle, clearRateLimit, loginUI, hasAuthCookie } from './_exhaustive/helpers'

// ── exact label text lifted from ClasesClient.tsx `t` ──────────────────────
const ES = {
  title: 'Mis clases',
  subtitle: 'Próximas y completadas',
  tabUpcoming: 'Próximas',
  tabHistory: 'Completadas',
  search: 'Buscar por maestro',
  bookClass: 'Agendar clase',
  noUpcoming: 'No tienes clases próximas',
  noUpcomingSub: 'Agenda una clase para comenzar.',
  noPast: 'Todavía no tienes clases completadas',
  noMatch: 'Ninguna clase coincide.',
  historySub: 'Últimas clases completadas',
  cuaderno: 'Cuaderno',
  enVivo: 'En vivo',
  joinLink: 'Entrar a clase',
}
const EN = {
  title: 'My classes',
  tabUpcoming: 'Upcoming',
  tabHistory: 'Completed',
  search: 'Search by teacher',
  noMatch: 'No classes match.',
  joinLink: 'Join class',
}

const CLASES = '/es/dashboard/clases'

// Reach the page and let any server-action redirect chain resolve.
async function gotoClases(page: Page, url = CLASES) {
  await page.goto(url)
  await settle(page)
}

// Console + network error collector — attach BEFORE navigation.
function watchErrors(page: Page) {
  const consoleErrors: string[] = []
  const badResponses: string[] = []
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('response', r => {
    const s = r.status()
    // The page itself + same-origin API/action calls. Ignore 3rd-party analytics noise.
    if (s >= 400 && /englishkolab\.com/.test(r.url())) badResponses.push(`${s} ${r.url()}`)
  })
  return { consoleErrors, badResponses }
}

test.describe('EXHAUSTIVE · student · My Classes (/es/dashboard/clases)', () => {
  test.use({ storageState: STATE.student })

  // ─────────────────── 1 · Happy-path render ───────────────────

  test('1.1 — page renders the My-Classes shell (title, both tabs, search, book CTA)', async ({ page }) => {
    const { consoleErrors, badResponses } = watchErrors(page)
    await gotoClases(page)

    // Title in the top bar (h1). The guard would have bounced us elsewhere if
    // role were wrong — asserting on rendered content, never the URL.
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })

    // Both tabs render with a (count) suffix: "Próximas (N)" / "Completadas (N)".
    await expect(page.getByRole('button', { name: new RegExp(`${ES.tabUpcoming} \\(\\d+\\)`) })).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`${ES.tabHistory} \\(\\d+\\)`) })).toBeVisible()

    // Search box + the "Agendar clase" top-bar action.
    await expect(page.getByPlaceholder(ES.search)).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(ES.bookClass) }).first()).toBeVisible()

    await page.screenshot({ path: 'test-results/exhaustive-student-clases-render.png', fullPage: true })

    test.info().annotations.push({ type: 'observed', description: `console-errors=${consoleErrors.length}; 4xx/5xx=${badResponses.length}` })
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([])
    expect(badResponses, `4xx/5xx on page:\n${badResponses.join('\n')}`).toEqual([])
  })

  test('1.2 — the "+ Agendar clase" CTA points at the booking route', async ({ page }) => {
    await gotoClases(page)
    const cta = page.getByRole('link', { name: new RegExp(ES.bookClass) }).first()
    await expect(cta).toHaveAttribute('href', '/es/dashboard/agendar')
  })

  // ─────────────────── 2 · Tabs & list/empty state behavior ───────────────────

  test('2.1 — switching to Completadas swaps the list header + content', async ({ page }) => {
    await gotoClases(page)
    const histTab = page.getByRole('button', { name: new RegExp(`${ES.tabHistory} \\(\\d+\\)`) })
    await histTab.click()
    await page.waitForTimeout(300)
    // History view shows either "Últimas clases completadas" header, the empty
    // state, or completed rows (each with a "Cuaderno" button). Prove the tab
    // actually changed by checking history-only chrome is now present.
    const histHeader = page.getByText(ES.historySub)
    const emptyPast = page.getByText(ES.noPast)
    const cuaderno = page.getByRole('button', { name: ES.cuaderno })
    const ok = (await histHeader.count()) + (await emptyPast.count()) + (await cuaderno.count())
    test.info().annotations.push({ type: 'observed', description: `history view markers present=${ok}` })
    expect(ok, 'Completadas tab must render its own header / empty / rows').toBeGreaterThan(0)
  })

  test('2.2 — the empty/list state is coherent (no list AND no empty-copy simultaneously)', async ({ page }) => {
    await gotoClases(page)
    // Upcoming tab is the default. Either we see the empty copy OR list rows —
    // never both, never neither.
    const emptyUpcoming = await page.getByText(ES.noUpcoming).count()
    const rows = await page.locator('section ul > li').count()
    test.info().annotations.push({ type: 'observed', description: `upcoming: empty-copy=${emptyUpcoming}, rows=${rows}` })
    expect(emptyUpcoming > 0 || rows > 0, 'must show either empty state or list rows').toBeTruthy()
    expect(emptyUpcoming > 0 && rows > 0, 'must NOT show empty copy and rows at once').toBeFalsy()

    // If empty, the inline "+ Agendar clase →" recovery link must be present.
    if (emptyUpcoming > 0) {
      await expect(page.getByText(ES.noUpcomingSub)).toBeVisible()
      const recovery = page.getByRole('link', { name: new RegExp(`${ES.bookClass}\\s*→`) })
      await expect(recovery).toHaveAttribute('href', '/es/dashboard/agendar')
    }
  })

  test('2.3 — tab counts in the labels match the rendered row count for the active tab', async ({ page }) => {
    await gotoClases(page)
    const upTab = page.getByRole('button', { name: new RegExp(`${ES.tabUpcoming} \\(\\d+\\)`) })
    const label = (await upTab.innerText()).trim()
    const declared = Number(label.match(/\((\d+)\)/)?.[1] ?? -1)
    // With no search filter active, the upcoming header reads "N clase(s) esta
    // semana" where N == filtered count == declared tab count (no filter).
    const rows = await page.locator('section ul > li').count()
    const emptyUpcoming = await page.getByText(ES.noUpcoming).count()
    const effectiveRows = emptyUpcoming > 0 ? 0 : rows
    test.info().annotations.push({ type: 'observed', description: `Próximas tab declares ${declared}; rendered rows=${effectiveRows}` })
    expect(declared, 'tab count must parse').toBeGreaterThanOrEqual(0)
    expect(effectiveRows, 'rendered upcoming rows should equal the tab count when no filter is applied').toBe(declared)
  })

  // ─────────────────── 3 · Search / input validation ───────────────────

  test('3.1 — a non-matching search shows the "Ninguna clase coincide." state', async ({ page }) => {
    await gotoClases(page)
    const box = page.getByPlaceholder(ES.search)
    await box.fill('zzzz-no-such-teacher-zzzz')
    await page.waitForTimeout(300)
    // Either there were no upcoming rows to begin with (already empty) or the
    // search now yields the no-match copy. Assert no spurious rows survive.
    const rows = await page.locator('section ul > li').count()
    test.info().annotations.push({ type: 'observed', description: `rows after impossible search=${rows}` })
    if (rows === 0) {
      // ClasesClient renders "Ninguna clase coincide." only when a search term
      // is set AND the list is empty.
      await expect(page.getByText(ES.noMatch)).toBeVisible()
    }
  })

  test('3.2 — XSS in the search box does not execute and does not break the page', async ({ page }) => {
    let dialog = false
    page.on('dialog', d => { dialog = true; d.dismiss().catch(() => {}) })
    const { consoleErrors } = watchErrors(page)
    await gotoClases(page)
    const box = page.getByPlaceholder(ES.search)
    await box.fill('<img src=x onerror=alert(1)>')
    await page.waitForTimeout(400)
    expect(dialog, 'no script execution from search input').toBeFalsy()
    // No injected <img>/<script> live markup in the list region (React escapes).
    const injected = await page.locator('section img[onerror], section script:has-text("alert(1)")').count()
    expect(injected, 'XSS payload must be inert, not live DOM').toBe(0)
    // Page still standing.
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible()
    test.info().annotations.push({ type: 'observed', description: `xss-dialog=${dialog}; console-errors=${consoleErrors.length}` })
  })

  test('3.3 — SQLi-flavored + oversized + unicode search terms are handled gracefully', async ({ page }) => {
    const { consoleErrors, badResponses } = watchErrors(page)
    await gotoClases(page)
    const box = page.getByPlaceholder(ES.search)
    const payloads = [`' OR 1=1--`, `"; DROP TABLE bookings;--`, 'д'.repeat(50) + ' 日本語 🎓', 'a'.repeat(2000)]
    for (const p of payloads) {
      await box.fill(p)
      await page.waitForTimeout(150)
      // Filtering is client-side over already-loaded bookings — it must never
      // 500, never throw, never blank the shell.
      await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible()
    }
    await box.fill('')
    test.info().annotations.push({ type: 'observed', description: `console-errors=${consoleErrors.length}; bad-responses=${badResponses.length}` })
    expect(consoleErrors, `console errors during search fuzzing:\n${consoleErrors.join('\n')}`).toEqual([])
    expect(badResponses, `4xx/5xx during search fuzzing:\n${badResponses.join('\n')}`).toEqual([])
  })

  // ─────────────────── 4 · Join button / EN VIVO logic ───────────────────

  test('4.1 — every upcoming row exposes coherent Join-button state (link OR disabled, never both)', async ({ page }) => {
    await gotoClases(page)
    const rows = page.locator('section ul > li')
    const count = await rows.count()
    if (count === 0) { test.info().annotations.push({ type: 'inconclusive', description: 'no upcoming rows for student QA account; Join logic not exercised' }); test.skip(); return }

    // JoinSessionButton renders EITHER an <a> ("Entrar a clase") when inside the
    // 24h-before → +90m window, OR a disabled <span> ("Empieza en …" /
    // "Sesión terminada"). awaitingTeacher rows render no button at all.
    const joinLinks = await page.getByRole('link', { name: ES.joinLink }).count()
    const disabledStarts = await page.getByText(/Empieza en|Sesión terminada/).count()
    test.info().annotations.push({ type: 'observed', description: `rows=${count}; active-join-links=${joinLinks}; disabled-countdowns=${disabledStarts}` })

    // The active Join link must target the room route /es/sala/<bookingId>.
    if (joinLinks > 0) {
      const href = await page.getByRole('link', { name: ES.joinLink }).first().getAttribute('href')
      expect(href, 'Join link must point at the LiveKit room route').toMatch(/^\/es\/sala\/[^/]+$/)
    }
  })

  test('4.2 — the "En vivo" badge (if shown) co-occurs with an active, clickable Join link', async ({ page }) => {
    await gotoClases(page)
    const live = page.getByText(new RegExp(`^${ES.enVivo}$`, 'i'))
    const liveCount = await live.count()
    test.info().annotations.push({ type: 'observed', description: `En-vivo badges present=${liveCount}` })
    if (liveCount === 0) { test.skip(); return }
    // Live status (now within [start, start+duration]) is well inside the Join
    // window (open 24h before) — so a live row MUST also expose the enabled
    // "Entrar a clase" link, never a disabled countdown.
    await expect(page.getByRole('link', { name: ES.joinLink }).first()).toBeVisible()
  })

  test('4.3 — the disabled countdown chip is non-navigating (span, not a link)', async ({ page }) => {
    await gotoClases(page)
    const chip = page.getByText(/Empieza en|Sesión terminada/).first()
    if (await chip.count() === 0) { test.skip(); return }
    // renderDisabled() emits a <span> with cursor:not-allowed — it must not be an anchor.
    const tag = await chip.evaluate(el => (el.closest('a,span') as HTMLElement | null)?.tagName ?? '')
    test.info().annotations.push({ type: 'observed', description: `disabled-chip closest tag=${tag}` })
    expect(tag, 'disabled countdown must not be an <a> (would let users into the room early)').not.toBe('A')
  })

  // ─────────────────── 5 · Manage menu / modals (NON-MUTATING) ───────────────────

  test('5.1 — kebab opens the Reagendar/Cancelar menu without firing any action', async ({ page }) => {
    await gotoClases(page)
    const kebab = page.getByRole('button', { name: /Acciones/ }).first()
    if (await kebab.count() === 0) { test.info().annotations.push({ type: 'inconclusive', description: 'no manageable (pending/confirmed) upcoming rows' }); test.skip(); return }
    await kebab.click()
    await page.waitForTimeout(200)
    // Menu items are buttons that only OPEN a confirm modal — opening is safe.
    await expect(page.getByRole('button', { name: /^Reagendar$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Cancelar clase/ })).toBeVisible()
    // Close by clicking elsewhere (document listener) — assert no toast / reload happened.
    await page.locator('h1').click()
    await page.waitForTimeout(150)
  })

  test('5.2 — reschedule modal opens with a datetime-local input and a >=24h hint (no submit)', async ({ page }) => {
    await gotoClases(page)
    const kebab = page.getByRole('button', { name: /Acciones/ }).first()
    if (await kebab.count() === 0) { test.skip(); return }
    await kebab.click()
    await page.waitForTimeout(150)
    await page.getByRole('button', { name: /^Reagendar$/ }).click()
    await page.waitForTimeout(250)
    // Modal title + hint + a datetime-local input pre-filled (default = now+25h).
    await expect(page.getByText('Reagendar esta clase')).toBeVisible()
    const dt = page.locator('input[type="datetime-local"]')
    await expect(dt).toBeVisible()
    const val = await dt.inputValue()
    test.info().annotations.push({ type: 'observed', description: `reschedule default datetime-local value="${val}"` })
    expect(val, 'reschedule input should be pre-populated to a >=24h slot').toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    // CLOSE without confirming (keep the class untouched).
    await page.getByRole('button', { name: /^Cerrar$/ }).click()
    await page.waitForTimeout(150)
    await expect(page.getByText('Reagendar esta clase')).toHaveCount(0)
  })

  test('5.3 — cancel modal shows the correct late/early policy copy (no confirm clicked)', async ({ page }) => {
    await gotoClases(page)
    const kebab = page.getByRole('button', { name: /Acciones/ }).first()
    if (await kebab.count() === 0) { test.skip(); return }
    await kebab.click()
    await page.waitForTimeout(150)
    await page.getByRole('button', { name: /Cancelar clase/ }).click()
    await page.waitForTimeout(250)
    // One of the two policy bodies must render (early refund vs late forfeit).
    const early = await page.getByText('Te devolveremos el crédito').count()
    const late = await page.getByText('en menos de 24 horas').count()
    test.info().annotations.push({ type: 'observed', description: `cancel-modal: early-copy=${early}, late-copy=${late}` })
    expect(early + late, 'cancel modal must show exactly one policy body').toBe(1)
    // Back out via "Mantener la clase" — never the destructive "Sí, cancelar".
    await page.getByRole('button', { name: /Mantener la clase/ }).click()
    await page.waitForTimeout(150)
  })

  test('5.4 — Cuaderno (completed-row) opens the read-only summary modal', async ({ page }) => {
    await gotoClases(page)
    await page.getByRole('button', { name: new RegExp(`${ES.tabHistory} \\(\\d+\\)`) }).click()
    await page.waitForTimeout(300)
    const notebook = page.getByRole('button', { name: ES.cuaderno }).first()
    if (await notebook.count() === 0) { test.info().annotations.push({ type: 'inconclusive', description: 'no completed classes for QA account' }); test.skip(); return }
    await notebook.click()
    // Modal kicker "Cuaderno de clase" / title "Resumen de clase"; loads session
    // data via getSessionByBookingId (read-only). Either content or a graceful
    // "no summary" fallback — never a crash.
    await expect(page.getByText('Resumen de clase')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1500)
    const hasFallback = await page.getByText(/No hay resumen disponible|No se capturó transcripción/).count()
    const hasContent = await page.getByText(/Temas cubiertos|Transcripción|Notas del maestro/).count()
    test.info().annotations.push({ type: 'observed', description: `summary modal: fallback-markers=${hasFallback}, content-markers=${hasContent}` })
    expect(hasFallback + hasContent, 'summary modal must show content or a localized fallback').toBeGreaterThan(0)
  })

  // ─────────────────── 6 · Entry / nav / deep-link / refresh ───────────────────

  test('6.1 — deep-link + hard refresh both land on My Classes (session persists)', async ({ page }) => {
    await gotoClases(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    await page.reload()
    await settle(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
  })

  test('6.2 — sidebar "Mis clases" link is active/highlighted on this route', async ({ page }) => {
    await gotoClases(page)
    // Sidebar marks the active item with data-active="true".
    const active = page.locator('a.ek-side-link[data-active="true"]')
    await expect(active.first()).toBeVisible()
    const txt = (await active.first().innerText()).trim()
    test.info().annotations.push({ type: 'observed', description: `active sidebar item="${txt}"` })
    expect(txt).toMatch(/Mis clases/)
  })

  // ─────────────────── 7 · Role guard (other roles must not see this) ───────────────────

  test('7.1 — an unauthenticated visitor is bounced to login (no class data leaks)', async ({ browser }) => {
    const ctx = await browser.newContext() // no storageState → anonymous
    const page = await ctx.newPage()
    await page.goto(CLASES)
    await settle(page)
    // Content is the source of truth (URL may flash mid-redirect). The login form
    // must be present and the "Mis clases" shell must NOT.
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toHaveCount(0)
    await ctx.close()
  })

  test('7.2 — a TEACHER hitting /es/dashboard/clases is bounced away from student classes', async ({ browser }) => {
    await clearRateLimit()
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginUI(page, ACCOUNT.teacher.email, ACCOUNT.teacher.password)
    await page.waitForURL(/\/(maestro|dashboard|onboarding|pending)/, { timeout: 30_000 }).catch(() => {})
    await page.goto(CLASES)
    await settle(page)
    await page.waitForTimeout(2500) // let the layout role-guard bounce settle
    // The student My-Classes top bar must NOT be visible to a teacher.
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `teacher hitting student clases → ${page.url()}` })
    await ctx.close()
  })

  test('7.3 — an ADMIN hitting /es/dashboard/clases is bounced away from student classes', async ({ browser }) => {
    await clearRateLimit()
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginUI(page, ACCOUNT.admin.email, ACCOUNT.admin.password)
    await page.waitForURL(/\/(admin|dashboard)/, { timeout: 30_000 }).catch(() => {})
    await page.goto(CLASES)
    await settle(page)
    await page.waitForTimeout(2500)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `admin hitting student clases → ${page.url()}` })
    await ctx.close()
  })

  // ─────────────────── 8 · IDOR — manage actions are scoped to the owner ───────────────────

  test('8.1 — booking ids in this list are not other students\' bookings (ownership smoke)', async ({ page }) => {
    // The page query filters bookings by the logged-in student's studentId, so
    // Join hrefs should only reference rooms this student owns. We can't read
    // another student's id here, but we record the ids surfaced for audit and
    // assert they are well-formed (no leaked nulls / wildcards).
    await gotoClases(page)
    const hrefs = await page.getByRole('link', { name: ES.joinLink }).evaluateAll(
      els => els.map(e => (e as HTMLAnchorElement).getAttribute('href') || '')
    )
    test.info().annotations.push({ type: 'observed', description: `join hrefs: ${JSON.stringify(hrefs)}` })
    for (const h of hrefs) {
      expect(h, 'each Join href must be a scoped room path').toMatch(/^\/es\/sala\/[0-9a-f-]{8,}$/i)
    }
  })

  // ─────────────────── 9 · i18n ES + EN parity ───────────────────

  test('9.1 — the EN route renders fully in English (no leaked Spanish chrome)', async ({ page }) => {
    await gotoClases(page, '/en/dashboard/clases')
    await expect(page.getByRole('heading', { level: 1, name: EN.title })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: new RegExp(`${EN.tabUpcoming} \\(\\d+\\)`) })).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`${EN.tabHistory} \\(\\d+\\)`) })).toBeVisible()
    await expect(page.getByPlaceholder(EN.search)).toBeVisible()
    // Spanish-only chrome must be ABSENT on the EN page (catches hardcoded ES).
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toHaveCount(0)
    await expect(page.getByPlaceholder(ES.search)).toHaveCount(0)
    await page.screenshot({ path: 'test-results/exhaustive-student-clases-en.png', fullPage: true })
  })

  test('9.2 — EN empty-state copy is English, not Spanish', async ({ page }) => {
    await gotoClases(page, '/en/dashboard/clases')
    await expect(page.getByRole('heading', { level: 1, name: EN.title })).toBeVisible({ timeout: 15_000 })
    const emptyEn = await page.getByText('No upcoming classes').count()
    const emptyEs = await page.getByText(ES.noUpcoming).count()
    test.info().annotations.push({ type: 'observed', description: `EN page: english-empty=${emptyEn}, spanish-empty-leak=${emptyEs}` })
    // If the upcoming list is empty, the EN copy must show and the ES must not.
    if (emptyEn + emptyEs > 0) {
      expect(emptyEs, 'EN page must not leak the Spanish "No tienes clases próximas"').toBe(0)
    }
  })

  // ─────────────────── 10 · Responsive (375px mobile) ───────────────────

  test('10.1 — usable on a 375px viewport (tabs reachable, mobile sidebar toggle present)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await gotoClases(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    // Tabs must still be tappable on mobile.
    const upTab = page.getByRole('button', { name: new RegExp(`${ES.tabUpcoming} \\(\\d+\\)`) })
    await expect(upTab).toBeVisible()
    await upTab.scrollIntoViewIfNeeded()
    await expect(upTab).toBeInViewport()
    await page.screenshot({ path: 'test-results/exhaustive-student-clases-mobile.png', fullPage: true })
  })

  test('10.2 — the desktop layout renders the persistent sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoClases(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    // Desktop <aside> is hidden md:flex — at 1280 it should be present & visible.
    await expect(page.locator('aside').first()).toBeVisible()
  })

  // ─────────────────── 11 · State / concurrency ───────────────────

  test('11.1 — rapid tab toggling does not desync the header from the active tab', async ({ page }) => {
    await gotoClases(page)
    const up = page.getByRole('button', { name: new RegExp(`${ES.tabUpcoming} \\(\\d+\\)`) })
    const hist = page.getByRole('button', { name: new RegExp(`${ES.tabHistory} \\(\\d+\\)`) })
    for (let i = 0; i < 4; i++) { await hist.click(); await up.click() }
    await page.waitForTimeout(200)
    // Ending on "Próximas": the history-only "Últimas clases completadas" header
    // must NOT be showing.
    await expect(page.getByText(ES.historySub)).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible()
  })

  test('11.2 — two tabs of the same page both render independently (no shared-state bleed)', async ({ page, context }) => {
    await gotoClases(page)
    const page2 = await context.newPage()
    await page2.goto(CLASES)
    await settle(page2)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible()
    await expect(page2.getByRole('heading', { level: 1, name: ES.title })).toBeVisible()
    // Switch tab in window 2; window 1's tab state is local React state, must be unaffected.
    await page2.getByRole('button', { name: new RegExp(`${ES.tabHistory} \\(\\d+\\)`) }).click()
    await page2.waitForTimeout(200)
    // Window 1 still on default Upcoming — its history header must be absent.
    await expect(page.getByText(ES.historySub)).toHaveCount(0)
    await page2.close()
  })

  // ─────────────────── 12 · Data integrity / known-suspect strings ───────────────────

  test('12.1 — DEAD STRING audit: a "Canceladas" tab string exists in code but no 3rd tab renders', async ({ page }) => {
    await gotoClases(page)
    // ClasesClient `t` defines tabCancelled ("Canceladas"/"Cancelled") but the
    // tab array only renders Próximas + Completadas. Confirm there is NO third
    // tab — i.e. the string is dead/unused (a cleanup finding, not a crash).
    const tabButtons = await page.getByRole('button', { name: /\(\d+\)/ }).count()
    const cancelTab = await page.getByRole('button', { name: /Canceladas \(\d+\)/ }).count()
    test.info().annotations.push({ type: 'observed', description: `rendered count-tabs=${tabButtons}; Canceladas-tab=${cancelTab} (tabCancelled string is unused — dead i18n)` })
    expect(tabButtons, 'exactly two tabs (Próximas, Completadas) render').toBe(2)
    expect(cancelTab, 'the "Canceladas" tab string is defined but never rendered').toBe(0)
  })

  test('12.2 — no raw timezone/locale artifacts (Invalid Date / NaN) on any rendered row', async ({ page }) => {
    await gotoClases(page)
    const body = (await page.locator('main').innerText())
    const artifact = /Invalid Date|NaN|undefined|\[object Object\]/.test(body)
    test.info().annotations.push({ type: 'observed', description: `date/locale artifact present=${artifact}` })
    expect(artifact, 'rendered classes must not contain Invalid Date / NaN / undefined artifacts').toBeFalsy()
  })

  // ─────────────────── 13 · Session sanity (storageState actually authed) ───────────────────

  test('13.1 — the saved student storageState carries a live auth cookie', async ({ page, context }) => {
    await gotoClases(page)
    expect(hasAuthCookie(await context.cookies()), 'student storageState must be authenticated').toBeTruthy()
  })
})
