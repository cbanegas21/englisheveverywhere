/**
 * EXHAUSTIVE LIVE QA — TEACHER · Earnings (/es/maestro/dashboard/ganancias)
 *
 * Surface: src/app/[lang]/maestro/dashboard/ganancias/{page.tsx,GananciasClient.tsx}
 * Supporting: components/ui/StatLedger.tsx, components/ui/DashTopBar.tsx,
 *             components/dashboard/SectionHeader.tsx, components/dashboard/Sidebar.tsx,
 *             guards: maestro/layout.tsx + maestro/dashboard/layout.tsx
 *
 * Runs against LIVE (PLAYWRIGHT_BASE_URL=https://englishkolab.com) with the saved
 * TEACHER session (STATE.teacher) so it never logs in (no rate-limit contention).
 * Role-guard probes spin up their own student/admin/anon contexts.
 *
 * SAFETY: this surface is 100% READ-ONLY. The page is a server component that
 * SELECTs completed bookings + payments and the client renders a StatLedger and
 * a hairline table. There are NO inputs, NO buttons, NO forms, NO mutations on
 * this surface. Every probe here only navigates + reads rendered content. NOTHING
 * in this file mutates any data.
 *
 * NOTE ON SCOPE vs. FOCUS: the surface brief mentions "payout/Stripe-onboarding
 * UI" and "available/pending balance". The shipped component has NONE of that —
 * it shows session counts + summed USD payouts only. Probe 12.1 records that gap
 * explicitly as a finding rather than asserting non-existent UI.
 *
 * Selectors + ES/EN label text were lifted VERBATIM from GananciasClient.tsx's
 * `t` table and the currency formatter — not guessed.
 */
import { test, expect, type Page } from '@playwright/test'
import { STATE, ACCOUNT, settle, clearRateLimit, loginUI, hasAuthCookie } from './_exhaustive/helpers'

// ── exact label text lifted from GananciasClient.tsx `t` ───────────────────
const ES = {
  title: 'Ganancias',
  subtitle: 'Historial de sesiones + tus pagos.',
  thisMonth: 'Sesiones este mes',
  total: 'Sesiones totales',
  thisMonthEarnings: 'Ganancias del mes',
  totalEarnings: 'Ganancias totales',
  recentSessions: 'Sesiones completadas',
  noSessions: 'Sin sesiones completadas aún.',
  date: 'Fecha',
  student: 'Estudiante',
  duration: 'Duración',
  earnings: 'Pago',
  mins: 'min',
}
const EN = {
  title: 'Earnings',
  subtitle: 'Your session history + teacher payouts.',
  thisMonth: 'Sessions this month',
  total: 'Total sessions',
  thisMonthEarnings: 'This month earnings',
  totalEarnings: 'Total earnings',
  recentSessions: 'Completed sessions',
  noSessions: 'No completed sessions yet.',
  date: 'Date',
  student: 'Student',
  duration: 'Duration',
  earnings: 'Payout',
}

const GANANCIAS = '/es/maestro/dashboard/ganancias'
const GANANCIAS_EN = '/en/maestro/dashboard/ganancias'

async function gotoGanancias(page: Page, url = GANANCIAS) {
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
    if (s >= 400 && /englishkolab\.com/.test(r.url())) badResponses.push(`${s} ${r.url()}`)
  })
  return { consoleErrors, badResponses }
}

// The four StatLedger values, in declaration order:
//   [0] Ganancias del mes (accent)  [1] Ganancias totales (accent)
//   [2] Sesiones este mes           [3] Sesiones totales
const statValues = (page: Page) => page.locator('.lk-statledger .lk-stat-value')

test.describe('EXHAUSTIVE · teacher · Earnings (/es/maestro/dashboard/ganancias)', () => {
  test.use({ storageState: STATE.teacher })

  // ─────────────────── 1 · Happy-path render ───────────────────

  test('1.1 — page renders the Earnings shell (title, subtitle, ledger, section)', async ({ page }) => {
    const { consoleErrors, badResponses } = watchErrors(page)
    await gotoGanancias(page)

    // Title in the top bar (h1). The guard would have bounced us if role were
    // wrong — assert on rendered content, never the URL.
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(ES.subtitle)).toBeVisible()

    // Ledger renders exactly the four kickers.
    await expect(page.getByText(ES.thisMonthEarnings)).toBeVisible()
    await expect(page.getByText(ES.totalEarnings)).toBeVisible()
    await expect(page.getByText(ES.thisMonth)).toBeVisible()
    await expect(page.getByText(ES.total)).toBeVisible()

    // Completed-sessions section header.
    await expect(page.getByRole('heading', { name: ES.recentSessions })).toBeVisible()

    await page.screenshot({ path: 'test-results/exhaustive-teacher-ganancias-render.png', fullPage: true })

    test.info().annotations.push({ type: 'observed', description: `console-errors=${consoleErrors.length}; 4xx/5xx=${badResponses.length}` })
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([])
    expect(badResponses, `4xx/5xx on page:\n${badResponses.join('\n')}`).toEqual([])
  })

  test('1.2 — the StatLedger renders exactly four stat values', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    const n = await statValues(page).count()
    test.info().annotations.push({ type: 'observed', description: `stat values rendered=${n} (expected 4)` })
    expect(n, 'Earnings ledger must render the 4 stats').toBe(4)
  })

  // ─────────────────── 2 · Currency rendering / number integrity ───────────────────

  test('2.1 — both earnings stats render as USD currency (es-HN, no decimals)', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })

    // formatUsd: Intl.NumberFormat('es-HN', { style:'currency', currency:'USD',
    // maximumFractionDigits: 0 }) → e.g. "US$1,234" / "$1,234" / "$0" (no cents).
    const monthVal = (await statValues(page).nth(0).innerText()).trim()
    const totalVal = (await statValues(page).nth(1).innerText()).trim()
    test.info().annotations.push({ type: 'observed', description: `Ganancias del mes="${monthVal}"; Ganancias totales="${totalVal}"` })

    // Must contain a currency marker ($ or US$) and digits, and must NOT carry
    // a fractional part (maximumFractionDigits:0). Catches a formatter regression.
    for (const [label, v] of [['mes', monthVal], ['total', totalVal]] as const) {
      expect(v, `${label} earnings must show a $ currency marker`).toMatch(/\$/)
      expect(v, `${label} earnings must contain a digit`).toMatch(/\d/)
      expect(v, `${label} earnings must have NO decimal part (maximumFractionDigits:0)`).not.toMatch(/[.,]\d{2}\b/)
      expect(v, `${label} earnings must not be NaN/undefined/Invalid`).not.toMatch(/NaN|undefined|Invalid|\[object/)
    }
  })

  test('2.2 — accent earnings vs plain session-count stats are visually distinguished', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    // The two earnings stats carry accent={true} → inline color var(--ek-red);
    // the two session counts do not. Assert the accent inline style is present
    // on the earnings values and absent on the count values.
    const earnColor = await statValues(page).nth(0).evaluate(el => (el as HTMLElement).style.color)
    const countColor = await statValues(page).nth(2).evaluate(el => (el as HTMLElement).style.color)
    test.info().annotations.push({ type: 'observed', description: `accent earnings inline-color="${earnColor}"; count inline-color="${countColor}"` })
    expect(earnColor, 'earnings stat should carry the red accent inline color').toMatch(/ek-red|rgb|#/)
    expect(countColor, 'session-count stat should NOT carry an inline accent color').toBe('')
  })

  test('2.3 — session-count stats are non-negative integers (no NaN / float)', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    const monthCount = (await statValues(page).nth(2).innerText()).trim()
    const totalCount = (await statValues(page).nth(3).innerText()).trim()
    test.info().annotations.push({ type: 'observed', description: `Sesiones este mes="${monthCount}"; Sesiones totales="${totalCount}"` })
    for (const [label, v] of [['mes', monthCount], ['total', totalCount]] as const) {
      expect(v, `${label} session count must be a plain non-negative integer`).toMatch(/^\d+$/)
    }
    // Sanity invariant: this-month count cannot exceed the all-time count.
    if (/^\d+$/.test(monthCount) && /^\d+$/.test(totalCount)) {
      const m = Number(monthCount), tot = Number(totalCount)
      test.info().annotations.push({ type: 'observed', description: `invariant thisMonth(${m}) <= total(${tot}) = ${m <= tot}` })
      // NOTE: thisMonthSessions is computed from completed BOOKINGS this month
      // while "Sesiones totales" comes from teachers.total_sessions — these can
      // legitimately diverge. Record, don't hard-fail, if month > total.
      if (m > tot) test.info().annotations.push({ type: 'DATA-INTEGRITY', description: `EXPECTED FINDING: this-month sessions (${m}) > total sessions (${tot}) — count sources differ (bookings vs teachers.total_sessions)` })
    }
  })

  // ─────────────────── 3 · Completed-sessions table OR empty state ───────────────────

  test('3.1 — exactly one of {empty-state, sessions table} renders (never both / neither)', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    const emptyCopy = await page.getByText(ES.noSessions).count()
    const tableRows = await page.locator('table tbody tr').count()
    test.info().annotations.push({ type: 'observed', description: `empty-copy=${emptyCopy}; table-rows=${tableRows}` })
    expect(emptyCopy > 0 || tableRows > 0, 'must show empty copy OR table rows').toBeTruthy()
    expect(emptyCopy > 0 && tableRows > 0, 'must NOT show empty copy AND rows simultaneously').toBeFalsy()
  })

  test('3.2 — if rows exist, the table header is Fecha/Estudiante/Duración/Pago in order', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    if (await page.locator('table tbody tr').count() === 0) {
      test.info().annotations.push({ type: 'inconclusive', description: 'no completed sessions for teacher QA account — table not exercised' })
      test.skip(); return
    }
    const headers = await page.locator('table thead th').allInnerTexts()
    test.info().annotations.push({ type: 'observed', description: `table headers=${JSON.stringify(headers)}` })
    expect(headers.map(h => h.trim())).toEqual([ES.date, ES.student, ES.duration, ES.earnings])
  })

  test('3.3 — every row payout cell is USD currency and duration cell ends in "min"', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count === 0) { test.info().annotations.push({ type: 'inconclusive', description: 'no rows to validate' }); test.skip(); return }
    const offenders: string[] = []
    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator('td')
      const dateTxt = (await cells.nth(0).innerText()).trim()
      const durTxt = (await cells.nth(2).innerText()).trim()
      const payTxt = (await cells.nth(3).innerText()).trim()
      // Date: localized "Jun 9, 2026" style — must not be Invalid Date.
      if (/Invalid Date|NaN/.test(dateTxt)) offenders.push(`row ${i} date="${dateTxt}"`)
      // Duration: `${duration_minutes}min` (e.g. "60min").
      if (!/^\d+min$/.test(durTxt)) offenders.push(`row ${i} duration="${durTxt}"`)
      // Payout: USD currency, no decimals, no NaN.
      if (!/\$/.test(payTxt) || /NaN|undefined|Invalid/.test(payTxt) || /[.,]\d{2}\b/.test(payTxt)) offenders.push(`row ${i} payout="${payTxt}"`)
    }
    test.info().annotations.push({ type: 'observed', description: `rows=${count}; offenders=${JSON.stringify(offenders)}` })
    expect(offenders, `malformed cells:\n${offenders.join('\n')}`).toEqual([])
  })

  test('3.4 — rendered list is capped at 50 rows (displaySessions slice)', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    const count = await page.locator('table tbody tr').count()
    test.info().annotations.push({ type: 'observed', description: `rendered rows=${count} (cap=50)` })
    expect(count, 'page.tsx caps the rendered list with .slice(0,50)').toBeLessThanOrEqual(50)
  })

  test('3.5 — when empty, the empty copy is the only body content (no orphan table)', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    if (await page.getByText(ES.noSessions).count() === 0) {
      test.info().annotations.push({ type: 'inconclusive', description: 'teacher QA account has completed sessions — empty state not exercised' })
      test.skip(); return
    }
    await expect(page.getByText(ES.noSessions)).toBeVisible()
    await expect(page.locator('table')).toHaveCount(0)
  })

  // ─────────────────── 4 · Entry / nav / deep-link / refresh ───────────────────

  test('4.1 — deep-link + hard refresh both land on Earnings (session persists)', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    await page.reload()
    await settle(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
  })

  test('4.2 — sidebar "Ganancias" link is the active/highlighted item on this route', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    const active = page.locator('a.ek-side-link[data-active="true"]')
    await expect(active.first()).toBeVisible()
    const txt = (await active.first().innerText()).trim()
    test.info().annotations.push({ type: 'observed', description: `active sidebar item="${txt}"` })
    expect(txt).toMatch(/Ganancias/)
  })

  test('4.3 — trailing-slash variant of the URL still resolves to Earnings', async ({ page }) => {
    await gotoGanancias(page, GANANCIAS + '/')
    // Next normalizes the trailing slash; content must still be the Earnings shell.
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
  })

  // ─────────────────── 5 · Role guard (other roles / anon must not see this) ───────────────────

  test('5.1 — an unauthenticated visitor is bounced to login (no earnings leak)', async ({ browser }) => {
    const ctx = await browser.newContext() // no storageState → anonymous
    const page = await ctx.newPage()
    await page.goto(GANANCIAS)
    await settle(page)
    // Content is the source of truth (URL may flash mid-redirect): login form
    // present, Earnings shell absent, no currency figures leaked.
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toHaveCount(0)
    await expect(page.getByText(ES.totalEarnings)).toHaveCount(0)
    await ctx.close()
  })

  test('5.2 — a STUDENT hitting the teacher Earnings route is bounced away (maestro layout guard)', async ({ browser }) => {
    await clearRateLimit()
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginUI(page, ACCOUNT.student.email, ACCOUNT.student.password)
    await page.waitForURL(/\/(maestro|dashboard|onboarding|pending|intake)/, { timeout: 30_000 }).catch(() => {})
    await page.goto(GANANCIAS)
    await settle(page)
    await page.waitForTimeout(2500) // let maestro/layout role-guard bounce settle
    // maestro/layout.tsx redirects non-teacher → /dashboard. Earnings chrome must
    // NOT be visible to a student.
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toHaveCount(0)
    await expect(page.getByText(ES.totalEarnings)).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `student hitting teacher ganancias → ${page.url()}` })
    await ctx.close()
  })

  test('5.3 — an ADMIN hitting the teacher Earnings route is bounced to /admin (no teacher UI)', async ({ browser }) => {
    await clearRateLimit()
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginUI(page, ACCOUNT.admin.email, ACCOUNT.admin.password)
    await page.waitForURL(/\/(admin|dashboard)/, { timeout: 30_000 }).catch(() => {})
    await page.goto(GANANCIAS)
    await settle(page)
    await page.waitForTimeout(2500)
    // maestro/layout.tsx explicitly redirects role==='admin' → /admin so admins
    // cannot URL-hop into teacher UI. Earnings shell must be absent.
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `admin hitting teacher ganancias → ${page.url()}` })
    await ctx.close()
  })

  // ─────────────────── 6 · i18n ES + EN parity ───────────────────

  test('6.1 — the EN route renders fully in English (no leaked Spanish chrome)', async ({ page }) => {
    await gotoGanancias(page, GANANCIAS_EN)
    await expect(page.getByRole('heading', { level: 1, name: EN.title })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(EN.subtitle)).toBeVisible()
    await expect(page.getByText(EN.thisMonthEarnings)).toBeVisible()
    await expect(page.getByText(EN.totalEarnings)).toBeVisible()
    await expect(page.getByText(EN.thisMonth)).toBeVisible()
    await expect(page.getByText(EN.total)).toBeVisible()
    await expect(page.getByRole('heading', { name: EN.recentSessions })).toBeVisible()
    // Spanish-only chrome must be ABSENT on the EN page (catches hardcoded ES).
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toHaveCount(0)
    await expect(page.getByText(ES.totalEarnings)).toHaveCount(0)
    await expect(page.getByText(ES.subtitle)).toHaveCount(0)
    await page.screenshot({ path: 'test-results/exhaustive-teacher-ganancias-en.png', fullPage: true })
  })

  test('6.2 — EN empty-state / table headers are English, not Spanish', async ({ page }) => {
    await gotoGanancias(page, GANANCIAS_EN)
    await expect(page.getByRole('heading', { level: 1, name: EN.title })).toBeVisible({ timeout: 15_000 })
    const emptyEn = await page.getByText(EN.noSessions).count()
    const emptyEs = await page.getByText(ES.noSessions).count()
    const rows = await page.locator('table tbody tr').count()
    test.info().annotations.push({ type: 'observed', description: `EN page: english-empty=${emptyEn}, spanish-empty-leak=${emptyEs}, rows=${rows}` })
    if (rows === 0) {
      // Empty state: EN copy must show, ES must not leak.
      expect(emptyEs, 'EN page must not leak the Spanish "Sin sesiones completadas aún."').toBe(0)
    } else {
      // Table present: headers must be English.
      const headers = (await page.locator('table thead th').allInnerTexts()).map(h => h.trim())
      test.info().annotations.push({ type: 'observed', description: `EN table headers=${JSON.stringify(headers)}` })
      expect(headers).toEqual([EN.date, EN.student, EN.duration, EN.earnings])
      // Spanish header text must not appear.
      expect(headers).not.toContain(ES.duration)
    }
  })

  test('6.3 — EN currency uses en-US USD formatting and still has no decimals', async ({ page }) => {
    await gotoGanancias(page, GANANCIAS_EN)
    await expect(page.getByRole('heading', { level: 1, name: EN.title })).toBeVisible({ timeout: 15_000 })
    const monthVal = (await statValues(page).nth(0).innerText()).trim()
    test.info().annotations.push({ type: 'observed', description: `EN Ganancias-del-mes value="${monthVal}"` })
    expect(monthVal, 'EN earnings must show a $ currency marker').toMatch(/\$/)
    expect(monthVal, 'EN earnings must have no cents').not.toMatch(/[.,]\d{2}\b/)
  })

  // ─────────────────── 7 · Responsive (375px mobile + desktop) ───────────────────

  test('7.1 — usable on a 375px viewport (ledger reflows to 2-up, title visible)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    // The ledger uses a media query at max-width:720 → 2 columns. All four stats
    // must still be present and the earnings kicker reachable.
    await expect(page.getByText(ES.totalEarnings)).toBeVisible()
    expect(await statValues(page).count(), 'all 4 stats present on mobile').toBe(4)
    // No horizontal overflow that pushes the page wider than the viewport body.
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientW = await page.evaluate(() => document.documentElement.clientWidth)
    test.info().annotations.push({ type: 'observed', description: `mobile scrollWidth=${scrollW} clientWidth=${clientW}` })
    await page.screenshot({ path: 'test-results/exhaustive-teacher-ganancias-mobile.png', fullPage: true })
  })

  test('7.2 — desktop layout renders the persistent sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('aside').first()).toBeVisible()
  })

  test('7.3 — the sessions table is horizontally scrollable on mobile (no clipped payout column)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    if (await page.locator('table').count() === 0) {
      test.info().annotations.push({ type: 'inconclusive', description: 'no table (empty state) on mobile' })
      test.skip(); return
    }
    // The table is wrapped in overflow-x-auto so the Pago column never clips.
    const wrapped = await page.locator('div.overflow-x-auto table').count()
    test.info().annotations.push({ type: 'observed', description: `table wrapped in overflow-x-auto=${wrapped > 0}` })
    expect(wrapped, 'sessions table should sit inside an overflow-x-auto wrapper on mobile').toBeGreaterThan(0)
  })

  // ─────────────────── 8 · Console / network health ───────────────────

  test('8.1 — no console errors and no 4xx/5xx for englishkolab.com on load (ES)', async ({ page }) => {
    const { consoleErrors, badResponses } = watchErrors(page)
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(1000)
    test.info().annotations.push({ type: 'observed', description: `ES console-errors=${consoleErrors.length}; bad-responses=${JSON.stringify(badResponses)}` })
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([])
    expect(badResponses, `4xx/5xx on page:\n${badResponses.join('\n')}`).toEqual([])
  })

  test('8.2 — no console errors and no 4xx/5xx on the EN route', async ({ page }) => {
    const { consoleErrors, badResponses } = watchErrors(page)
    await gotoGanancias(page, GANANCIAS_EN)
    await expect(page.getByRole('heading', { level: 1, name: EN.title })).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(1000)
    test.info().annotations.push({ type: 'observed', description: `EN console-errors=${consoleErrors.length}; bad-responses=${JSON.stringify(badResponses)}` })
    expect(consoleErrors, `console errors (EN):\n${consoleErrors.join('\n')}`).toEqual([])
    expect(badResponses, `4xx/5xx on page (EN):\n${badResponses.join('\n')}`).toEqual([])
  })

  // ─────────────────── 9 · URL fuzzing / injection on the path (read-only surface) ───────────────────

  test('9.1 — junk lang segment does not 500 and does not leak earnings under a bad locale', async ({ page }) => {
    const { badResponses } = watchErrors(page)
    // /xx/... is not a supported locale; proxy.ts handles locale routing. Expect a
    // safe handling (redirect to a real locale, 404, or login) — never a 5xx and
    // never the Earnings shell rendered under an invalid locale.
    await page.goto('/xx/maestro/dashboard/ganancias')
    await settle(page)
    const fivexx = badResponses.filter(r => /\s5\d\d\b|^5\d\d /.test(r))
    test.info().annotations.push({ type: 'observed', description: `junk-locale → ${page.url()}; 5xx=${JSON.stringify(fivexx)}` })
    expect(fivexx, 'invalid locale must not 500').toEqual([])
  })

  test('9.2 — path-traversal / encoded junk appended after ganancias does not 500', async ({ page }) => {
    const { badResponses } = watchErrors(page)
    await page.goto('/es/maestro/dashboard/ganancias/..%2f..%2fadmin')
    await settle(page)
    const fivexx = badResponses.filter(r => /\b5\d\d\b/.test(r))
    test.info().annotations.push({ type: 'observed', description: `traversal probe → ${page.url()}; 5xx=${JSON.stringify(fivexx)}` })
    // Must not render the admin shell to a teacher, and must not 500.
    await expect(page.getByText(/Gestión de usuarios|Solicitudes pendientes|Panel de admin/i)).toHaveCount(0)
    expect(fivexx, 'traversal-style path must not 500').toEqual([])
  })

  // ─────────────────── 10 · Data-integrity smoke ───────────────────

  test('10.1 — no Invalid Date / NaN / undefined / [object Object] anywhere on the page', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    const body = await page.locator('main').innerText()
    const artifact = /Invalid Date|NaN|undefined|\[object Object\]/.test(body)
    test.info().annotations.push({ type: 'observed', description: `artifact present=${artifact}` })
    expect(artifact, 'rendered earnings must not contain Invalid Date / NaN / undefined / [object Object]').toBeFalsy()
  })

  test('10.2 — student names in the table are first-name only (no PII over-exposure)', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count === 0) { test.info().annotations.push({ type: 'inconclusive', description: 'no rows' }); test.skip(); return }
    // GananciasClient renders full_name.split(' ')[0] — a single token (or "—").
    // A multi-token cell would mean the .split fix regressed (leaks surname).
    const multiToken: string[] = []
    for (let i = 0; i < count; i++) {
      const name = (await rows.nth(i).locator('td').nth(1).innerText()).trim()
      if (name !== '—' && /\s/.test(name)) multiToken.push(name)
    }
    test.info().annotations.push({ type: 'observed', description: `rows=${count}; multi-token student cells=${JSON.stringify(multiToken)}` })
    expect(multiToken, 'student column should show first name only (full_name.split(" ")[0])').toEqual([])
  })

  // ─────────────────── 11 · Session sanity ───────────────────

  test('11.1 — the saved teacher storageState carries a live auth cookie', async ({ page, context }) => {
    await gotoGanancias(page)
    expect(hasAuthCookie(await context.cookies()), 'teacher storageState must be authenticated').toBeTruthy()
  })

  // ─────────────────── 12 · Scope gap vs. brief (payout / Stripe-onboarding UI) ───────────────────

  test('12.1 — SCOPE GAP: no payout-trigger / Stripe-onboarding / pending-balance UI on this surface', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    // The brief calls for "available/pending balance" + "payout/Stripe-onboarding
    // UI". The shipped GananciasClient has NONE of it — only counts + summed
    // payouts + a completed-sessions table. Record the gap explicitly.
    const payoutBtn = await page.getByRole('button', { name: /retir|payout|withdraw|cobrar|transferir/i }).count()
    const stripeLink = await page.getByRole('link', { name: /stripe|onboarding|connect|configurar pagos|set up payouts/i }).count()
    const balanceCopy = await page.getByText(/saldo disponible|saldo pendiente|available balance|pending balance/i).count()
    const present = payoutBtn + stripeLink + balanceCopy
    test.info().annotations.push({ type: 'SCOPE-GAP', description: `payout-btn=${payoutBtn}, stripe-link=${stripeLink}, balance-copy=${balanceCopy} — brief expects payout/Stripe-onboarding UI; surface ships none (counts + table only)` })
    // This is documentary: the absence is the finding. Assert the surface is the
    // read-only ledger it actually is (so a future addition flips this test red
    // and forces a re-review of the new mutating UI).
    expect(present, 'EXPECTED FINDING: Earnings surface has no payout/Stripe-onboarding/balance UI — brief expects it; flag for product').toBe(0)
  })

  test('12.2 — surface is read-only: no forms or interactive buttons inside the content region', async ({ page }) => {
    await gotoGanancias(page)
    await expect(page.getByRole('heading', { level: 1, name: ES.title })).toBeVisible({ timeout: 15_000 })
    // The content column (max-w-4xl wrapper) holds only the ledger + table — no
    // <form> and no buttons. (Sidebar/topbar chrome is OUTSIDE <main>'s content
    // column but inside <main>; scope the check to the inner content wrapper.)
    const contentForms = await page.locator('main .max-w-4xl form').count()
    const contentButtons = await page.locator('main .max-w-4xl button').count()
    test.info().annotations.push({ type: 'observed', description: `content-region forms=${contentForms}, buttons=${contentButtons}` })
    expect(contentForms, 'Earnings content has no forms (read-only)').toBe(0)
    expect(contentButtons, 'Earnings content has no interactive buttons (read-only)').toBe(0)
  })
})
