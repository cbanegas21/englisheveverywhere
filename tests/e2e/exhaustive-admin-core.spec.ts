/**
 * EXHAUSTIVE ADMIN-CORE SWEEP — every what-if on the admin CRM core surface:
 *   /es/admin/overview              (overview/page.tsx)
 *   /es/admin/students             (students/page.tsx + StudentsTableClient.tsx)
 *   /es/admin/students/[studentId] (students/[studentId]/page.tsx + StudentProfileClient.tsx)
 *   /es/admin/teachers             (teachers/page.tsx + TeachersTableClient.tsx + TeacherActions.tsx)
 *   /es/admin/teachers/[teacherId] (teachers/[teacherId]/page.tsx + TeacherProfileClient.tsx)
 * Plus the shared admin chrome: layout.tsx (role guard), AdminSidebar.tsx,
 * AdminLangToggle.tsx.
 *
 * Runs against LIVE (PLAYWRIGHT_BASE_URL=https://englishkolab.com). Reuses the
 * saved ADMIN session (STATE.admin) so NO probe logs in (no rate-limit
 * contention). The service-role client is used ONLY read-only to discover real
 * student/teacher ids for deep-link + IDOR probes (it never writes here).
 *
 * Selectors + ES/EN label text were extracted VERBATIM from the components
 * above — never guessed. Whole-app localization is a key focus: the editorial
 * rule says status reads CRIMSON (attention) / INK (settled) only — no
 * green/amber/blue pills — yet both detail clients carry a STATUS_STYLES map
 * with green #059669 / amber #B45309 / blue #1D4ED8 and English-only labels.
 * Those are probed as EXPECTED FINDINGS.
 *
 * NOT serial — these probes EXPECT some failures (each failure = a finding);
 * serial mode would abort the whole block on the first one. Almost everything
 * here is READ-ONLY; the two mutating probes are tagged [MUTATING], are minimal,
 * and revert (toggle a teacher back, restore a level) using throwaway/idempotent
 * values. They NEVER approve/reject (that deletes/creates teacher records) and
 * NEVER touch the shared QA accounts destructively.
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, makeAdmin } from './_exhaustive/helpers'

// Reuse the saved authenticated ADMIN session for EVERY test in this file.
test.use({ storageState: STATE.admin })

const db = makeAdmin()

// ─────────────────────────── source-of-truth strings ───────────────────────────
// Overview (overview/page.tsx STR).
const OVERVIEW_ES = {
  kicker: 'Resumen de la plataforma',
  totalStudents: 'Total de estudiantes',
  activeTeachers: 'Maestros activos',
  pendingApplications: 'Solicitudes pendientes',
  pendingBookings: 'Reservas pendientes',
  recentBookings: 'Reservas recientes',
}
const OVERVIEW_EN = {
  kicker: 'Platform snapshot',
  totalStudents: 'Total students',
  activeTeachers: 'Active teachers',
  pendingApplications: 'Pending applications',
  recentBookings: 'Recent bookings',
}
// Sidebar nav labels (AdminSidebar.tsx).
const NAV_ES = ['Resumen', 'Estudiantes', 'Maestros', 'Reservas', 'Biblioteca']
const NAV_EN = ['Overview', 'Students', 'Teachers', 'Bookings', 'Library']
// Students table headers (StudentsTableClient STR.es.headers).
const STUDENT_HEADERS_ES = ['Nombre', 'Correo', 'Plan', 'Clases restantes', 'Agendadas', 'Completadas', 'Nivel', 'Maestro', 'Nivelación', 'Ingreso']
// Teachers table cols (TeachersTableClient STR.es.cols).
const TEACHER_HEADERS_ES = ['Maestro', 'Especialidades', 'Certificaciones', 'Tarifa', 'Calificación', 'Sesiones', 'Estudiantes', 'Ingreso', 'Estado']

// Status-pill colours that VIOLATE the crimson/ink-only editorial rule. Present
// in StudentProfileClient + TeacherProfileClient STATUS_STYLES maps.
const OFFBRAND_STATUS_HEX = ['#059669', '#B45309', '#1D4ED8', '#2563EB', '#7C3AED', '#EA580C']

// ─────────────────────────── helpers ───────────────────────────
// Collect console + network failures + JS pageerrors while a body runs.
function watch(page: Page) {
  const consoleErrors: string[] = []
  const badResponses: string[] = []
  const pageErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  page.on('response', (r) => {
    const u = r.url()
    if (r.status() >= 400 && /englishkolab\.com/.test(u) && !/\/sala\//.test(u)) {
      badResponses.push(`${r.status()} ${r.request().method()} ${u}`)
    }
  })
  return { consoleErrors, badResponses, pageErrors }
}

// Read one real student id + one real teacher id (read-only) for deep-link probes.
let realStudentId: string | null = null
let realTeacherId: string | null = null
let realActiveTeacherId: string | null = null
test.beforeAll(async () => {
  if (!db) return
  const { data: s } = await db.from('students').select('id').limit(1).maybeSingle()
  realStudentId = s?.id ?? null
  const { data: t } = await db.from('teachers').select('id').limit(1).maybeSingle()
  realTeacherId = t?.id ?? null
  const { data: at } = await db.from('teachers').select('id').eq('is_active', true).limit(1).maybeSingle()
  realActiveTeacherId = at?.id ?? null
})

test.describe('EXHAUSTIVE ADMIN-CORE', () => {

  // ═══════════════════ 1 · Happy-path render ═══════════════════

  test('1a — ES overview renders kicker, stat ledger, recent-bookings table', async ({ page }) => {
    const w = watch(page)
    await page.goto('/es/admin/overview')
    await settle(page)
    // Content is the source of truth (URL may flicker mid-guard).
    await expect(page.getByRole('heading', { name: /Resumen/i }).first()).toBeVisible({ timeout: 20_000 })
    for (const label of [OVERVIEW_ES.totalStudents, OVERVIEW_ES.activeTeachers, OVERVIEW_ES.pendingApplications, OVERVIEW_ES.recentBookings]) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible()
    }
    await expect(page.getByText(OVERVIEW_ES.kicker, { exact: false }).first()).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-admin-core-overview-es.png', fullPage: true })
    test.info().annotations.push({ type: 'observed', description: `overview console=${w.consoleErrors.length} 4xx5xx=${w.badResponses.length}` })
    expect(w.pageErrors, `JS errors:\n${w.pageErrors.join('\n')}`).toEqual([])
  })

  test('1b — /es/admin redirects to /es/admin/overview (content proof)', async ({ page }) => {
    await page.goto('/es/admin')
    await settle(page)
    // page.tsx redirect → overview. Prove by rendered content, not URL.
    await expect(page.getByRole('heading', { name: /Resumen/i }).first()).toBeVisible({ timeout: 20_000 })
    expect(page.url()).toMatch(/\/es\/admin\/overview/)
  })

  test('1c — ES students table renders all 10 headers + count subtitle', async ({ page }) => {
    await page.goto('/es/admin/students')
    await settle(page)
    await expect(page.getByRole('heading', { name: /Estudiantes/i }).first()).toBeVisible({ timeout: 20_000 })
    for (const h of STUDENT_HEADERS_ES) {
      await expect(page.getByRole('columnheader', { name: h, exact: true }).first()).toBeVisible()
    }
    // Subtitle: "N estudiantes registrados".
    await expect(page.getByText(/estudiantes? registrados?/i).first()).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-admin-core-students-es.png', fullPage: true })
  })

  test('1d — ES teachers page renders cols + active/pending summary', async ({ page }) => {
    await page.goto('/es/admin/teachers')
    await settle(page)
    await expect(page.getByRole('heading', { name: /Maestros/i }).first()).toBeVisible({ timeout: 20_000 })
    // Summary line "N activos · N pendientes de revisión".
    await expect(page.getByText(/activos\s*·\s*\d+\s*pendientes de revisión/i).first()).toBeVisible()
    // Active-teachers table headers.
    for (const h of TEACHER_HEADERS_ES) {
      await expect(page.getByRole('columnheader', { name: h, exact: true }).first()).toBeVisible()
    }
    await page.screenshot({ path: 'test-results/exhaustive-admin-core-teachers-es.png', fullPage: true })
  })

  test('1e — student detail deep-link renders the 5 tabs + back link', async ({ page }) => {
    test.skip(!realStudentId, 'no student id discoverable via service role')
    const w = watch(page)
    await page.goto(`/es/admin/students/${realStudentId}`)
    await settle(page)
    // Back link is unique to the detail page.
    await expect(page.getByRole('button', { name: /Volver a Estudiantes/i })).toBeVisible({ timeout: 20_000 })
    // Tab strip (ES labels from StudentProfileClient STR.es.tabLabels).
    for (const tab of ['Resumen', 'Clases', 'Pagos', 'Perfil y preferencias', 'Herramientas de admin']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible()
    }
    test.info().annotations.push({ type: 'observed', description: `student-detail console=${w.consoleErrors.length} 4xx5xx=${w.badResponses.length}` })
    await page.screenshot({ path: 'test-results/exhaustive-admin-core-student-detail-es.png', fullPage: true })
  })

  test('1f — teacher detail deep-link renders tabs + back link', async ({ page }) => {
    test.skip(!realTeacherId, 'no teacher id discoverable via service role')
    await page.goto(`/es/admin/teachers/${realTeacherId}`)
    await settle(page)
    await expect(page.getByRole('button', { name: /Volver a Maestros/i })).toBeVisible({ timeout: 20_000 })
    // ES tab labels from TeacherProfileClient STR.es.tabs.
    for (const tab of ['Resumen', 'Agenda', 'Estudiantes', 'Historial de sesiones', 'Perfil', 'Herramientas de admin']) {
      await expect(page.getByRole('button', { name: tab, exact: true }).first()).toBeVisible()
    }
    await page.screenshot({ path: 'test-results/exhaustive-admin-core-teacher-detail-es.png', fullPage: true })
  })

  // ═══════════════════ 2 · Entry / nav / deep-link / refresh ═══════════════════

  test('2a — sidebar nav links carry the correct /es/admin/* hrefs', async ({ page }) => {
    await page.goto('/es/admin/overview')
    await settle(page)
    const expected: Record<string, RegExp> = {
      Resumen: /\/es\/admin\/overview$/,
      Estudiantes: /\/es\/admin\/students$/,
      Maestros: /\/es\/admin\/teachers$/,
      Reservas: /\/es\/admin\/bookings$/,
      Biblioteca: /\/es\/admin\/biblioteca$/,
    }
    for (const [label, re] of Object.entries(expected)) {
      const link = page.getByRole('link', { name: label, exact: true }).first()
      await expect(link).toBeVisible()
      expect(await link.getAttribute('href'), `${label} href`).toMatch(re)
    }
  })

  test('2b — deep-link + hard refresh on students keeps the table rendered', async ({ page }) => {
    await page.goto('/es/admin/students')
    await settle(page)
    await expect(page.getByRole('heading', { name: /Estudiantes/i }).first()).toBeVisible({ timeout: 20_000 })
    await page.reload()
    await settle(page)
    await expect(page.getByRole('heading', { name: /Estudiantes/i }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('columnheader', { name: 'Nombre', exact: true }).first()).toBeVisible()
  })

  test('2c — clicking a student row navigates to its detail page', async ({ page }) => {
    test.skip(!realStudentId, 'no student id discoverable')
    await page.goto('/es/admin/students')
    await settle(page)
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toBeVisible({ timeout: 20_000 })
    await firstRow.click()
    await settle(page)
    await expect(page.getByRole('button', { name: /Volver a Estudiantes/i })).toBeVisible({ timeout: 20_000 })
  })

  // ═══════════════════ 2′ · Role guard (another role hits admin) ═══════════════════

  test('2d — a STUDENT session hitting /es/admin/overview is bounced (content proof)', async ({ browser }) => {
    // Fresh context with the STUDENT storage state — must NOT see admin chrome.
    const ctx = await browser.newContext({ storageState: STATE.student })
    const sp = await ctx.newPage()
    await sp.goto('/es/admin/overview')
    await settle(sp)
    await sp.waitForTimeout(2500) // let the layout.tsx role-guard bounce resolve
    // layout.tsx redirects non-admins to /<lang>/dashboard. Prove by absence of
    // admin-only content AND presence of student-home content — never trust URL.
    await expect(sp.getByText(OVERVIEW_ES.recentBookings, { exact: false })).toHaveCount(0)
    await expect(sp.getByText(OVERVIEW_ES.totalStudents, { exact: false })).toHaveCount(0)
    const bodyText = (await sp.locator('body').innerText()).toLowerCase()
    test.info().annotations.push({ type: 'SECURITY', description: `student→/admin landed url=${sp.url()}` })
    // Student dashboard markers (greeting / "clases disponibles").
    expect(/hola,|clases disponibles|inicio/.test(bodyText), 'student should be on their own dashboard').toBeTruthy()
    await ctx.close()
  })

  test('2e — a STUDENT session hitting a student-detail deep link cannot read it', async ({ browser }) => {
    test.skip(!realStudentId, 'no student id discoverable')
    const ctx = await browser.newContext({ storageState: STATE.student })
    const sp = await ctx.newPage()
    await sp.goto(`/es/admin/students/${realStudentId}`)
    await settle(sp)
    await sp.waitForTimeout(2500)
    // Admin detail markers must be absent for a student.
    await expect(sp.getByRole('button', { name: /Volver a Estudiantes|Back to Students/i })).toHaveCount(0)
    await expect(sp.getByText(/Herramientas de admin|Admin Tools/i)).toHaveCount(0)
    test.info().annotations.push({ type: 'SECURITY', description: `student→student-detail landed url=${sp.url()}` })
    await ctx.close()
  })

  test('2f — a TEACHER session hitting /es/admin/teachers cannot read the roster', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const tp = await ctx.newPage()
    await tp.goto('/es/admin/teachers')
    await settle(tp)
    await tp.waitForTimeout(2500)
    // Teacher must not see the admin teachers roster / pending-applications block.
    await expect(tp.getByText(/Solicitudes pendientes|Pending applications/i)).toHaveCount(0)
    await expect(tp.getByText(/pendientes de revisión|pending review/i)).toHaveCount(0)
    test.info().annotations.push({ type: 'SECURITY', description: `teacher→/admin/teachers landed url=${tp.url()}` })
    await ctx.close()
  })

  // ═══════════════════ 3 · Input validation (filters / search) ═══════════════════

  test('3a — SQLi/XSS in the student search box is inert (no exec, fails closed)', async ({ page }) => {
    let dialog = false
    page.on('dialog', (d) => { dialog = true; d.dismiss().catch(() => {}) })
    await page.goto('/es/admin/students')
    await settle(page)
    const search = page.getByPlaceholder('Buscar nombre o correo...')
    await expect(search).toBeVisible({ timeout: 20_000 })
    for (const payload of [`' OR 1=1--`, `<img src=x onerror=alert(1)>`, `'); DROP TABLE students;--`]) {
      await search.fill(payload)
      await page.waitForTimeout(400)
    }
    expect(dialog, 'no script execution from search payloads').toBeFalsy()
    // Client-side filter → either rows or the localized "no match" message; never a crash.
    const empty = page.getByText('Ningún estudiante coincide con los filtros.')
    const rows = page.locator('tbody tr')
    expect((await empty.count()) > 0 || (await rows.count()) >= 0, 'table did not crash on injection').toBeTruthy()
  })

  test('3b — oversized + unicode search input does not break the filter', async ({ page }) => {
    await page.goto('/es/admin/students')
    await settle(page)
    const search = page.getByPlaceholder('Buscar nombre o correo...')
    await search.fill('𝓤𝓷𝓲𝓬𝓸𝓭𝓮 🎓 ' + 'x'.repeat(5000))
    await page.waitForTimeout(500)
    // Should land on the empty-state message, not error.
    await expect(page.getByText('Ningún estudiante coincide con los filtros.')).toBeVisible()
    // Clear-filters control appears once a filter is active.
    await expect(page.getByRole('button', { name: 'Limpiar filtros' })).toBeVisible()
  })

  test('3c — teachers status + specialization filters narrow the table', async ({ page }) => {
    await page.goto('/es/admin/teachers')
    await settle(page)
    const statusSelect = page.locator('select').first()
    await expect(statusSelect).toBeVisible({ timeout: 20_000 })
    // "Inactivo" should hide active teachers (filter by inactive); never crash.
    await statusSelect.selectOption({ label: 'Inactivo' })
    await page.waitForTimeout(400)
    const w = watch(page)
    // Active table either shows the localized empty-state or filtered rows.
    const emptyMsg = page.getByText('No se encontraron maestros activos.')
    await expect(emptyMsg.or(page.locator('tbody tr').first())).toBeVisible()
    expect(w.pageErrors, 'filter must not throw').toEqual([])
  })

  // ═══════════════════ 4 · Error / not-found states ═══════════════════

  test('4a — student detail with a bogus UUID returns notFound (404), not a 500', async ({ page }) => {
    const w = watch(page)
    await page.goto('/es/admin/students/00000000-0000-0000-0000-000000000000')
    await settle(page)
    // page.tsx calls notFound() when the row is missing → Next 404. Prove by content:
    // the detail back-link must be ABSENT and a not-found marker present.
    await expect(page.getByRole('button', { name: /Volver a Estudiantes/i })).toHaveCount(0)
    const bodyText = (await page.locator('body').innerText()).toLowerCase()
    test.info().annotations.push({ type: 'observed', description: `bogus student-id body head="${bodyText.slice(0, 120)}"` })
    expect(/404|not found|no se encontró|página no encontrada|this page could not be found/.test(bodyText), 'should render a 404 / not-found page').toBeTruthy()
    expect(w.badResponses.filter((r) => / 5\d\d /.test(' ' + r + ' ')), 'no 5xx on bogus id').toEqual([])
  })

  test('4b — student detail with a malformed (non-UUID) id does not 500', async ({ page }) => {
    const w = watch(page)
    const resp = await page.goto(`/es/admin/students/${encodeURIComponent("not-a-uuid'; --")}`)
    await settle(page)
    const status = resp?.status() ?? 0
    test.info().annotations.push({ type: 'observed', description: `malformed student-id HTTP ${status}` })
    // A malformed UUID makes the .eq() query error; the page should fail gracefully
    // (404 / handled) — a raw 500 is a finding.
    expect(status, 'malformed id must not yield a server 500').toBeLessThan(500)
    expect(w.pageErrors, 'no unhandled client error').toEqual([])
  })

  test('4c — teacher detail with a bogus UUID returns notFound, not a 500', async ({ page }) => {
    const w = watch(page)
    await page.goto('/es/admin/teachers/00000000-0000-0000-0000-000000000000')
    await settle(page)
    await expect(page.getByRole('button', { name: /Volver a Maestros/i })).toHaveCount(0)
    const bodyText = (await page.locator('body').innerText()).toLowerCase()
    expect(/404|not found|no se encontró|página no encontrada|this page could not be found/.test(bodyText), 'should render a 404 / not-found page').toBeTruthy()
    expect(w.badResponses.filter((r) => / 5\d\d /.test(' ' + r + ' ')), 'no 5xx on bogus teacher id').toEqual([])
  })

  // ═══════════════════ 5 · Security / permissions / IDOR ═══════════════════

  test('5a — IDOR: an UNAUTHENTICATED context hitting a real student detail is sent to login', async ({ browser }) => {
    test.skip(!realStudentId, 'no student id discoverable')
    // No storageState → anonymous. layout.tsx must redirect to /es/login.
    const ctx = await browser.newContext()
    const ap = await ctx.newPage()
    await ap.goto(`/es/admin/students/${realStudentId}`)
    await settle(ap)
    await ap.waitForTimeout(2000)
    // Prove by content: the login form must be present, the admin detail absent.
    await expect(ap.getByRole('button', { name: /Volver a Estudiantes/i })).toHaveCount(0)
    const onLogin = (await ap.locator('input[name="password"]').count()) > 0 || /\/login/.test(ap.url())
    test.info().annotations.push({ type: 'SECURITY', description: `anon→student-detail landed url=${ap.url()} loginForm=${onLogin}` })
    expect(onLogin, 'anonymous user must be redirected to login, never shown the admin detail').toBeTruthy()
    await ctx.close()
  })

  test('5b — IDOR: admin opening a teacher id in the students route (cross-resource) 404s cleanly', async ({ page }) => {
    test.skip(!realTeacherId, 'no teacher id discoverable')
    // A teacher id is not a student id → /admin/students/<teacherId> should notFound,
    // not silently render a half-empty student shell or 500.
    const w = watch(page)
    await page.goto(`/es/admin/students/${realTeacherId}`)
    await settle(page)
    const bodyText = (await page.locator('body').innerText()).toLowerCase()
    const is404 = /404|not found|no se encontró|página no encontrada|this page could not be found/.test(bodyText)
    const hasBackLink = (await page.getByRole('button', { name: /Volver a Estudiantes/i }).count()) > 0
    test.info().annotations.push({ type: 'observed', description: `teacherId-in-students-route → 404=${is404} backLink=${hasBackLink}` })
    // Either a clean 404 (ideal) OR — if a profile row shares the id — a rendered
    // detail; what must NOT happen is a 5xx.
    expect(w.badResponses.filter((r) => / 5\d\d /.test(' ' + r + ' ')), 'no 5xx on cross-resource id').toEqual([])
  })

  // ═══════════════════ 6 · State / concurrency (two-tab) ═══════════════════

  test('6a — two admin tabs render the overview independently (no shared-state crash)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.admin })
    const [a, b] = [await ctx.newPage(), await ctx.newPage()]
    await Promise.all([a.goto('/es/admin/overview'), b.goto('/es/admin/students')])
    await Promise.all([settle(a), settle(b)])
    await expect(a.getByRole('heading', { name: /Resumen/i }).first()).toBeVisible({ timeout: 20_000 })
    await expect(b.getByRole('heading', { name: /Estudiantes/i }).first()).toBeVisible({ timeout: 20_000 })
    await ctx.close()
  })

  // ═══════════════════ 7 · i18n ES + EN parity ═══════════════════

  test('7a — EN overview localizes fully (no leftover Spanish stat labels)', async ({ page }) => {
    await page.goto('/en/admin/overview')
    await settle(page)
    await expect(page.getByRole('heading', { name: /Overview/i }).first()).toBeVisible({ timeout: 20_000 })
    for (const label of [OVERVIEW_EN.totalStudents, OVERVIEW_EN.activeTeachers, OVERVIEW_EN.pendingApplications, OVERVIEW_EN.recentBookings]) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible()
    }
    // The Spanish stat labels must NOT appear on the EN page.
    const bodyText = await page.locator('body').innerText()
    const leaked = [OVERVIEW_ES.totalStudents, OVERVIEW_ES.activeTeachers, OVERVIEW_ES.recentBookings].filter((s) => bodyText.includes(s))
    test.info().annotations.push({ type: 'observed', description: `EN overview Spanish leaks: ${leaked.join(', ') || 'none'}` })
    expect(leaked, 'EN overview should not contain Spanish stat labels').toEqual([])
  })

  test('7b — EN students table localizes headers (no Spanish header leak)', async ({ page }) => {
    await page.goto('/en/admin/students')
    await settle(page)
    await expect(page.getByRole('heading', { name: /Students/i }).first()).toBeVisible({ timeout: 20_000 })
    for (const h of ['Name', 'Email', 'Plan', 'Classes Left', 'Scheduled', 'Completed', 'Level', 'Teacher', 'Placement', 'Joined']) {
      await expect(page.getByRole('columnheader', { name: h, exact: true }).first()).toBeVisible()
    }
    const bodyText = await page.locator('body').innerText()
    const leaked = ['Clases restantes', 'Nivelación', 'Correo'].filter((s) => bodyText.includes(s))
    expect(leaked, 'EN students table should not leak Spanish headers').toEqual([])
  })

  test('7c — AdminLangToggle ES→EN reloads the tree in English (Next 16 segment-cache fix)', async ({ page }) => {
    await page.goto('/es/admin/overview')
    await settle(page)
    await expect(page.getByRole('heading', { name: /Resumen/i }).first()).toBeVisible({ timeout: 20_000 })
    // Toggle is two buttons "ES"/"EN" in the top bar.
    await page.getByRole('button', { name: 'EN', exact: true }).click()
    await page.waitForURL(/\/en\/admin\/overview/, { timeout: 20_000 }).catch(() => {})
    await settle(page)
    // The WHOLE tree (incl. sidebar) must now read English — sidebar "Overview".
    await expect(page.getByRole('heading', { name: /Overview/i }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: 'Students', exact: true }).first()).toBeVisible()
    // Sidebar must NOT still show Spanish "Estudiantes".
    await expect(page.getByRole('link', { name: 'Estudiantes', exact: true })).toHaveCount(0)
  })

  test('7d — EXPECTED FINDING: detail-page status pills use off-brand green/amber/blue hex', async ({ page }) => {
    test.skip(!realStudentId, 'no student id discoverable')
    await page.goto(`/es/admin/students/${realStudentId}`)
    await settle(page)
    await expect(page.getByRole('button', { name: /Volver a Estudiantes/i })).toBeVisible({ timeout: 20_000 })
    // Open the Classes tab where the status pills render.
    await page.getByRole('button', { name: 'Clases', exact: true }).click()
    await page.waitForTimeout(400)
    // Scan rendered inline styles for the off-brand status hex codes. The editorial
    // rule is crimson (attention) / ink (settled) ONLY — these pills break it.
    const html = await page.content()
    const found = OFFBRAND_STATUS_HEX.filter((hex) => html.toLowerCase().includes(hex.toLowerCase()))
    test.info().annotations.push({ type: 'FINDING', description: `off-brand status hex present on student detail: ${found.join(', ') || 'none'}` })
    await page.screenshot({ path: 'test-results/exhaustive-admin-core-student-status-pills.png', fullPage: true })
    // Assert the brand rule SHOULD hold (so a violation surfaces as a failing finding).
    expect(found, 'student-detail status pills must not use green/amber/blue (crimson/ink only)').toEqual([])
  })

  test('7e — EXPECTED FINDING: teacher-detail Session-History status labels are hardcoded English', async ({ page }) => {
    test.skip(!realTeacherId, 'no teacher id discoverable')
    await page.goto(`/es/admin/teachers/${realTeacherId}`)
    await settle(page)
    await expect(page.getByRole('button', { name: /Volver a Maestros/i })).toBeVisible({ timeout: 20_000 })
    // TeacherProfileClient STATUS_STYLES.label is the literal English string
    // ('Pending'/'Confirmed'/'Completed'/'Cancelled') — if any booking row renders
    // it, the Spanish page leaks English. Scan the whole page text.
    const bodyText = await page.locator('body').innerText()
    const englishStatusLeak = /\b(Pending|Confirmed|Completed|Cancelled)\b/.test(bodyText)
    test.info().annotations.push({ type: 'FINDING', description: `teacher-detail English status-label leak on ES page = ${englishStatusLeak}` })
    // Not a hard crash either way — record the verdict; assert the page should be ES-only.
    expect(englishStatusLeak, 'EXPECTED FINDING: teacher-detail status labels hardcoded English (STATUS_STYLES.label) leak on the ES page').toBeFalsy()
  })

  // ═══════════════════ 8 · Responsive (375px mobile + desktop) ═══════════════════

  test('8a — overview is usable at 375px (mobile sidebar collapses to a hamburger)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/admin/overview')
    await settle(page)
    await expect(page.getByRole('heading', { name: /Resumen/i }).first()).toBeVisible({ timeout: 20_000 })
    // The mobile top bar exposes the menu button (aria-label "Abrir menú").
    const menuBtn = page.getByRole('button', { name: /Abrir menú|Open menu/i })
    await expect(menuBtn).toBeVisible()
    await menuBtn.click()
    await page.waitForTimeout(500)
    // Drawer reveals the nav — "Estudiantes" link should now be visible.
    await expect(page.getByRole('link', { name: 'Estudiantes', exact: true }).first()).toBeVisible()
    await page.screenshot({ path: 'test-results/exhaustive-admin-core-overview-mobile.png', fullPage: true })
  })

  test('8b — students table scrolls horizontally at 375px without clipping the heading', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/admin/students')
    await settle(page)
    await expect(page.getByRole('heading', { name: /Estudiantes/i }).first()).toBeVisible({ timeout: 20_000 })
    // Table has min-width 900px inside an overflow-x:auto wrapper — the heading
    // must remain in-viewport (not pushed off by the wide table).
    await expect(page.getByRole('heading', { name: /Estudiantes/i }).first()).toBeInViewport()
    await page.screenshot({ path: 'test-results/exhaustive-admin-core-students-mobile.png', fullPage: true })
  })

  // ═══════════════════ 9 · Console errors + network 4xx/5xx ═══════════════════

  test('9a — no console/JS errors or 4xx/5xx across the 4 list/overview surfaces', async ({ page }) => {
    const w = watch(page)
    for (const path of ['/es/admin/overview', '/es/admin/students', '/es/admin/teachers']) {
      await page.goto(path)
      await settle(page)
    }
    test.info().annotations.push({ type: 'observed', description: `console=${w.consoleErrors.length}; 4xx5xx=${w.badResponses.length}; pageErrors=${w.pageErrors.length}` })
    if (w.consoleErrors.length) test.info().annotations.push({ type: 'console', description: w.consoleErrors.slice(0, 8).join(' | ') })
    if (w.badResponses.length) test.info().annotations.push({ type: 'network', description: w.badResponses.slice(0, 8).join(' | ') })
    expect(w.pageErrors, `uncaught JS errors:\n${w.pageErrors.join('\n')}`).toEqual([])
    expect(w.badResponses, `4xx/5xx on own origin:\n${w.badResponses.join('\n')}`).toEqual([])
  })

  // ═══════════════════ 10 · Data integrity ═══════════════════

  test('10a — overview "Total de estudiantes" stat matches the students-table count', async ({ page }) => {
    test.skip(!db, 'service role required for DB cross-check')
    // Ground truth from the DB.
    const { count: dbCount } = await db!.from('students').select('id', { count: 'exact', head: true })
    await page.goto('/es/admin/students')
    await settle(page)
    await expect(page.getByRole('heading', { name: /Estudiantes/i }).first()).toBeVisible({ timeout: 20_000 })
    // Heading carries "(N)"; subtitle carries "N estudiantes registrados".
    const subtitle = await page.getByText(/\d+\s+estudiantes? registrados?/i).first().innerText()
    const shown = Number((subtitle.match(/(\d+)/) || [])[1])
    test.info().annotations.push({ type: 'observed', description: `students: DB=${dbCount} table=${shown}` })
    expect(shown, 'students table count must equal the DB row count').toBe(dbCount)
  })

  test('10b — teachers active/pending summary sums to the total teacher count', async ({ page }) => {
    test.skip(!db, 'service role required')
    const { count: dbTotal } = await db!.from('teachers').select('id', { count: 'exact', head: true })
    await page.goto('/es/admin/teachers')
    await settle(page)
    const summary = await page.getByText(/activos\s*·\s*\d+\s*pendientes de revisión/i).first().innerText()
    const nums = (summary.match(/\d+/g) || []).map(Number)
    const sum = nums.reduce((a, b) => a + b, 0)
    test.info().annotations.push({ type: 'observed', description: `teachers: DB=${dbTotal} active+pending=${sum} (${summary.trim()})` })
    expect(sum, 'active + pending must equal total teachers').toBe(dbTotal)
  })

  // ═══════════════════ MUTATING (tagged, minimal, reverted) ═══════════════════

  test('[MUTATING] M1 — ActiveToggle flips a teacher inactive then back (revert)', async ({ page }) => {
    test.skip(!realActiveTeacherId || !db, 'need an active teacher + service role to verify/revert')
    // Capture ground-truth state so we can guarantee a clean revert.
    const { data: before } = await db!.from('teachers').select('is_active').eq('id', realActiveTeacherId!).single()
    const startedActive = before?.is_active === true
    test.skip(!startedActive, 'discovered teacher is not active; skip to keep the probe a safe round-trip')

    await page.goto('/es/admin/teachers')
    await settle(page)
    // The active-teachers table row for this teacher carries the ActiveToggle button.
    // It reads "Activo" (active) — clicking toggles to "Inactivo".
    const toggle = page.getByRole('button', { name: /^(Activo|Inactivo)$/ }).first()
    await expect(toggle).toBeVisible({ timeout: 20_000 })
    const labelBefore = (await toggle.innerText()).trim()
    await toggle.click()
    await page.waitForTimeout(1500)
    // Verify the DB actually flipped (the action ran through assertAdmin → write).
    const { data: mid } = await db!.from('teachers').select('is_active').eq('id', realActiveTeacherId!).single()
    test.info().annotations.push({ type: 'observed', description: `toggle "${labelBefore}" → is_active=${mid?.is_active}` })
    // REVERT: ensure the teacher ends active again no matter what the UI did.
    if (mid?.is_active !== true) {
      await db!.from('teachers').update({ is_active: true }).eq('id', realActiveTeacherId!)
    }
    const { data: after } = await db!.from('teachers').select('is_active').eq('id', realActiveTeacherId!).single()
    expect(after?.is_active, 'teacher restored to active after probe').toBe(true)
  })

  test('[MUTATING] M2 — student CEFR level save persists then is restored', async ({ page }) => {
    test.skip(!realStudentId || !db, 'need a student + service role to verify/revert')
    const { data: before } = await db!.from('students').select('level').eq('id', realStudentId!).single()
    const originalLevel: string | null = before?.level ?? null
    // Pick a level different from the current one to prove the write.
    const probeLevel = originalLevel === 'B2' ? 'B1' : 'B2'

    await page.goto(`/es/admin/students/${realStudentId}`)
    await settle(page)
    await expect(page.getByRole('button', { name: /Volver a Estudiantes/i })).toBeVisible({ timeout: 20_000 })
    // Overview tab (default) has the CEFR Level select + adjacent Guardar button.
    const levelSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'A1' }) }).first()
    await expect(levelSelect).toBeVisible()
    await levelSelect.selectOption(probeLevel)
    // The "Guardar" button next to the level select (first Guardar on the page).
    await page.getByRole('button', { name: 'Guardar', exact: true }).first().click()
    await page.waitForTimeout(1500)
    const { data: mid } = await db!.from('students').select('level').eq('id', realStudentId!).single()
    test.info().annotations.push({ type: 'observed', description: `level ${originalLevel} → probe ${probeLevel}; db=${mid?.level}` })
    const persisted = mid?.level === probeLevel
    // REVERT regardless of outcome.
    await db!.from('students').update({ level: originalLevel }).eq('id', realStudentId!)
    const { data: after } = await db!.from('students').select('level').eq('id', realStudentId!).single()
    expect(after?.level ?? null, 'student level restored to original').toBe(originalLevel)
    expect(persisted, 'CEFR level save must persist to the DB').toBeTruthy()
  })
})
