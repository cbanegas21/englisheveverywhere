/**
 * EXHAUSTIVE — STUDENT · MY PROGRESS (/es|/en/dashboard/progreso)
 *
 * Surface source of truth:
 *   src/app/[lang]/dashboard/progreso/page.tsx       (server: auth + data fetch)
 *   src/app/[lang]/dashboard/progreso/ProgresoClient.tsx (render + i18n + plan name)
 *   src/app/[lang]/dashboard/layout.tsx              (role guard: teacher→maestro, admin→admin)
 *   src/components/ui/StatLedger.tsx                 (.lk-stat-kicker/.lk-stat-value/.lk-stat-sub)
 *   src/lib/pricing.ts                               (planName() → ES Partida/Trayecto/Ascenso/Cumbre)
 *
 * This page is READ-ONLY: no form inputs, no :id route param, the "Download
 * report (PDF)" button ships `disabled`. There is therefore NO mutating probe
 * in this file and no IDOR vector. The aggressive focus instead is:
 *   - plan name MUST localize (planName(key, lang)) — the headline regression risk
 *   - derived totals integrity (Hours == Classes count; thisMonth/planTotal bar)
 *   - empty / no-plan / no-level / no-placement states
 *   - role guard (teacher & admin must NOT see student progress content)
 *   - deep-link + refresh, ES/EN parity, 375px mobile, console + network hygiene
 *
 * Session: reuses the saved student storageState (NEVER logs in → no rate-limit
 * contention). Live target: https://englishkolab.com.
 *
 * Reference: tests/e2e/exhaustive-auth.spec.ts. NOT describe.serial (probes
 * expect failures; serial would abort the block on the first finding).
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, makeAdmin } from './_exhaustive/helpers'
// Relative import (not the @/ alias) — Playwright's tsconfig resolution does not
// register the Next.js path alias, and no other spec relies on it.
import { PRICING_PLANS } from '../../src/lib/pricing'

const db = makeAdmin()

// Collect console errors + 4xx/5xx network responses scoped to the page so any
// probe can assert hygiene. Ignore benign analytics/font noise patterns.
function watch(page: Page) {
  const consoleErrors: string[] = []
  const httpErrors: string[] = []
  page.on('console', m => {
    if (m.type() !== 'error') return
    const txt = m.text()
    if (/favicon|web-vitals|analytics|ERR_BLOCKED_BY_CLIENT|net::ERR/i.test(txt)) return
    consoleErrors.push(txt)
  })
  page.on('response', r => {
    const s = r.status()
    if (s < 400) return
    const u = r.url()
    if (/favicon|analytics|vitals|\.(?:woff2?|png|jpg|svg|ico)/i.test(u)) return
    httpErrors.push(`${s} ${u}`)
  })
  return { consoleErrors, httpErrors }
}

// The student plan-progress page heading is the source-of-truth render signal.
const HEADING = { es: /Mi progreso/i, en: /My progress/i }

test.describe('EXHAUSTIVE · student · my-progress', () => {
  test.use({ storageState: STATE.student })

  // ───────────────────────── 1 · Happy-path render ─────────────────────────

  test('1A — /es renders the My-Progress shell (heading, subtitle, stat ledger)', async ({ page }) => {
    const { consoleErrors } = watch(page)
    await page.goto('/es/dashboard/progreso')
    await settle(page)

    await expect(page.getByRole('heading', { name: HEADING.es, level: 1 })).toBeVisible()
    await expect(page.getByText(/Cómo has avanzado desde que empezaste/i)).toBeVisible()

    // The editorial StatLedger always renders 4 stats. Kickers are localized.
    const kickers = page.locator('.lk-stat-kicker')
    await expect(kickers).toHaveCount(4)
    const kickerText = (await kickers.allInnerTexts()).join(' | ')
    test.info().annotations.push({ type: 'observed', description: `ES stat kickers: ${kickerText}` })
    // Spanish kickers from t.es.stats — must NOT be the English set.
    await expect(page.locator('.lk-stat-kicker', { hasText: /^Clases$/ })).toBeVisible()
    await expect(page.locator('.lk-stat-kicker', { hasText: /^Disponibles$/ })).toBeVisible()
    await expect(page.locator('.lk-stat-kicker', { hasText: /^Agendadas$/ })).toBeVisible()

    await page.screenshot({ path: 'test-results/exhaustive-student-progreso-render-es.png', fullPage: true })
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  })

  test('1B — stat ledger values are integers and the 4 sublabels render', async ({ page }) => {
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    const values = await page.locator('.lk-stat-value').allInnerTexts()
    test.info().annotations.push({ type: 'observed', description: `ES stat values: ${values.join(' | ')}` })
    expect(values.length, 'four ledger values').toBe(4)
    // Each value is either an integer (Clases/Disponibles/Agendadas) or "<n>h" (Horas).
    for (const v of values) {
      expect(v.trim(), `value "${v}" should be an integer or Nh`).toMatch(/^\d+h?$/)
    }
    await expect(page.locator('.lk-stat-sub')).toHaveCount(4)
  })

  // ───────────────────────── 2 · Entry / nav / refresh / role guard ─────────────────────────

  test('2A — deep-link straight to /es/dashboard/progreso (no nav) renders content', async ({ page }) => {
    await page.goto('/es/dashboard/progreso', { waitUntil: 'domcontentloaded' })
    await settle(page)
    await expect(page.getByRole('heading', { name: HEADING.es, level: 1 })).toBeVisible()
  })

  test('2B — hard refresh preserves the rendered surface', async ({ page }) => {
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    await page.reload()
    await settle(page)
    await expect(page.getByRole('heading', { name: HEADING.es, level: 1 })).toBeVisible()
    // Plan section heading must survive refresh (no flash-then-blank).
    await expect(page.getByText(/Plan actual/i)).toBeVisible()
  })

  test('2C — teacher hitting /es/dashboard/progreso is bounced and never sees progress content', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    await page.waitForTimeout(2500) // let the layout role-guard redirect resolve
    // Content is source of truth (URL may briefly read /dashboard mid-redirect).
    await expect(page.getByText(/Cómo has avanzado desde que empezaste/i)).toHaveCount(0)
    await expect(page.locator('.lk-stat-kicker', { hasText: /^Disponibles$/ })).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `teacher → ${page.url()}` })
    await ctx.close()
  })

  test('2D — admin hitting /es/dashboard/progreso is bounced and never sees progress content', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.admin })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    await page.waitForTimeout(2500)
    await expect(page.getByText(/Cómo has avanzado desde que empezaste/i)).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `admin → ${page.url()}` })
    await ctx.close()
  })

  test('2E — logged-out deep-link is guarded to /login (no progress leak)', async ({ browser }) => {
    const ctx = await browser.newContext() // no storageState → anonymous
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    await expect(page.getByText(/Cómo has avanzado desde que empezaste/i)).toHaveCount(0)
    // Positive proof we landed on the login form, not a blank/leaked shell.
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 15_000 })
    test.info().annotations.push({ type: 'observed', description: `anon → ${page.url()}` })
    await ctx.close()
  })

  // ───────────────────────── 3 · "Input" surface (URL/query injection) ─────────────────────────
  // No form inputs on this page. The only attacker-controlled inputs reaching
  // render are (a) the URL/query string and (b) the student's own survey_answers.
  // Probe both for reflection / XSS / crash.

  test('3A — junk query string + XSS param does not execute or 500 the page', async ({ page }) => {
    let dialog = false
    page.on('dialog', d => { dialog = true; d.dismiss().catch(() => {}) })
    const errors: string[] = []
    page.on('response', r => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`) })
    await page.goto(`/es/dashboard/progreso?x=<script>alert(1)</script>&y=' OR 1=1--&z=${'A'.repeat(4000)}`)
    await settle(page)
    expect(dialog, 'no script execution from query string').toBeFalsy()
    expect(errors, 'no 5xx on hostile query string').toEqual([])
    await expect(page.getByRole('heading', { name: HEADING.es, level: 1 })).toBeVisible()
    const liveScript = await page.locator('script:has-text("alert(1)")').count()
    expect(liveScript, 'XSS param must not become live markup').toBe(0)
  })

  test('3B — bogus /es/dashboard/progreso/extra/path segment does not render the surface as a false-positive', async ({ page }) => {
    const res = await page.goto('/es/dashboard/progreso/not-a-real-subpath')
    await settle(page)
    // Either a 404 chrome or a redirect — but it must NOT render the progress heading.
    const status = res?.status() ?? 0
    const headingCount = await page.getByRole('heading', { name: HEADING.es, level: 1 }).count()
    test.info().annotations.push({ type: 'observed', description: `sub-path status=${status}; progress-heading=${headingCount}` })
    expect(headingCount, 'a non-existent sub-path must not render the progress surface').toBe(0)
  })

  // ───────────────────────── 4 · Empty / fallback states ─────────────────────────

  test('4A — level hero shows a real CEFR level OR the localized Pendiente fallback (never blank/EN-on-ES)', async ({ page }) => {
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    // The kicker "Nivel actual" is always present.
    await expect(page.getByText(/Nivel actual/i)).toBeVisible()
    const body = (await page.locator('body').innerText())
    const hasRealLevel = /\b(A0|A1|A2|B1|B2|C1|C2)\b/.test(body)
    const hasEsPending = /Pendiente/.test(body)
    const hasEnPendingOnEs = /\bPending\b/.test(body)
    test.info().annotations.push({ type: 'observed', description: `realLevel=${hasRealLevel}; esPending=${hasEsPending}; enPendingLeak=${hasEnPendingOnEs}` })
    expect(hasRealLevel || hasEsPending, 'level hero must show a CEFR level or the ES "Pendiente" fallback').toBeTruthy()
    expect(hasEnPendingOnEs && !hasEsPending, 'English "Pending" must not leak onto the ES page').toBeFalsy()
  })

  test('4B — timeline shows either real classes or the localized empty state, not a broken list', async ({ page }) => {
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    await expect(page.getByText(/Clases recientes/i)).toBeVisible() // section title always present
    const items = page.locator('section ul li')
    const count = await items.count()
    if (count === 0) {
      await expect(page.getByText(/Tu viaje empieza aquí/i)).toBeVisible()
    } else {
      test.info().annotations.push({ type: 'observed', description: `recent classes rendered: ${count} (capped at 8)` })
      expect(count, 'timeline is limit(8) in page.tsx').toBeLessThanOrEqual(8)
    }
  })

  test('4C — plan card shows a localized plan name OR the localized no-plan CTA', async ({ page }) => {
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    await expect(page.getByText(/Plan actual/i)).toBeVisible()
    const body = await page.locator('body').innerText()
    const noPlan = /Sin plan activo/.test(body)
    if (noPlan) {
      await expect(page.getByRole('link', { name: /Obtén tu primer plan/i })).toBeVisible()
    } else {
      // A plan IS active → its localized ES name must be present (not the EN one — see 7C).
      const esNames = PRICING_PLANS.map(p => p.nameEs)
      const shown = esNames.filter(n => new RegExp(`\\b${n}\\b`).test(body))
      test.info().annotations.push({ type: 'observed', description: `active-plan ES names matched: ${shown.join(', ') || 'NONE'}` })
      expect(shown.length, 'an active plan must display its localized (ES) name').toBeGreaterThan(0)
    }
  })

  // ───────────────────────── 5 · Data integrity (derived values) ─────────────────────────

  test('5A — Hours stat is derived from Classes count (Nh == Classes), per ProgresoClient', async ({ page }) => {
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    const stats = page.locator('.lk-statledger .lk-stat')
    // Order is fixed in ProgresoClient: [Clases, Horas, Disponibles, Agendadas].
    const classesVal = (await stats.nth(0).locator('.lk-stat-value').innerText()).trim()
    const hoursVal = (await stats.nth(1).locator('.lk-stat-value').innerText()).trim()
    test.info().annotations.push({ type: 'observed', description: `Clases=${classesVal} Horas=${hoursVal}` })
    // hours value renders as `${completedTotal}h` → must equal classes + "h".
    expect(hoursVal, 'Hours = Classes count + "h" (1h per class assumption in source)').toBe(`${classesVal}h`)
  })

  test('5B — "This month" progress never exceeds the plan total (bar clamped 0–100%)', async ({ page }) => {
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    const body = await page.locator('body').innerText()
    if (/Sin plan activo/.test(body)) {
      test.skip(true, 'no active plan → no monthly progress bar to verify')
      return
    }
    // The plan card renders "<completedThisMonth>/<planTotal>" — parse and bound-check.
    const m = body.match(/Este mes[\s\S]{0,40}?(\d+)\s*\/\s*(\d+)/)
    test.info().annotations.push({ type: 'observed', description: `this-month fraction match: ${m ? `${m[1]}/${m[2]}` : 'NOT FOUND'}` })
    if (m) {
      const done = Number(m[1]); const total = Number(m[2])
      expect(total, 'plan total > 0').toBeGreaterThan(0)
      expect(done, 'completedThisMonth must not exceed the pack total').toBeLessThanOrEqual(total)
    }
  })

  test('5C — DB cross-check: rendered plan name matches students.current_plan localized', async ({ page }) => {
    test.skip(!db, 'service-role key required for DB cross-check')
    const email = process.env.E2E_STUDENT_EMAIL || 'student@englishkolab.com'
    // Resolve the student's current_plan straight from the DB.
    const { data: prof } = await db!.from('profiles').select('id').eq('email', email).maybeSingle()
    let currentPlan: string | null = null
    if (prof?.id) {
      const { data: stu } = await db!.from('students').select('current_plan').eq('profile_id', prof.id).maybeSingle()
      currentPlan = (stu?.current_plan as string) ?? null
    }
    test.info().annotations.push({ type: 'observed', description: `DB current_plan=${currentPlan ?? 'null'}` })

    await page.goto('/es/dashboard/progreso')
    await settle(page)
    const body = await page.locator('body').innerText()
    if (!currentPlan) {
      expect(/Sin plan activo/.test(body), 'no DB plan → page should show the no-plan state').toBeTruthy()
    } else {
      const plan = PRICING_PLANS.find(p => p.key === currentPlan)
      if (plan) {
        expect(new RegExp(`\\b${plan.nameEs}\\b`).test(body), `plan ${currentPlan} should show ES name "${plan.nameEs}"`).toBeTruthy()
      } else {
        test.info().annotations.push({ type: 'observed', description: `current_plan "${currentPlan}" not in PRICING_PLANS — renders raw key` })
      }
    }
  })

  // ───────────────────────── 6 · State / concurrency ─────────────────────────

  test('6A — two tabs on the surface render consistent stat values (read-only, no divergence)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.student })
    const [a, b] = [await ctx.newPage(), await ctx.newPage()]
    await a.goto('/es/dashboard/progreso'); await settle(a)
    await b.goto('/es/dashboard/progreso'); await settle(b)
    const va = (await a.locator('.lk-stat-value').allInnerTexts()).join('|')
    const vb = (await b.locator('.lk-stat-value').allInnerTexts()).join('|')
    test.info().annotations.push({ type: 'observed', description: `tabA=${va} tabB=${vb}` })
    expect(va, 'two concurrent tabs read identical (no mutating action here)').toBe(vb)
    await ctx.close()
  })

  test('6B — "Download report (PDF)" button is disabled (not yet wired) and inert', async ({ page }) => {
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    const btn = page.getByRole('button', { name: /Descargar informe \(PDF\)/i })
    await expect(btn).toBeVisible()
    await expect(btn).toBeDisabled()
    // Clicking a disabled button must not navigate / throw.
    await btn.click({ force: true }).catch(() => {})
    await expect(page.getByRole('heading', { name: HEADING.es, level: 1 })).toBeVisible()
  })

  // ───────────────────────── 7 · i18n ES + EN parity ─────────────────────────

  test('7A — /en renders the English My-Progress strings (no ES leakage)', async ({ page }) => {
    await page.goto('/en/dashboard/progreso')
    await settle(page)
    await expect(page.getByRole('heading', { name: HEADING.en, level: 1 })).toBeVisible()
    await expect(page.getByText(/How you have improved since you started/i)).toBeVisible()
    await expect(page.locator('.lk-stat-kicker', { hasText: /^Classes$/ })).toBeVisible()
    await expect(page.locator('.lk-stat-kicker', { hasText: /^Available$/ })).toBeVisible()
    // The ES title must NOT appear on the EN page.
    const body = await page.locator('body').innerText()
    expect(/Mi progreso|Cómo has avanzado/.test(body), 'no Spanish strings leaking onto /en').toBeFalsy()
    await page.screenshot({ path: 'test-results/exhaustive-student-progreso-render-en.png', fullPage: true })
  })

  test('7B — section labels are localized: "Plan actual"/"Current plan" + "Clases recientes"/"Recent classes"', async ({ page }) => {
    await page.goto('/es/dashboard/progreso'); await settle(page)
    const es = await page.locator('body').innerText()
    expect(/Plan actual/.test(es) && /Clases recientes/.test(es), 'ES section labels present').toBeTruthy()
    expect(/Current plan|Recent classes/.test(es), 'EN section labels must NOT appear on /es').toBeFalsy()

    await page.goto('/en/dashboard/progreso'); await settle(page)
    const en = await page.locator('body').innerText()
    expect(/Current plan/.test(en) && /Recent classes/.test(en), 'EN section labels present').toBeTruthy()
    expect(/Plan actual|Clases recientes/.test(en), 'ES section labels must NOT appear on /en').toBeFalsy()
  })

  test('7C — HEADLINE: an active plan name LOCALIZES between ES and EN (planName, not EN-only)', async ({ page }) => {
    // Read ES first.
    await page.goto('/es/dashboard/progreso'); await settle(page)
    const esBody = await page.locator('body').innerText()
    if (/Sin plan activo/.test(esBody)) {
      test.skip(true, 'QA student has no active plan → plan-name localization not observable on this account')
      return
    }
    const esName = PRICING_PLANS.find(p => new RegExp(`\\b${p.nameEs}\\b`).test(esBody))
    // Cast to string: the literal `as const` unions never overlap at the type
    // level, but the guard is intentional defensive runtime logic.
    const differs = (en: string, es: string) => en !== es
    const enLeakOnEs = PRICING_PLANS.find(p => differs(p.nameEn, p.nameEs) && new RegExp(`\\b${p.nameEn}\\b`).test(esBody))
    test.info().annotations.push({ type: 'observed', description: `ES plan shown=${esName?.nameEs ?? 'none'}; EN-name-leak-on-ES=${enLeakOnEs?.nameEn ?? 'none'}` })
    expect(esName, 'ES page must show a localized (Spanish) plan name').toBeTruthy()
    // The defining bug to catch: EN plan name (e.g. "Departure") shown on the ES page.
    if (esName && differs(esName.nameEn, esName.nameEs)) {
      expect(new RegExp(`\\b${esName.nameEn}\\b`).test(esBody), `ES page must NOT show the English plan name "${esName.nameEn}" instead of "${esName.nameEs}"`).toBeFalsy()
    }

    // Read EN and confirm the SAME plan key now shows the English name.
    await page.goto('/en/dashboard/progreso'); await settle(page)
    const enBody = await page.locator('body').innerText()
    if (esName) {
      expect(new RegExp(`\\b${esName.nameEn}\\b`).test(enBody), `EN page must show "${esName.nameEn}" for the same plan`).toBeTruthy()
      if (differs(esName.nameEn, esName.nameEs)) {
        expect(new RegExp(`\\b${esName.nameEs}\\b`).test(enBody), `EN page must NOT show the Spanish plan name "${esName.nameEs}"`).toBeFalsy()
      }
    }
  })

  test('7D — CEFR level LABEL localizes (e.g. Intermedio vs Intermediate) when a level is set', async ({ page }) => {
    await page.goto('/es/dashboard/progreso'); await settle(page)
    const esBody = await page.locator('body').innerText()
    const hasLevel = /\b(A0|A1|A2|B1|B2|C1|C2)\b/.test(esBody)
    if (!hasLevel) { test.skip(true, 'QA student has no assessed level → label localization not observable'); return }
    // English level labels that should never appear on the ES page (distinct from ES).
    const enOnlyLabels = /\b(Complete beginner|Elementary|Upper intermediate|Mastery)\b/
    const leaked = enOnlyLabels.test(esBody)
    test.info().annotations.push({ type: 'observed', description: `EN level-label leak on ES = ${leaked}` })
    expect(leaked, 'English CEFR level label must not leak onto the ES page').toBeFalsy()
  })

  // ───────────────────────── 8 · Responsive ─────────────────────────

  test('8A — 375px mobile: heading + 4 stats stay in the layout, no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    await expect(page.getByRole('heading', { name: HEADING.es, level: 1 })).toBeVisible()
    await expect(page.locator('.lk-stat-value')).toHaveCount(4)
    // StatLedger collapses to a 2-col grid at ≤720px — verify no body overflow.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    test.info().annotations.push({ type: 'observed', description: `horizontal overflow px = ${overflow}` })
    expect(overflow, 'no meaningful horizontal scroll at 375px').toBeLessThanOrEqual(2)
    await page.screenshot({ path: 'test-results/exhaustive-student-progreso-mobile.png', fullPage: true })
  })

  test('8B — desktop 1440px: 2-column timeline/aside layout renders both columns', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    await expect(page.getByText(/Clases recientes/i)).toBeVisible() // left column
    await expect(page.getByText(/Plan actual/i)).toBeVisible()       // right column
    await expect(page.getByText(/Tu perfil de aprendizaje/i)).toBeVisible() // profile card
  })

  // ───────────────────────── 9 · Console / network hygiene ─────────────────────────

  test('9A — no console errors and no 4xx/5xx on the page load (ES)', async ({ page }) => {
    const { consoleErrors, httpErrors } = watch(page)
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    await expect(page.getByRole('heading', { name: HEADING.es, level: 1 })).toBeVisible()
    await page.waitForTimeout(1500)
    test.info().annotations.push({ type: 'observed', description: `console=${consoleErrors.length}; http=${httpErrors.length}\n${[...consoleErrors, ...httpErrors].join('\n')}` })
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([])
    expect(httpErrors, `4xx/5xx responses:\n${httpErrors.join('\n')}`).toEqual([])
  })

  test('9B — no console errors and no 4xx/5xx on the page load (EN)', async ({ page }) => {
    const { consoleErrors, httpErrors } = watch(page)
    await page.goto('/en/dashboard/progreso')
    await settle(page)
    await expect(page.getByRole('heading', { name: HEADING.en, level: 1 })).toBeVisible()
    await page.waitForTimeout(1500)
    test.info().annotations.push({ type: 'observed', description: `console=${consoleErrors.length}; http=${httpErrors.length}\n${[...consoleErrors, ...httpErrors].join('\n')}` })
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([])
    expect(httpErrors, `4xx/5xx responses:\n${httpErrors.join('\n')}`).toEqual([])
  })

  // ───────────────────────── 10 · A11y / structure sanity ─────────────────────────

  test('10A — exactly one H1, and it is the page title', async ({ page }) => {
    await page.goto('/es/dashboard/progreso')
    await settle(page)
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toHaveCount(1)
    await expect(h1).toHaveText(HEADING.es)
  })
})
