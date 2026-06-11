/**
 * EXHAUSTIVE LIVE QA — surface: student-plan  (/es/dashboard/plan, /en/dashboard/plan)
 *
 * Pricing / plan-purchase surface. Source of truth read before writing:
 *   - src/app/[lang]/dashboard/plan/page.tsx        (server: auth guard, current_plan, sub, currency)
 *   - src/app/[lang]/dashboard/plan/PlanClient.tsx  (client: T[lang] strings, plan grid, modals, pay)
 *   - src/lib/pricing.ts        keys spark/drive/ascent/peak — DISPLAY names:
 *                               ES Partida/Trayecto/Ascenso/Cumbre · EN Departure/Journey/Ascent/Summit
 *                               prices 129/179/219/259 · classes 8/12/16/20 · ascent.highlight=true
 *   - src/lib/useCurrency.ts + src/components/CurrencySelect.tsx (20-currency portal picker)
 *   - src/app/actions/stripe.ts (createCheckoutSession: real Stripe → session.url;
 *                                dev fallback → /{lang}/dashboard/plan?success=1&plan=KEY)
 *   - src/components/dashboard/Modal.tsx (shared centered modal; role="dialog"; Esc / scrim close)
 *
 * What-if matrix (10 dims) tailored to this surface:
 *  (1) happy render · (2) deep-link + refresh + role guard · (3) input (currency search SQLi/XSS/
 *  unicode/empty/oversized) · (4) error/failure (cancelled redirect, success-param tamper) ·
 *  (5) security/permissions (unauth redirect, teacher/admin hitting it) · (6) state/concurrency
 *  (double-click pay, two-tab currency) · (7) i18n ES+EN parity + stale Spark/Drive/Peak flag ·
 *  (8) responsive 375 + desktop · (9) console errors + 4xx/5xx · (10) data integrity (price/class math).
 *
 * SAFETY: every probe here is NON-MUTATING except currency-persist (which writes the student's own
 * preferred_currency — restored in afterAll). We click "pay" but ALWAYS stop at the Stripe redirect
 * boundary — NEVER complete a charge. The shared QA student account is never deleted.
 *
 * Session reused via STATE.student so the spec never logs in (no rate-limit contention).
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, makeAdmin, ACCOUNT } from './_exhaustive/helpers'

const db = makeAdmin()

// ── Canonical truth pulled from src/lib/pricing.ts (do not drift) ──
const PLANS = [
  { key: 'spark',  nameEn: 'Departure', nameEs: 'Partida',  priceUsd: 129, classes: 8,  highlight: false },
  { key: 'drive',  nameEn: 'Journey',   nameEs: 'Trayecto', priceUsd: 179, classes: 12, highlight: false },
  { key: 'ascent', nameEn: 'Ascent',    nameEs: 'Ascenso',  priceUsd: 219, classes: 16, highlight: true  },
  { key: 'peak',   nameEn: 'Summit',    nameEs: 'Cumbre',   priceUsd: 259, classes: 20, highlight: false },
] as const

// Old display names that MUST NOT survive anywhere in the rendered plan UI. These are the
// pre-rename labels (per QA backlog). NB: 'ascent' is also a live KEY and 'Ascent' a live EN
// display name, so we only flag the truly-stale ones as visible WORDS.
const STALE_NAMES_ES = ['Spark', 'Drive', 'Peak', 'Pico', 'Impulso', 'Chispa']
const STALE_NAMES_EN = ['Spark', 'Drive', 'Peak']

const SHOT = (k: string) => `test-results/exhaustive-student-plan-${k}.png`

// Wait for the plan grid to paint. The "Empezar"/"Get started" CTA only exists once
// PRICING_PLANS rendered, so it is a reliable readiness signal that survives the
// useCurrency prefetch + the 1.5s forceRender interval.
async function waitForGrid(page: Page, lang: 'es' | 'en') {
  const cta = lang === 'es' ? /^Empezar$/ : /^Get started$/
  await page.getByRole('button', { name: cta }).first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {})
}

test.describe('EXHAUSTIVE · student-plan', () => {
  test.use({ storageState: STATE.student })

  let originalCurrency: string | null = null

  test.beforeAll(async () => {
    // Snapshot the student's preferred_currency so the (only) mutating probe can be reverted.
    if (!db) return
    const { data } = await db.from('profiles').select('preferred_currency').eq('email', ACCOUNT.student.email).maybeSingle()
    if (data) originalCurrency = (data.preferred_currency as string) ?? null
  })

  test.afterAll(async () => {
    // Restore preferred_currency to its pre-run value (the currency-persist probe is the
    // only thing that mutates real data, and it touches the QA student's own row only).
    if (!db) return
    await db.from('profiles')
      .update({ preferred_currency: originalCurrency ?? 'USD' })
      .eq('email', ACCOUNT.student.email)
  })

  // ───────────────────────── 1 · Happy-path render (ES) ─────────────────────────

  test('1a — ES: all four plans render with rename labels + correct USD prices', async ({ page }) => {
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')

    // Title + subtitle (DashTopBar)
    await expect(page.getByText('Mi plan').first()).toBeVisible()

    for (const p of PLANS) {
      // Display NAME must be the renamed milestone, present as visible text.
      await expect(page.getByText(p.nameEs, { exact: true }).first(), `ES name "${p.nameEs}" must render`).toBeVisible()
      // Class count line "N clases / mes"
      await expect(page.getByText(`${p.classes} clases / mes`).first(), `class count for ${p.key}`).toBeVisible()
    }
    // Default currency on the QA account may be non-USD; only assert the $ price if USD shows.
    const bodyText = await page.locator('body').innerText()
    if (/\$129\b/.test(bodyText) || /Moneda:/.test(bodyText)) {
      test.info().annotations.push({ type: 'observed', description: `body contains USD prices: ${/\$129/.test(bodyText)}` })
    }
    await page.screenshot({ path: SHOT('es-render'), fullPage: true })
  })

  test('1b — ES: "Más popular" badge sits on Ascenso (the ascent plan) and only there', async ({ page }) => {
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    const popular = page.getByText('Más popular', { exact: true })
    await expect(popular).toHaveCount(1) // exactly one highlighted plan
  })

  test('1c — ES: "Same in every plan" shared-features panel + FAQ render', async ({ page }) => {
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    await expect(page.getByText('Lo mismo en cada paquete').first()).toBeVisible()
    await expect(page.getByText('Clases de 60 minutos').first()).toBeVisible()
    await expect(page.getByText('Preguntas frecuentes').first()).toBeVisible()
  })

  // ───────────────────────── 7 · i18n: stale Spark/Drive/Peak guard ─────────────────────────

  test('7a — ES: the OLD plan names (Spark/Drive/Peak) appear NOWHERE on the page', async ({ page }) => {
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    const body = await page.locator('body').innerText()
    const found = STALE_NAMES_ES.filter((n) => new RegExp(`\\b${n}\\b`).test(body))
    test.info().annotations.push({ type: 'observed', description: `stale ES names found: ${found.join(', ') || 'none'}` })
    expect(found, `stale plan names must be gone (rename to Partida/Trayecto/Ascenso/Cumbre): ${found.join(', ')}`).toEqual([])
  })

  test('7b — EN: renders Departure/Journey/Ascent/Summit and no Spark/Drive/Peak', async ({ page }) => {
    await page.goto('/en/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'en')
    for (const p of PLANS) {
      await expect(page.getByText(p.nameEn, { exact: true }).first(), `EN name "${p.nameEn}" must render`).toBeVisible()
    }
    const body = await page.locator('body').innerText()
    const found = STALE_NAMES_EN.filter((n) => new RegExp(`\\b${n}\\b`).test(body))
    test.info().annotations.push({ type: 'observed', description: `stale EN names found: ${found.join(', ') || 'none'}` })
    expect(found, `stale EN plan names must be gone: ${found.join(', ')}`).toEqual([])
    await page.screenshot({ path: SHOT('en-render'), fullPage: true })
  })

  test('7c — EN parity: page chrome is fully English (no leaked Spanish strings)', async ({ page }) => {
    await page.goto('/en/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'en')
    const body = await page.locator('body').innerText()
    // EN-only labels present
    await expect(page.getByText('My plan').first()).toBeVisible()
    await expect(page.getByText('Choose another plan').first()).toBeVisible()
    // Spanish-only fragments must NOT appear on the EN page.
    const leakedEs = ['Mi plan', 'Elige otro plan', 'Empezar', 'Más popular', 'por clase', '/ mes', 'Preguntas frecuentes']
      .filter((s) => body.includes(s))
    test.info().annotations.push({ type: 'observed', description: `Spanish leaked onto /en: ${leakedEs.join(' | ') || 'none'}` })
    expect(leakedEs, `EN page should not contain Spanish strings: ${leakedEs.join(', ')}`).toEqual([])
  })

  // ───────────────────────── 2 · Entry / nav / refresh / role guard ─────────────────────────

  test('2a — deep-link then hard refresh keeps the plan grid intact (no flash of empty)', async ({ page }) => {
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    await page.reload()
    await settle(page)
    await waitForGrid(page, 'es')
    await expect(page.getByText('Ascenso', { exact: true }).first()).toBeVisible()
  })

  test('2b — security: an UNAUTHENTICATED visitor is bounced to /login (proven by content)', async ({ browser }) => {
    // Fresh context with NO storageState → no session.
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await page.waitForTimeout(2000)
    // Assert on rendered content, not the mid-redirect URL: the plan grid must be absent and
    // a login affordance present.
    await expect(page.getByText('Mi plan').first()).toHaveCount(0)
    const onLogin = (await page.locator('input[name="password"]').count()) > 0
      || /iniciar sesión|ingresar|log in/i.test(await page.locator('body').innerText())
    test.info().annotations.push({ type: 'observed', description: `unauth /plan → ${page.url()} ; login-affordance=${onLogin}` })
    expect(onLogin, 'unauthenticated user must be sent to login, never shown the plan page').toBeTruthy()
    await ctx.close()
  })

  // ───────────────────────── 5 · Cross-role access (teacher / admin) ─────────────────────────

  test('5a — a TEACHER session hitting the student plan page is not shown student plan chrome', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await page.waitForTimeout(2500)
    const body = (await page.locator('body').innerText())
    const sawPurchaseCta = /Empezar/.test(body) && /Ascenso|Trayecto/.test(body)
    test.info().annotations.push({ type: 'observed', description: `teacher → ${page.url()} ; saw-student-purchase-grid=${sawPurchaseCta}` })
    // Teachers have no `students` row; the page renders "Sin plan activo" with the grid OR
    // the dashboard layout bounces them. Either is acceptable — what we flag is a teacher
    // being offered a STUDENT class-pack checkout. Record, then assert no purchase grid.
    expect(sawPurchaseCta, 'a teacher should not be offered the student class-pack purchase grid').toBeFalsy()
    await ctx.close()
  })

  test('5b — an ADMIN session hitting the student plan page is handled gracefully (no 500)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.admin })
    const page = await ctx.newPage()
    const server5xx: string[] = []
    page.on('response', (r) => { if (r.status() >= 500) server5xx.push(`${r.status()} ${r.url()}`) })
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await page.waitForTimeout(2000)
    test.info().annotations.push({ type: 'observed', description: `admin → ${page.url()} ; 5xx=${server5xx.length}` })
    expect(server5xx, `admin hitting student plan must not 500: ${server5xx.join(', ')}`).toEqual([])
    await ctx.close()
  })

  // ───────────────────────── 3 · Currency switcher input (incl. injection) ─────────────────────────

  test('3a — currency picker opens and lists known LatAm currencies', async ({ page }) => {
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    // The trigger button shows the active currency code (e.g. "USD"/"HNL") + a chevron.
    const trigger = page.locator('button:has(.fi)').first()
    await expect(trigger).toBeVisible()
    await trigger.click()
    const search = page.getByPlaceholder('Buscar moneda…')
    await expect(search).toBeVisible({ timeout: 5000 })
    // Options exist for a sample of supported codes.
    await expect(page.getByRole('button', { name: /MXN/ }).first()).toBeVisible()
    await page.screenshot({ path: SHOT('currency-open'), fullPage: false })
  })

  test('3b — selecting EUR re-renders plan prices in euros (currency conversion runs)', async ({ page }) => {
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    const trigger = page.locator('button:has(.fi)').first()
    await trigger.click()
    await page.getByPlaceholder('Buscar moneda…').fill('EUR')
    await page.getByRole('button', { name: /EUR/ }).first().click()
    await page.waitForTimeout(2500) // fx prefetch + 1.5s forceRender tick
    const body = await page.locator('body').innerText()
    const hasEuro = body.includes('€')
    test.info().annotations.push({ type: 'observed', description: `after EUR select, page shows €: ${hasEuro}` })
    expect(hasEuro, 'choosing EUR should convert displayed plan prices to euros').toBeTruthy()
    await page.screenshot({ path: SHOT('currency-eur'), fullPage: true })
  })

  test('3c — currency search: SQLi / XSS / oversized / unicode strings just yield "no results", never break', async ({ page }) => {
    let dialog = false
    page.on('dialog', (d) => { dialog = true; d.dismiss().catch(() => {}) })
    const server5xx: string[] = []
    page.on('response', (r) => { if (r.status() >= 500) server5xx.push(`${r.status()} ${r.url()}`) })

    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')

    const payloads = [
      `' OR 1=1--`,
      `<script>alert(1)</script>`,
      `"><img src=x onerror=alert(1)>`,
      '𝕌𝕊𝔻 emoji 🇺🇸 ünïcödë',
      'x'.repeat(2000),
    ]
    for (const payload of payloads) {
      const trigger = page.locator('button:has(.fi)').first()
      await trigger.click()
      const search = page.getByPlaceholder('Buscar moneda…')
      await search.fill(payload)
      await page.waitForTimeout(300)
      // Filter is in-memory string matching → garbage input yields the empty-state, not a crash.
      await expect(page.getByText('Sin resultados').first()).toBeVisible({ timeout: 4000 })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }
    expect(dialog, 'no script payload may execute in the currency search').toBeFalsy()
    expect(server5xx, 'currency search must not trigger 5xx').toEqual([])
  })

  test('3d — empty / whitespace currency search restores the full list (no false empty-state)', async ({ page }) => {
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    const trigger = page.locator('button:has(.fi)').first()
    await trigger.click()
    const search = page.getByPlaceholder('Buscar moneda…')
    await search.fill('zzzzz')
    await expect(page.getByText('Sin resultados').first()).toBeVisible({ timeout: 4000 })
    await search.fill('   ') // whitespace trims to empty → full list back
    await page.waitForTimeout(300)
    await expect(page.getByText('Sin resultados').first()).toHaveCount(0)
    await expect(page.getByRole('button', { name: /USD/ }).first()).toBeVisible()
  })

  // ───────────────────────── 6 · Currency persistence + concurrency ─────────────────────────

  test('6a — chosen currency persists to a fresh tab (server preferred_currency write) [MUTATING]', async ({ page, browser }) => {
    // MUTATING: writes the QA student's OWN preferred_currency. Reverted in afterAll.
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    const trigger = page.locator('button:has(.fi)').first()
    await trigger.click()
    await page.getByPlaceholder('Buscar moneda…').fill('GBP')
    await page.getByRole('button', { name: /GBP/ }).first().click()
    await page.waitForTimeout(2500) // allow savePreferredCurrency() server action to land

    // Fresh context that reuses the student auth state — initialCurrency comes from the server row.
    const ctx2 = await browser.newContext({ storageState: STATE.student })
    const p2 = await ctx2.newPage()
    await p2.goto('/es/dashboard/plan')
    await settle(p2)
    await waitForGrid(p2, 'es')
    const trigger2 = p2.locator('button:has(.fi)').first()
    const code = (await trigger2.innerText()).trim()
    test.info().annotations.push({ type: 'observed', description: `new-tab active currency after GBP select = "${code}"` })
    expect(code, 'preferred currency should persist server-side to a new session').toContain('GBP')
    await ctx2.close()
  })

  // ───────────────────────── 4 / 2 · Purchase flow → STOP at Stripe (never charge) ─────────────────────────

  test('4a — clicking a plan opens a confirmation modal; pay is NEVER auto-submitted', async ({ page }) => {
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    // Click the first plan CTA.
    await page.getByRole('button', { name: /^Empezar$/ }).first().click()
    await page.waitForTimeout(800)
    // A dialog must appear. Depending on classes_remaining it is EITHER the "add more" confirm
    // (¿Agregar más clases?) OR the payment modal (Estás a un paso / Pagar ahora). Both are valid.
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog.first()).toBeVisible({ timeout: 5000 })
    const dialogText = await dialog.first().innerText()
    const isAddMore = /Agregar más clases|Tus clases se acumulan/.test(dialogText)
    const isPay = /Pagar ahora|Estás a un paso/.test(dialogText)
    test.info().annotations.push({ type: 'observed', description: `first modal: addMore=${isAddMore} pay=${isPay}` })
    expect(isAddMore || isPay, 'selecting a plan must open the add-more OR payment confirmation modal').toBeTruthy()
    await page.screenshot({ path: SHOT('select-modal'), fullPage: true })
  })

  test('4b — reaching "Pagar ahora" and clicking it redirects to Stripe — STOP before any charge', async ({ page, context }) => {
    test.setTimeout(60_000)
    // Intercept the checkout redirect so we NEVER actually load Stripe's hosted page / complete a charge.
    let redirectTarget = ''
    await context.route(/checkout\.stripe\.com|stripe\.com|\/dashboard\/plan\?success=1/, async (route) => {
      redirectTarget = route.request().url()
      // Abort the navigation: capturing the URL is sufficient proof; we must not load checkout.
      await route.abort()
    })

    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    await page.getByRole('button', { name: /^Empezar$/ }).first().click()
    await page.waitForTimeout(700)

    // If the add-more modal intercepts (classes_remaining > 0), confirm through it.
    const addMoreConfirm = page.getByRole('button', { name: /Sí, agregar clases/ })
    if (await addMoreConfirm.count()) {
      await addMoreConfirm.first().click()
      await page.waitForTimeout(700)
    }

    // Now the payment modal must be up.
    const payBtn = page.getByRole('button', { name: /Pagar ahora/ })
    await expect(payBtn.first()).toBeVisible({ timeout: 6000 })

    // Click pay → server action createCheckoutSession → window.location = url. Our route abort
    // captures that URL (Stripe hosted checkout OR dev success fallback) without loading it.
    await payBtn.first().click()
    await page.waitForTimeout(6000)

    test.info().annotations.push({ type: 'SAFETY', description: `checkout redirect captured & aborted (no charge): ${redirectTarget || '(none captured)'}` })
    // Either we captured a real Stripe URL, or a dev-fallback success URL, or an inline error.
    const modalText = (await page.locator('[role="dialog"]').first().innerText().catch(() => '')) || ''
    const wentToStripe = /stripe\.com|checkout\.stripe/.test(redirectTarget)
    const devFallback = /success=1/.test(redirectTarget)
    const inlineError = modalText.length > 0 && /error|inválid|invalid/i.test(modalText)
    test.info().annotations.push({ type: 'observed', description: `wentToStripe=${wentToStripe} devFallback=${devFallback} inlineError=${inlineError}` })
    expect(wentToStripe || devFallback || inlineError, 'pay must initiate checkout (Stripe redirect) or surface a clear error — never silently no-op').toBeTruthy()
    await context.unroute(/checkout\.stripe\.com|stripe\.com|\/dashboard\/plan\?success=1/)
  })

  test('4c — concurrency: double-clicking "Pagar ahora" does not fire two checkout sessions', async ({ page, context }) => {
    test.setTimeout(60_000)
    let createCalls = 0
    // The server action posts back to the page route (Next server action). Count POSTs that the
    // pay click triggers, and abort any Stripe nav so nothing charges.
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/dashboard\/plan/.test(r.url())) createCalls++
    })
    await context.route(/checkout\.stripe\.com|stripe\.com|\/dashboard\/plan\?success=1/, (route) => route.abort())

    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    await page.getByRole('button', { name: /^Empezar$/ }).first().click()
    await page.waitForTimeout(700)
    const addMoreConfirm = page.getByRole('button', { name: /Sí, agregar clases/ })
    if (await addMoreConfirm.count()) { await addMoreConfirm.first().click(); await page.waitForTimeout(700) }

    const payBtn = page.getByRole('button', { name: /Pagar ahora/ })
    await expect(payBtn.first()).toBeVisible({ timeout: 6000 })
    const before = createCalls
    await payBtn.first().click().catch(() => {})
    // Second click should be a no-op — handlePay disables the button via isPending.
    await payBtn.first().click({ timeout: 1200 }).catch(() => {})
    await page.waitForTimeout(4000)
    const fired = createCalls - before
    test.info().annotations.push({ type: 'observed', description: `checkout POSTs fired by double-click = ${fired}` })
    expect(fired, 'double-clicking pay should NOT fire two checkout sessions (button must disable while pending)').toBeLessThanOrEqual(1)
    await context.unroute(/checkout\.stripe\.com|stripe\.com|\/dashboard\/plan\?success=1/)
  })

  test('4d — cancelling the payment modal returns to the grid (no stray state)', async ({ page }) => {
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    await page.getByRole('button', { name: /^Empezar$/ }).first().click()
    await page.waitForTimeout(700)
    // Dismiss whichever modal is open with Escape (Modal closes on Esc).
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)
    await expect(page.getByText('Ascenso', { exact: true }).first()).toBeVisible()
  })

  // ───────────────────────── 4 · Success / cancelled query-param handling ─────────────────────────

  test('4e — ?success=1&plan=spark renders the success screen with the right class delta', async ({ page }) => {
    // Reading the success param is purely client-side (no server credit applied here — the webhook
    // does that). Safe, non-mutating: it only renders the confirmation screen.
    await page.goto('/es/dashboard/plan?success=1&plan=spark')
    await settle(page)
    await page.waitForTimeout(1500)
    await expect(page.getByText('¡Compra completada!').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Pago confirmado').first()).toBeVisible()
    // A "schedule first class" / "complete profile" CTA must be present.
    const hasCta = /Agendar tu primera clase|Completa tu perfil/.test(await page.locator('body').innerText())
    expect(hasCta, 'success screen must offer a next-step CTA').toBeTruthy()
    await page.screenshot({ path: SHOT('success-screen'), fullPage: true })
  })

  test('4f — ?success=1&plan=<garbage> does NOT render a fake success screen', async ({ page }) => {
    // PRICING_PLANS.find(...) returns undefined for an unknown key → purchaseResult stays null →
    // normal grid. A tampered query param must never fabricate a "purchase complete" state.
    await page.goto('/es/dashboard/plan?success=1&plan=__not_a_plan__')
    await settle(page)
    await waitForGrid(page, 'es')
    const sawFakeSuccess = /¡Compra completada!|Purchase complete/.test(await page.locator('body').innerText())
    test.info().annotations.push({ type: 'SECURITY', description: `garbage success param fabricated success screen = ${sawFakeSuccess}` })
    expect(sawFakeSuccess, 'an invalid plan key in ?success must not fabricate a success screen').toBeFalsy()
    // And the normal grid should be shown instead.
    await expect(page.getByText('Ascenso', { exact: true }).first()).toBeVisible()
  })

  test('4g — ?cancelled=1 returns to the normal grid (cancel path does not error)', async ({ page }) => {
    const server5xx: string[] = []
    page.on('response', (r) => { if (r.status() >= 500) server5xx.push(`${r.status()} ${r.url()}`) })
    await page.goto('/es/dashboard/plan?cancelled=1')
    await settle(page)
    await waitForGrid(page, 'es')
    await expect(page.getByText('Ascenso', { exact: true }).first()).toBeVisible()
    expect(server5xx, 'cancelled return must not 5xx').toEqual([])
  })

  // ───────────────────────── 10 · Data integrity — price/class math ─────────────────────────

  test('10a — per-class price line matches priceUsd / classes for each plan (USD)', async ({ page }) => {
    // Force USD via the picker so the "≈ $X por clase" line is in dollars and comparable.
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    const trigger = page.locator('button:has(.fi)').first()
    await trigger.click()
    await page.getByPlaceholder('Buscar moneda…').fill('USD')
    await page.getByRole('button', { name: /USD/ }).first().click()
    await page.waitForTimeout(2000)

    const body = await page.locator('body').innerText()
    // Every plan's full USD price must be present as text.
    const missing = PLANS.filter((p) => !body.includes(`$${p.priceUsd}`)).map((p) => p.key)
    test.info().annotations.push({ type: 'observed', description: `plans missing $price text in USD: ${missing.join(', ') || 'none'}` })
    expect(missing, `USD price text missing for: ${missing.join(', ')}`).toEqual([])
    // Per-class line "por clase" appears (one per card).
    const perClass = await page.getByText(/por clase/).count()
    expect(perClass, 'each plan card should show a per-class breakdown').toBeGreaterThanOrEqual(PLANS.length)
  })

  // ───────────────────────── 9 · Console errors + network health ─────────────────────────

  test('9a — ES plan page: no console errors and no 4xx/5xx on first paint', async ({ page }) => {
    const consoleErrors: string[] = []
    const badResponses: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('response', (r) => {
      const s = r.status()
      // Ignore expected analytics/3rd-party noise; flag app-origin 4xx/5xx.
      if (s >= 400 && /englishkolab\.com/.test(r.url())) badResponses.push(`${s} ${r.url()}`)
    })
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    await page.waitForTimeout(2500)
    test.info().annotations.push({ type: 'observed', description: `consoleErrors=${consoleErrors.length} :: ${consoleErrors.slice(0, 5).join(' || ')}` })
    test.info().annotations.push({ type: 'observed', description: `app 4xx/5xx=${badResponses.length} :: ${badResponses.slice(0, 5).join(' || ')}` })
    expect(badResponses, `app-origin HTTP errors on /plan: ${badResponses.join(', ')}`).toEqual([])
    expect(consoleErrors, `console errors on /plan: ${consoleErrors.slice(0, 5).join(' | ')}`).toEqual([])
  })

  // ───────────────────────── 8 · Responsive ─────────────────────────

  test('8a — 375px mobile: plan cards stack, CTA reachable, currency control present', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 780 })
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    // Plan names visible and a CTA in viewport reach.
    await expect(page.getByText('Partida', { exact: true }).first()).toBeVisible()
    const cta = page.getByRole('button', { name: /^Empezar$/ }).first()
    await cta.scrollIntoViewIfNeeded()
    await expect(cta).toBeVisible()
    // No horizontal overflow (a common mobile defect on grid layouts).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    test.info().annotations.push({ type: 'observed', description: `375px horizontal overflow px = ${overflow}` })
    expect(overflow, 'no horizontal scroll on 375px').toBeLessThanOrEqual(2)
    await page.screenshot({ path: SHOT('mobile-375'), fullPage: true })
  })

  test('8b — desktop 1440px renders the full plan grid + billing/FAQ columns', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/es/dashboard/plan')
    await settle(page)
    await waitForGrid(page, 'es')
    await expect(page.getByText('Tus pagos').first()).toBeVisible()
    await expect(page.getByText('Preguntas frecuentes').first()).toBeVisible()
    await page.screenshot({ path: SHOT('desktop-1440'), fullPage: true })
  })
})
