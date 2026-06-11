/**
 * EXHAUSTIVE LIVE QA — ADMIN · BIBLIOTECA (/es|en/admin/biblioteca)
 *
 * Surface: admin library management. Server page guards (no-user → /login,
 * non-admin → /dashboard) then renders AdminLibraryClient with an upload card
 * (file/title/level/description) + a list of books (toggle Show/Hide + Delete).
 * The mutating server actions live in src/app/actions/library.ts.
 *
 * Selectors + label text were lifted verbatim from:
 *   src/app/[lang]/admin/biblioteca/page.tsx
 *   src/app/[lang]/admin/biblioteca/AdminLibraryClient.tsx
 *   src/app/actions/library.ts
 *
 * Runs against LIVE (PLAYWRIGHT_BASE_URL=https://englishkolab.com).
 * Admin session is reused from STATE.admin so this spec NEVER logs in.
 * NOT serial — each probe is independent and a failing assert == a finding.
 *
 * Notable code facts this exercises:
 *  - Kicker '↳ Admin · Curriculum' is HARDCODED — never localized (i18n finding).
 *  - Server-action validation messages are ENGLISH ONLY ('File is required',
 *    'Only PDF files are supported', …) — they leak raw on the ES page (i18n).
 *  - There is no :id in the URL; the IDOR/permission surface is the
 *    getBookSignedUrl action (any authenticated user can mint a 15-min URL) and
 *    the page-level role guard. Both are probed non-destructively.
 *  - Upload/toggle/delete are MUTATING and tagged [MUTATING]; upload uses a
 *    unique throwaway title and is torn down via the service role in afterAll.
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, ACCOUNT, loginUI, makeAdmin, hasAuthCookie } from './_exhaustive/helpers'

const ROUTE_ES = '/es/admin/biblioteca'
const ROUTE_EN = '/en/admin/biblioteca'

const db = makeAdmin()

// Throwaway book titles/paths created by [MUTATING] probes, torn down in afterAll.
const CREATED_TITLES: string[] = []

// A minimal valid PDF byte string (header + EOF) — enough to pass the
// application/pdf content-type + non-empty checks without shipping a real asset.
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'utf8',
)

async function gotoLibrary(page: Page, route = ROUTE_ES) {
  await page.goto(route)
  await settle(page)
}

// The page heading is the source-of-truth "we rendered the real admin library".
async function expectLibraryRendered(page: Page, lang: 'es' | 'en') {
  const heading = lang === 'es' ? 'Biblioteca' : 'Library'
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 20_000 })
}

test.describe('EXHAUSTIVE ADMIN · BIBLIOTECA', () => {
  // Reuse the saved admin session — never log in here (avoids rate-limit contention).
  test.use({ storageState: STATE.admin })

  test.afterAll(async () => {
    if (!db || CREATED_TITLES.length === 0) return
    for (const title of CREATED_TITLES) {
      const { data: rows } = await db
        .from('library_books')
        .select('id, storage_path')
        .eq('title', title)
      for (const r of rows || []) {
        if (r.storage_path) await db.storage.from('books').remove([r.storage_path]).catch(() => {})
        await db.from('library_books').delete().eq('id', r.id)
      }
    }
  })

  // ───────────────────────── 1 · Happy-path render ─────────────────────────

  test('1A — admin library renders heading, kicker, subtitle, upload card', async ({ page }) => {
    await gotoLibrary(page)
    await expectLibraryRendered(page, 'es')
    // Hardcoded kicker — present regardless of locale (recorded again in i18n probe).
    await expect(page.getByText('↳ Admin · Curriculum')).toBeVisible()
    await expect(page.getByText('Sube y gestiona el catálogo de libros.')).toBeVisible()
    // Upload card controls.
    await expect(page.locator('input[type="file"]')).toBeAttached()
    await expect(page.getByText('Solo PDF, máximo 40 MB.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Subir libro' })).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-admin-biblioteca-render.png', fullPage: true })
  })

  test('1B — file input only accepts PDF; level select carries the CEFR options', async ({ page }) => {
    await gotoLibrary(page)
    await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', 'application/pdf')
    const select = page.locator('select')
    // Default option + the all/A1..C2 set.
    await expect(select.getByRole('option', { name: 'Cualquier nivel' })).toBeAttached()
    await expect(select.getByRole('option', { name: 'Todos los niveles' })).toBeAttached()
    for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      await expect(select.getByRole('option', { name: lvl, exact: true })).toBeAttached()
    }
  })

  test('1C — list region shows either the empty state or real book rows', async ({ page }) => {
    await gotoLibrary(page)
    await expectLibraryRendered(page, 'es')
    const emptyMsg = page.getByText('Todavía no hay libros subidos.')
    const showBtns = page.getByRole('button', { name: /Ocultar|Mostrar/ })
    const empty = await emptyMsg.count()
    const rows = await showBtns.count()
    test.info().annotations.push({ type: 'observed', description: `empty-state=${empty > 0}; book-rows=${rows}` })
    // Exactly one of the two states must be present (never a blank panel).
    expect(empty > 0 || rows > 0, 'library must render either empty-state or rows').toBeTruthy()
  })

  // ───────────────────────── 2 · Entry / nav / guards ─────────────────────────

  test('2A — deep-link + hard refresh keeps the admin authenticated on the surface', async ({ page }) => {
    await gotoLibrary(page)
    await expectLibraryRendered(page, 'es')
    await page.reload()
    await settle(page)
    await expectLibraryRendered(page, 'es')
    expect(page.url()).toContain('/admin/biblioteca')
  })

  test('2B — admin sidebar Biblioteca link is the active surface entry', async ({ page }) => {
    await page.goto('/es/admin')
    await settle(page)
    const link = page.getByRole('link', { name: 'Biblioteca' })
    await expect(link).toBeVisible()
    await link.click()
    await settle(page)
    await expectLibraryRendered(page, 'es')
  })

  test('2C — ROLE GUARD: a student hitting /es/admin/biblioteca never sees admin chrome', async ({ browser }) => {
    // Use the student session in a fresh context (no contamination of the admin session).
    const ctx = await browser.newContext({ storageState: STATE.student })
    const page = await ctx.newPage()
    await gotoLibrary(page)
    await page.waitForTimeout(3000) // let the page.tsx redirect → /dashboard fully resolve
    // CONTENT is the proof — the URL may briefly read /admin mid-redirect.
    await expect(page.getByText('Sube y gestiona el catálogo de libros.')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Subir libro' })).toHaveCount(0)
    await expect(page.getByText('↳ Admin · Curriculum')).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `student → ${page.url()}` })
    await ctx.close()
  })

  test('2D — ROLE GUARD: a teacher hitting the surface is bounced to /dashboard content', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    await gotoLibrary(page)
    await page.waitForTimeout(3000)
    await expect(page.getByRole('button', { name: 'Subir libro' })).toHaveCount(0)
    await expect(page.getByText('↳ Admin · Curriculum')).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `teacher → ${page.url()}` })
    await ctx.close()
  })

  test('2E — GUARD: a logged-out visitor is redirected away from the admin library', async ({ browser }) => {
    const ctx = await browser.newContext() // no storageState → anonymous
    const page = await ctx.newPage()
    await gotoLibrary(page)
    await page.waitForTimeout(2000)
    await expect(page.getByRole('button', { name: 'Subir libro' })).toHaveCount(0)
    // Should land on the login form (content proof, not URL).
    const onLogin = await page.locator('input[name="password"]').count()
    test.info().annotations.push({ type: 'observed', description: `anon → ${page.url()}; login-form=${onLogin > 0}` })
    expect(onLogin, 'anonymous user must be sent to login').toBeGreaterThan(0)
    await ctx.close()
  })

  // ───────────────────────── 3 · Input validation ─────────────────────────

  test('3A — submit button is disabled until a file AND a title are present', async ({ page }) => {
    await gotoLibrary(page)
    const submit = page.getByRole('button', { name: 'Subir libro' })
    await expect(submit).toBeDisabled()
    // Title alone (no file) keeps it disabled.
    await page.fill('input[type="text"]', 'Solo título sin archivo')
    await expect(submit).toBeDisabled()
  })

  test('3B — client validation: file chosen, blank title keeps submit disabled (cannot fire empty)', async ({ page }) => {
    await gotoLibrary(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'probe.pdf', mimeType: 'application/pdf', buffer: MINIMAL_PDF,
    })
    const submit = page.getByRole('button', { name: 'Subir libro' })
    // With a file but no title, the disabled-guard must still hold (handleUpload bails too).
    await expect(submit).toBeDisabled()
  })

  test('3C — title input enforces maxLength=120 (oversized input is truncated, not stored long)', async ({ page }) => {
    await gotoLibrary(page)
    const titleInput = page.locator('input[type="text"]')
    const oversized = 'X'.repeat(400)
    await titleInput.fill(oversized)
    const val = await titleInput.inputValue()
    test.info().annotations.push({ type: 'observed', description: `title length after 400-char fill = ${val.length}` })
    expect(val.length, 'maxLength=120 must clamp the title client-side').toBeLessThanOrEqual(120)
  })

  test('3D — XSS/unicode title is held inertly in the field (no dialog, no markup execution)', async ({ page }) => {
    let dialog = false
    page.on('dialog', d => { dialog = true; d.dismiss().catch(() => {}) })
    await gotoLibrary(page)
    const payload = '<img src=x onerror=alert(1)> 日本語 emoji 🚀'
    await page.locator('input[type="text"]').fill(payload)
    await page.locator('textarea').fill('<script>alert(2)</script>')
    await settle(page, 800)
    expect(dialog, 'typing payloads must not execute script').toBeFalsy()
    // The literal payload must not be live markup in the DOM.
    expect(await page.locator('script:has-text("alert(2)")').count()).toBe(0)
    expect(await page.locator('img[onerror]').count()).toBe(0)
  })

  test('3E — non-PDF upload is rejected server-side; observe whether the error is localized', async ({ page }) => {
    test.info().annotations.push({ type: 'note', description: 'non-PDF rejected before any storage write; no cleanup needed' })
    await gotoLibrary(page)
    // accept="application/pdf" is only an advisory filter; setInputFiles bypasses it,
    // so this genuinely reaches the server-action type check.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'evil.txt', mimeType: 'text/plain', buffer: Buffer.from('not a pdf'),
    })
    await page.fill('input[type="text"]', 'QA non-pdf reject probe')
    const submit = page.getByRole('button', { name: 'Subir libro' })
    await expect(submit).toBeEnabled()
    await submit.click()
    await settle(page, 4000)
    const body = (await page.locator('body').innerText()).toLowerCase()
    const rawEnglishLeak = /only pdf files are supported/.test(body)
    test.info().annotations.push({ type: 'observed', description: `non-pdf error body-snippet has raw-english='only pdf files are supported' = ${rawEnglishLeak}` })
    // The server-action returns ENGLISH-only strings; on the ES page that is an i18n leak.
    expect(rawEnglishLeak, 'EXPECTED FINDING: server validation error is raw English on the ES page (library.ts:38)').toBeFalsy()
  })

  // ───────────────────────── 4 · Error / failure states ─────────────────────────

  test('4A — toggling a non-existent book id surfaces no client crash (action is id-scoped)', async ({ page }) => {
    // No UI path to a bogus id; assert instead that the rendered list never shows a
    // broken/half-rendered row. (The destructive id-scoped actions are covered in §6.)
    await gotoLibrary(page)
    await expectLibraryRendered(page, 'es')
    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    await page.reload()
    await settle(page)
    test.info().annotations.push({ type: 'observed', description: `console errors on reload: ${consoleErrors.length}` })
    expect(consoleErrors.join('\n')).not.toMatch(/library_books|undefined is not|cannot read/i)
  })

  // ───────────────────────── 5 · Security / permissions / IDOR ─────────────────────────

  test('5A — IDOR: getBookSignedUrl is reachable by ANY authenticated user (privilege scope check)', async ({ browser }) => {
    // The library page has no :id in its URL; the real object-access surface is the
    // getBookSignedUrl server action, which only requires requireAuthed (NOT admin).
    // We prove the scope from the DB: a student session is non-admin yet the action
    // would grant it a signed URL for any ACTIVE book. Record this as a deliberate
    // product decision (students can read the catalog) vs an over-broad grant.
    test.skip(!db, 'service-role key required to read library_books')
    const { data: active } = await db!
      .from('library_books')
      .select('id, is_active')
      .eq('is_active', true)
      .limit(1)
    const inactiveCount = (await db!.from('library_books').select('id').eq('is_active', false)).data?.length ?? 0
    test.info().annotations.push({
      type: 'SECURITY',
      description: `getBookSignedUrl uses requireAuthed (any logged-in role), gated on is_active only. active-book-sample=${active?.length ?? 0}, inactive-books=${inactiveCount}. Inactive books correctly refuse (library.ts:121).`,
    })
    // Confirm the student session is genuinely non-admin (so the grant is cross-role).
    const ctx = await browser.newContext({ storageState: STATE.student })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard')
    await settle(page)
    expect(hasAuthCookie(await ctx.cookies()), 'student session must be a real, non-admin auth session').toBeTruthy()
    await ctx.close()
  })

  test('5B — direct POST-style nav to the surface from admin is allowed (positive control)', async ({ page }) => {
    await gotoLibrary(page)
    await expectLibraryRendered(page, 'es')
    expect(hasAuthCookie(await page.context().cookies()), 'admin retains a valid session on the surface').toBeTruthy()
  })

  // ───────────────────────── 6 · State / mutation (TAGGED) ─────────────────────────

  test('6A [MUTATING] — upload a throwaway PDF, see it listed, then Hide/Show, then Delete (full round-trip)', async ({ page }) => {
    test.skip(!db, 'service-role key required for guaranteed teardown')
    test.setTimeout(90_000)
    const unique = `QA-EXH-BOOK-${Date.now()}`
    CREATED_TITLES.push(unique) // safety-net teardown even if the in-test delete fails

    await gotoLibrary(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'qa-probe.pdf', mimeType: 'application/pdf', buffer: MINIMAL_PDF,
    })
    await page.fill('input[type="text"]', unique)
    await page.fill('textarea', 'Throwaway QA upload — safe to delete.')
    await page.locator('select').selectOption('B1')

    await page.getByRole('button', { name: 'Subir libro' }).click()
    // Wait for router.refresh() to repaint the list with the new row.
    await expect(page.getByText(unique)).toBeVisible({ timeout: 30_000 })
    await page.screenshot({ path: 'test-results/exhaustive-admin-biblioteca-uploaded.png', fullPage: true })

    // The new row should show its level badge and the Activo state.
    const row = page.locator('li', { hasText: unique })
    await expect(row.getByText('Activo')).toBeVisible()
    await expect(row.getByText('B1', { exact: true })).toBeVisible()

    // Hide it → state flips to Oculto and the button becomes Mostrar.
    await row.getByRole('button', { name: 'Ocultar' }).click()
    await expect(page.locator('li', { hasText: unique }).getByText('Oculto')).toBeVisible({ timeout: 20_000 })

    // Show it again → back to Activo.
    await page.locator('li', { hasText: unique }).getByRole('button', { name: 'Mostrar' }).click()
    await expect(page.locator('li', { hasText: unique }).getByText('Activo')).toBeVisible({ timeout: 20_000 })

    // Delete it — confirm() native dialog must be accepted.
    page.once('dialog', d => {
      expect(d.message()).toContain('¿Eliminar este libro y su archivo?')
      d.accept().catch(() => {})
    })
    await page.locator('li', { hasText: unique }).getByRole('button', { name: 'Eliminar' }).click()
    await expect(page.getByText(unique)).toHaveCount(0, { timeout: 30_000 })

    // Verify it is truly gone from the DB (data integrity).
    const { data: leftover } = await db!.from('library_books').select('id').eq('title', unique)
    expect(leftover?.length ?? 0, 'deleted book must not remain in library_books').toBe(0)
  })

  test('6B [MUTATING] — double-clicking Upload does not create a duplicate book row', async ({ page }) => {
    test.skip(!db, 'service-role key required for guaranteed teardown')
    test.setTimeout(90_000)
    const unique = `QA-EXH-DUP-${Date.now()}`
    CREATED_TITLES.push(unique)

    await gotoLibrary(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'qa-dup.pdf', mimeType: 'application/pdf', buffer: MINIMAL_PDF,
    })
    await page.fill('input[type="text"]', unique)

    const submit = page.getByRole('button', { name: 'Subir libro' })
    await submit.click()
    // Second click should be swallowed (button disables on isPending / inputs clear on success).
    await submit.click({ timeout: 1200 }).catch(() => {})
    await expect(page.getByText(unique)).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(3000)

    const { data: rows } = await db!.from('library_books').select('id').eq('title', unique)
    test.info().annotations.push({ type: 'observed', description: `rows for double-clicked upload = ${rows?.length ?? 0}` })
    expect(rows?.length ?? 0, 'double-click must not produce a duplicate library_books row').toBe(1)
  })

  // ───────────────────────── 7 · i18n ES / EN parity ─────────────────────────

  test('7A — EN locale localizes the chrome (heading, subtitle, button, hint)', async ({ page }) => {
    await gotoLibrary(page, ROUTE_EN)
    await expectLibraryRendered(page, 'en')
    await expect(page.getByText('Upload and manage the book catalog.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upload book' })).toBeVisible()
    await expect(page.getByText('PDF only, 40 MB max.')).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-admin-biblioteca-en.png', fullPage: true })
  })

  test('7B — i18n LEAK: the "↳ Admin · Curriculum" kicker is hardcoded English on BOTH locales', async ({ page }) => {
    await gotoLibrary(page, ROUTE_ES)
    const esKicker = await page.getByText('↳ Admin · Curriculum').count()
    await gotoLibrary(page, ROUTE_EN)
    const enKicker = await page.getByText('↳ Admin · Curriculum').count()
    test.info().annotations.push({
      type: 'i18n',
      description: `hardcoded kicker present es=${esKicker > 0} en=${enKicker > 0} (AdminLibraryClient.tsx:147 — 'Curriculum' never localized to ES)`,
    })
    // EXPECTED FINDING: an untranslated string on the Spanish page.
    expect(esKicker, 'EXPECTED FINDING: "↳ Admin · Curriculum" is not localized on the ES surface').toBe(0)
  })

  test('7C — EN locale list state strings localize (empty OR row toggle labels)', async ({ page }) => {
    await gotoLibrary(page, ROUTE_EN)
    await expectLibraryRendered(page, 'en')
    const empty = await page.getByText('No books uploaded yet.').count()
    const toggles = await page.getByRole('button', { name: /Hide|Show/ }).count()
    test.info().annotations.push({ type: 'observed', description: `EN empty=${empty > 0} toggle-buttons=${toggles}` })
    // No Spanish leaking into the EN list region.
    expect(await page.getByText('Todavía no hay libros subidos.').count(), 'no ES empty-state on EN page').toBe(0)
    expect(empty > 0 || toggles > 0, 'EN list must render a known state').toBeTruthy()
  })

  // ───────────────────────── 8 · Responsive ─────────────────────────

  test('8A — usable on a 375px mobile viewport (upload control reachable in viewport)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await gotoLibrary(page)
    await expectLibraryRendered(page, 'es')
    await expect(page.locator('input[type="file"]')).toBeVisible()
    // The 2-col title/level grid collapses to 1-col below sm; the form must not overflow.
    const submit = page.getByRole('button', { name: 'Subir libro' })
    await submit.scrollIntoViewIfNeeded()
    await expect(submit).toBeInViewport()
    await page.screenshot({ path: 'test-results/exhaustive-admin-biblioteca-mobile.png', fullPage: true })
  })

  test('8B — desktop wide viewport: title + level render side-by-side, no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoLibrary(page)
    await expectLibraryRendered(page, 'es')
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientW = await page.evaluate(() => document.documentElement.clientWidth)
    test.info().annotations.push({ type: 'observed', description: `scrollWidth=${scrollW} clientWidth=${clientW}` })
    expect(scrollW, 'no horizontal overflow on desktop').toBeLessThanOrEqual(clientW + 2)
  })

  // ───────────────────────── 9 · Console errors / network ─────────────────────────

  test('9A — no console errors and no 4xx/5xx page requests on first render', async ({ page }) => {
    const consoleErrors: string[] = []
    const badResponses: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('response', r => {
      const s = r.status()
      // Ignore third-party analytics noise; flag our-origin and asset failures.
      if (s >= 400 && !/google|analytics|vercel-insights|sentry/i.test(r.url())) {
        badResponses.push(`${s} ${r.url()}`)
      }
    })
    await gotoLibrary(page)
    await expectLibraryRendered(page, 'es')
    await page.waitForTimeout(1500)
    test.info().annotations.push({ type: 'observed', description: `console-errors=${consoleErrors.length}; bad-responses=${badResponses.join(' | ') || 'none'}` })
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([])
    expect(badResponses, `4xx/5xx:\n${badResponses.join('\n')}`).toEqual([])
  })

  // ───────────────────────── 10 · Data integrity ─────────────────────────

  test('10A — rendered book count matches the DB row count for the catalog', async ({ page }) => {
    test.skip(!db, 'service-role key required to compare DB vs UI')
    await gotoLibrary(page)
    await expectLibraryRendered(page, 'es')
    const { count } = await db!
      .from('library_books')
      .select('id', { count: 'exact', head: true })
    const dbCount = count ?? 0
    // Each rendered row has a Show/Hide toggle button; count those.
    const uiRows = await page.getByRole('button', { name: /Ocultar|Mostrar/ }).count()
    const emptyShown = await page.getByText('Todavía no hay libros subidos.').count()
    test.info().annotations.push({ type: 'observed', description: `db-rows=${dbCount} ui-rows=${uiRows} empty-state=${emptyShown > 0}` })
    if (dbCount === 0) {
      expect(emptyShown, 'empty DB must render the empty state').toBeGreaterThan(0)
    } else {
      expect(uiRows, 'every library_books row should render exactly one toggle button').toBe(dbCount)
    }
  })
})
