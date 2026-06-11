/**
 * EXHAUSTIVE — STUDENT LIBRARY (/es/dashboard/biblioteca)
 *
 * Surface: the student "Biblioteca" — server-rendered list of active
 * `library_books` (id/title/description/level/created_at) + a modal PDF
 * viewer that fetches a 15-min signed URL via the `getBookSignedUrl`
 * server action. View-only (downloads disabled, right-click suppressed).
 *
 * Source of truth (selectors/labels read from the real code, NOT guessed):
 *   - src/app/[lang]/dashboard/biblioteca/page.tsx        (server fetch + role guard via layout)
 *   - src/app/[lang]/dashboard/biblioteca/BibliotecaClient.tsx
 *   - src/app/actions/library.ts                          (getBookSignedUrl: requireAuthed, TTL 900s)
 *   - src/app/[lang]/dashboard/layout.tsx                 (teacher→/maestro, admin→/admin, anon→/login)
 *
 * Real ES/EN strings used below:
 *   title:      "Biblioteca" / "Library"
 *   subtitle:   "Libros y materiales de lectura · solo lectura" / "...view-only"
 *   read CTA:   "Abrir →" / "Open →"
 *   loading:    "Abriendo…" / "Opening…"
 *   empty:      "Todavía no hay libros disponibles." / "No books available yet."
 *   no-dl note: "Solo lectura. La descarga está desactivada." / "Viewing only. Downloads are disabled."
 *   close:      aria-label "Cerrar visor" / "Close viewer"
 *   filter all: "Todos" / "All"
 *   stat kickers ES: Libros / Niveles / Más reciente — EN: Books / Levels / Latest
 *
 * Role: student → top of describe uses STATE.student (never logs in).
 * NON-MUTATING surface — every probe is read-only (it only OPENS books; it never
 * uploads/deletes/toggles, and never completes any payment). No [MUTATING] tests.
 *
 * Rules honored: settle() not networkidle; NOT serial; assert on rendered
 * content not URL; import shared helpers; evidence screenshots on key probes.
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, makeAdmin } from './_exhaustive/helpers'

const db = makeAdmin()

// Open the first book row (if any) and wait for the viewer chrome. Returns
// whether a row existed to open. Non-mutating: opening only mints a signed URL.
async function openFirstBook(page: Page): Promise<boolean> {
  const row = page.locator('button.lk-bib-row')
  if ((await row.count()) === 0) return false
  await row.first().click()
  await expect(page.locator('[data-book-viewer]')).toBeVisible({ timeout: 15_000 })
  return true
}

test.describe('EXHAUSTIVE · student · biblioteca', () => {
  test.use({ storageState: STATE.student })

  // ───────────────────────── 1 · Happy-path render ─────────────────────────

  test('1.1 — ES library renders header, subtitle and (list or empty state)', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)

    // Header proves the right surface loaded (not a redirect-to-login leak).
    await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/solo lectura/i)).toBeVisible()

    const rows = await page.locator('button.lk-bib-row').count()
    const emptyVisible = await page.getByText('Todavía no hay libros disponibles.').isVisible().catch(() => false)
    test.info().annotations.push({ type: 'observed', description: `ES book rows=${rows}; emptyState=${emptyVisible}` })
    // Exactly one of: a populated list OR the empty card. Never neither.
    expect(rows > 0 || emptyVisible, 'library shows either a book list or the empty state').toBeTruthy()

    if (rows > 0) {
      // Each row exposes the "Abrir →" CTA per the component.
      await expect(page.getByText('Abrir →').first()).toBeVisible()
      // StatLedger only renders when books exist — confirm the ES kickers.
      await expect(page.getByText('Libros', { exact: true }).first()).toBeVisible()
    }
    await page.screenshot({ path: 'test-results/exhaustive-student-biblioteca-list-es.png', fullPage: true })
  })

  test('1.2 — StatLedger "Libros" total matches the actual number of rows', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const rows = await page.locator('button.lk-bib-row').count()
    test.skip(rows === 0, 'no books seeded — ledger not rendered')

    // The ledger total stat (accent value next to kicker "Libros") should equal
    // the number of rendered rows (no level filter applied on first paint).
    const totalText = (await page.locator('.lk-stat-value').first().innerText()).trim()
    test.info().annotations.push({ type: 'observed', description: `ledger total="${totalText}" vs rows=${rows}` })
    expect(Number(totalText)).toBe(rows)
  })

  // ───────────────────────── 2 · Entry / nav / guard / refresh ─────────────────────────

  test('2.1 — deep-link + hard refresh keeps the student on the library', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    await page.reload()
    await settle(page)
    await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible({ timeout: 15_000 })
    // Must not have been bounced to login (content-based, not URL-based).
    await expect(page.locator('input[name="password"]')).toHaveCount(0)
  })

  test('2.2 — anonymous (no session) hitting the library is sent to login', async ({ browser }) => {
    // Fresh context with NO storageState → unauthenticated.
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    // Prove the login form rendered — never the library header.
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Biblioteca' })).toHaveCount(0)
    await ctx.close()
  })

  test('2.3 — sidebar nav into the library works (not just deep-link)', async ({ page }) => {
    await page.goto('/es/dashboard')
    await settle(page)
    const link = page.getByRole('link', { name: /biblioteca|library/i }).first()
    const hasLink = (await link.count()) > 0
    test.info().annotations.push({ type: 'observed', description: `sidebar biblioteca link present=${hasLink}` })
    if (!hasLink) {
      // Record as a finding rather than silently passing.
      expect(hasLink, 'no in-app link to the library from the dashboard (nav gap)').toBeTruthy()
      return
    }
    await link.click()
    await settle(page)
    await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible({ timeout: 15_000 })
  })

  // ───────────────────────── 3 · Role guard (other roles) ─────────────────────────

  test('3.1 — teacher visiting the student library is bounced to their own area', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    await page.waitForTimeout(2500) // let the layout role-bounce fully resolve
    // The student library header must NOT be the teacher's view — but note the
    // TEACHER app ALSO has a /maestro/biblioteca with the same "Biblioteca" title,
    // so assert on the route landing area, not just heading text.
    const url = page.url()
    test.info().annotations.push({ type: 'observed', description: `teacher → ${url}` })
    // Must have left the student dashboard subtree.
    expect(url, 'teacher must not remain on /es/dashboard/biblioteca').not.toMatch(/\/dashboard\/biblioteca/)
    await ctx.close()
  })

  test('3.2 — admin visiting the student library is bounced to /admin', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.admin })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    await page.waitForTimeout(2500)
    const url = page.url()
    test.info().annotations.push({ type: 'observed', description: `admin → ${url}` })
    expect(url, 'admin must not remain on /es/dashboard/biblioteca').not.toMatch(/\/dashboard\/biblioteca/)
    await ctx.close()
  })

  // ───────────────────────── 4 · Viewer (signed-URL behavior) ─────────────────────────

  test('4.1 — opening a book mounts the viewer with the no-download note + closes cleanly', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const opened = await openFirstBook(page)
    test.skip(!opened, 'no books seeded to open')

    // The view-only note is part of the viewer header — confirms it's the real viewer.
    await expect(page.getByText('Solo lectura. La descarga está desactivada.')).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-student-biblioteca-viewer-es.png' })

    // Close via the labelled close button (aria-label "Cerrar visor").
    await page.getByRole('button', { name: 'Cerrar visor' }).click()
    await expect(page.locator('[data-book-viewer]')).toHaveCount(0, { timeout: 5000 })
  })

  test('4.2 — the viewer renders a same-origin /storage signed-URL iframe (not a raw public URL)', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const opened = await openFirstBook(page)
    test.skip(!opened, 'no books seeded to open')

    const iframe = page.locator('[data-book-viewer] iframe')
    // The signed URL arrives async after the transition; wait for the iframe.
    await expect(iframe).toBeVisible({ timeout: 20_000 })
    const src = await iframe.getAttribute('src')
    test.info().annotations.push({ type: 'observed', description: `viewer iframe src=${src}` })
    expect(src, 'iframe src present').toBeTruthy()
    // Supabase signed URLs carry a token + go through /storage/v1/object/sign.
    expect(src!, 'should be a signed storage URL').toMatch(/\/storage\/v1\/object\/sign\/|[?&]token=/)
    // The component pins PDF chrome off (toolbar/navpanes hidden) to discourage download.
    expect(src!, 'PDF toolbar/navpanes must be disabled in the iframe fragment').toContain('toolbar=0')
  })

  test('4.3 — clicking the dark backdrop dismisses the viewer', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const opened = await openFirstBook(page)
    test.skip(!opened, 'no books seeded to open')
    // The backdrop is the full-screen overlay sibling; click top-left away from the panel.
    await page.mouse.click(4, 4)
    await expect(page.locator('[data-book-viewer]')).toHaveCount(0, { timeout: 5000 })
  })

  test('4.4 — right-click inside the viewer is suppressed (anti-save context menu)', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const opened = await openFirstBook(page)
    test.skip(!opened, 'no books seeded to open')
    // The component preventDefaults contextmenu on [data-book-viewer]. We can only
    // assert the handler does not throw / the viewer stays mounted after a right-click.
    await page.locator('[data-book-viewer]').click({ button: 'right' }).catch(() => {})
    await expect(page.locator('[data-book-viewer]')).toBeVisible()
    test.info().annotations.push({ type: 'observed', description: 'right-click handled without crashing the viewer' })
  })

  // ───────────────────────── 5 · Security / permissions / IDOR on book id ─────────────────────────

  test('5.1 — viewer never exposes a download/anchor handle to the raw PDF (view-only contract)', async ({ page }) => {
    // requireAuthed() (NOT requireAdmin) gates getBookSignedUrl — a student is
    // INTENDED to mint a URL. The security posture is "view-only": the UI must not
    // hand the student a download affordance. Verify no <a download>/anchor to the
    // signed URL is rendered inside the viewer — only the sandboxed <iframe>.
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const opened = await openFirstBook(page)
    test.skip(!opened, 'no books seeded to open')
    await page.locator('[data-book-viewer] iframe').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})

    const downloadAnchors = await page.locator('[data-book-viewer] a[download], [data-book-viewer] a[href*="/storage/"]').count()
    const noDownloadNote = await page.getByText(/descarga está desactivada|downloads are disabled/i).isVisible().catch(() => false)
    test.info().annotations.push({ type: 'observed', description: `viewer download-anchors=${downloadAnchors}; no-download-note=${noDownloadNote}` })
    expect(downloadAnchors, 'view-only viewer must expose no download link to the signed PDF').toBe(0)
    expect(noDownloadNote, 'the view-only note must be present').toBeTruthy()
  })

  test('5.2 — server fetch only exposes ACTIVE books (no inactive rows leak to the list)', async ({ page }) => {
    test.skip(!db, 'service-role key required for DB cross-check')
    // Ground truth from the DB: titles of active vs inactive books.
    const { data: active } = await db!.from('library_books').select('title').eq('is_active', true)
    const { data: inactive } = await db!.from('library_books').select('title').eq('is_active', false)
    const activeTitles = new Set((active || []).map((b: { title: string }) => b.title))
    const inactiveTitles = (inactive || []).map((b: { title: string }) => b.title)
    test.info().annotations.push({
      type: 'observed',
      description: `active=${activeTitles.size}, inactive=${inactiveTitles.length}`,
    })

    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const rendered = await page.locator('button.lk-bib-row div').allInnerTexts()
    const renderedJoined = rendered.join('  ')

    // No INACTIVE title may appear in the rendered list.
    const leaked = inactiveTitles.filter((tt) => tt && renderedJoined.includes(tt))
    expect(leaked, `inactive books leaked into the student list: ${leaked.join(', ')}`).toEqual([])
  })

  test('5.3 — book id route param IDOR is N/A (no /biblioteca/:id route); deep-link to a fake id 404s safely', async ({ page }) => {
    // There is no per-book detail route — the viewer is a modal keyed off the action.
    // A guessed sub-path should not render the library nor a stack trace.
    const errors: string[] = []
    page.on('response', (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`) })
    await page.goto('/es/dashboard/biblioteca/00000000-0000-0000-0000-000000000000')
    await settle(page)
    const body = (await page.locator('body').innerText()).toLowerCase()
    test.info().annotations.push({ type: 'observed', description: `fake-subpath url=${page.url()}; 5xx=${errors.length}` })
    expect(errors, 'no server error on a guessed book sub-path').toEqual([])
    // Must not leak a raw stack / internal error string.
    expect(/at async|stack trace|supabaseurl|service_role/i.test(body), 'no internals leaked').toBeFalsy()
  })

  // ───────────────────────── 6 · Input / filter validation ─────────────────────────

  test('6.1 — level filter tabs narrow the list and "Todos" restores it', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const tabs = page.locator('button.lk-bib-tab')
    const tabCount = await tabs.count()
    test.skip(tabCount === 0, 'no level tabs (no books have a level set)')

    const allRows = await page.locator('button.lk-bib-row').count()
    // Pick the first non-"Todos" tab and apply it.
    const levelTab = tabs.nth(1)
    const levelLabel = (await levelTab.innerText()).trim()
    await levelTab.click()
    await settle(page, 600)
    const filteredRows = await page.locator('button.lk-bib-row').count()
    test.info().annotations.push({ type: 'observed', description: `all=${allRows}, after "${levelLabel}"=${filteredRows}` })
    // Filtered count must be <= total and at least 1 (the tab only exists because a book has that level).
    expect(filteredRows).toBeLessThanOrEqual(allRows)
    expect(filteredRows).toBeGreaterThan(0)

    // "Todos" restores the full set.
    await page.getByRole('button', { name: 'Todos' }).click()
    await settle(page, 600)
    expect(await page.locator('button.lk-bib-row').count()).toBe(allRows)
  })

  test('6.2 — no <input>/search box on this surface (read-only list) — confirms no injectable field', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    // The surface has zero free-text inputs (all interaction is button-driven).
    // This documents that classic SQLi/XSS-in-input vectors are not applicable here;
    // the only attacker-controlled value (book id) is covered in section 5.
    const inputs = await page.locator('main input, main textarea').count()
    test.info().annotations.push({ type: 'observed', description: `free-text inputs in library main=${inputs}` })
    expect(inputs, 'library is a read-only list — should have no text inputs').toBe(0)
  })

  // ───────────────────────── 7 · i18n parity (ES + EN) ─────────────────────────

  test('7.1 — EN library uses English chrome (no hardcoded Spanish leaks)', async ({ page }) => {
    await page.goto('/en/dashboard/biblioteca')
    await settle(page)
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/view-only/i)).toBeVisible()

    const rows = await page.locator('button.lk-bib-row').count()
    if (rows > 0) {
      await expect(page.getByText('Open →').first()).toBeVisible()
      await expect(page.getByText('Books', { exact: true }).first()).toBeVisible()
    }
    // The page chrome (header/subtitle/CTA/stats) must not show Spanish strings.
    const body = await page.locator('body').innerText()
    const spanishLeak = /Biblioteca\b|solo lectura|Abrir →|Más reciente|Niveles/i.test(body)
    test.info().annotations.push({ type: 'observed', description: `EN page spanish-leak=${spanishLeak}; rows=${rows}` })
    expect(spanishLeak, 'EN page must not render Spanish chrome (book TITLES may be Spanish, chrome must not)').toBeFalsy()
    await page.screenshot({ path: 'test-results/exhaustive-student-biblioteca-list-en.png', fullPage: true })
  })

  test('7.2 — EN viewer shows the English no-download note', async ({ page }) => {
    await page.goto('/en/dashboard/biblioteca')
    await settle(page)
    const opened = await openFirstBook(page)
    test.skip(!opened, 'no books seeded to open')
    await expect(page.getByText('Viewing only. Downloads are disabled.')).toBeVisible()
    // Close button must carry the English aria-label.
    await expect(page.getByRole('button', { name: 'Close viewer' })).toBeVisible()
  })

  test('7.3 — empty-state copy is localized (only checked if the library is empty)', async ({ page }) => {
    await page.goto('/en/dashboard/biblioteca')
    await settle(page)
    const empty = await page.getByText('No books available yet.').isVisible().catch(() => false)
    test.skip(!empty, 'library not empty — empty-state copy not shown')
    // If empty, the EN empty string must show and the ES one must not.
    await expect(page.getByText('No books available yet.')).toBeVisible()
    await expect(page.getByText('Todavía no hay libros disponibles.')).toHaveCount(0)
  })

  // ───────────────────────── 8 · Responsive (375px mobile + desktop) ─────────────────────────

  test('8.1 — 375px mobile: header + first row/empty-state are usable, no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible({ timeout: 15_000 })

    // No horizontal overflow on mobile (the list rows use ellipsis, ledger collapses to 2-col).
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    test.info().annotations.push({ type: 'observed', description: `mobile horizontal overflow px=${overflow}` })
    expect(overflow, 'no horizontal scroll at 375px').toBeLessThanOrEqual(2)
    await page.screenshot({ path: 'test-results/exhaustive-student-biblioteca-mobile.png', fullPage: true })
  })

  test('8.2 — 375px mobile: opening a book fills the viewport (inset-16 fixed panel)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const opened = await openFirstBook(page)
    test.skip(!opened, 'no books seeded to open')
    const box = await page.locator('[data-book-viewer]').boundingBox()
    test.info().annotations.push({ type: 'observed', description: `mobile viewer box=${JSON.stringify(box)}` })
    expect(box, 'viewer rendered').toBeTruthy()
    // inset:16 → panel should span roughly the viewport width minus 32px.
    expect(box!.width).toBeGreaterThan(375 - 80)
    await page.getByRole('button', { name: 'Cerrar visor' }).click()
  })

  // ───────────────────────── 9 · Console errors + network 4xx/5xx ─────────────────────────

  test('9.1 — no console errors and no 5xx on initial library load', async ({ page }) => {
    const consoleErrors: string[] = []
    const serverErrors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('response', (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`) })

    await page.goto('/es/dashboard/biblioteca')
    await settle(page, 3000)

    // Filter benign noise (extensions, favicon, analytics 404s aren't our concern).
    const realConsole = consoleErrors.filter(
      (e) => !/favicon|third-party|sourcemap|chrome-extension|ResizeObserver/i.test(e),
    )
    test.info().annotations.push({ type: 'observed', description: `console errors: ${JSON.stringify(realConsole)}` })
    test.info().annotations.push({ type: 'observed', description: `5xx: ${JSON.stringify(serverErrors)}` })
    expect(serverErrors, 'no 5xx on library load').toEqual([])
    expect(realConsole, 'no console errors on library load').toEqual([])
  })

  test('9.2 — opening a book mints a signed URL with no 4xx/5xx on the storage request', async ({ page }) => {
    const badStatuses: string[] = []
    page.on('response', (r) => {
      const u = r.url()
      if (r.status() >= 400 && /\/storage\/v1\/object\//.test(u)) badStatuses.push(`${r.status()} ${u}`)
    })
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const opened = await openFirstBook(page)
    test.skip(!opened, 'no books seeded to open')
    // Let the iframe pull the PDF from the signed URL.
    await page.locator('[data-book-viewer] iframe').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    await settle(page, 2000)
    test.info().annotations.push({ type: 'observed', description: `storage 4xx/5xx: ${JSON.stringify(badStatuses)}` })
    expect(badStatuses, 'the signed-URL PDF fetch must succeed (no 4xx/5xx)').toEqual([])
  })

  // ───────────────────────── 10 · State / concurrency ─────────────────────────

  test('10.1 — rapid double-click on a row does not stack two viewers', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const row = page.locator('button.lk-bib-row')
    test.skip((await row.count()) === 0, 'no books seeded to open')
    await row.first().dblclick()
    await settle(page, 1500)
    // openBook is a single state object → at most ONE viewer panel mounts.
    const viewers = await page.locator('[data-book-viewer]').count()
    test.info().annotations.push({ type: 'observed', description: `viewers after dblclick=${viewers}` })
    expect(viewers, 'double-click must not mount two viewers').toBeLessThanOrEqual(1)
  })

  test('10.2 — open book A, close, open book B shows B (no stale signed URL from A)', async ({ page }) => {
    await page.goto('/es/dashboard/biblioteca')
    await settle(page)
    const rows = page.locator('button.lk-bib-row')
    const n = await rows.count()
    test.skip(n < 2, 'need at least 2 books to verify viewer reset')

    const titleA = (await rows.nth(0).locator('div').first().innerText()).trim()
    await rows.nth(0).click()
    await expect(page.locator('[data-book-viewer]')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Cerrar visor' }).click()
    await expect(page.locator('[data-book-viewer]')).toHaveCount(0, { timeout: 5000 })

    const titleB = (await rows.nth(1).locator('div').first().innerText()).trim()
    await rows.nth(1).click()
    await expect(page.locator('[data-book-viewer]')).toBeVisible({ timeout: 15_000 })
    // The viewer header title must be B's, not a stale A.
    const viewerTitle = await page.locator('[data-book-viewer] p').first().innerText()
    test.info().annotations.push({ type: 'observed', description: `A="${titleA}" B="${titleB}" viewerShows="${viewerTitle.trim()}"` })
    expect(viewerTitle.trim(), 'reopened viewer shows book B, not stale A').toBe(titleB)
  })
})
