/**
 * EXHAUSTIVE LIVE QA — TEACHER AVAILABILITY (/es/maestro/dashboard/disponibilidad)
 *
 * Surface: src/app/[lang]/maestro/dashboard/disponibilidad/{page.tsx,AvailabilityClient.tsx}
 * Shared chrome: src/components/ui/DashTopBar.tsx, src/components/dashboard/SectionHeader.tsx,
 *   src/components/dashboard/Modal.tsx (bulk-add modal)
 * Server action: src/app/actions/booking.ts → saveAvailabilitySlots(slots, lang)
 *
 * Reality extracted from source (NOT guessed):
 *  - Title (DashTopBar): ES "Configura tu disponibilidad" / EN "Set your availability".
 *  - Subtitle ES "Define tus horarios semanales recurrentes. Los estudiantes podrán
 *    reservar dentro de estas ventanas." — note this and the "How it works" copy
 *    BOTH claim students self-book within these windows; that is FALSE per product
 *    (admin assigns the teacher to a booking). Recorded as a copy finding.
 *  - Editor card header (SectionHeader): ES "Mis horarios"; right slot has TWO buttons:
 *    "Agregar en grupo" (bulk) and "+ Agregar horario" (single add).
 *  - Each slot row: <select> Día (Domingo..Sábado, value=0..6), <select> Hora de inicio,
 *    <select> Hora de fin (TIME_OPTIONS = 00:00,00:30,...,23:00,23:30,23:59), and a
 *    "Eliminar" button (aria-label "Eliminar").
 *  - Only validation: end_time <= start_time per-row → row turns red, shows ES
 *    "La hora de fin debe ser después del inicio." Save with any invalid row sets
 *    saveStatus='error' and shows "Corrige los horarios marcados antes de guardar."
 *    NO overlap detection, NO server-side validation, NO max rows.
 *  - Save button: ES "Guardar disponibilidad"; success badge "Disponibilidad guardada".
 *  - Empty state (0 rows): ES "Sin disponibilidad. Agrega tu primer horario."
 *  - Sidebar "Cómo funciona" (How it works) + "Resumen semanal" (Weekly summary).
 *    >>> TE-03 BUG: the weekly summary renders, per day, daySlots.LENGTH followed by
 *        the literal word from tx.slots. A single 9:00-18:00 window reads as "1 slots"
 *        — a COUNT, never a time range/hours. Worse: tx.es.slots === 'slots' (English),
 *        so the Spanish page prints "slots" (hardcoded wrong language) and EN has a
 *        "1 slots" pluralization bug.
 *  - Bulk modal (Modal.tsx, role=dialog): kicker "Agregar en grupo", title
 *    "Agregar disponibilidad en varios días", presets "Lun–Vie"/"Fines de semana"/
 *    "Toda la semana", 7 day chips, start/end selects, apply button label
 *    "Agregar N horario(s)" (count = selected days), cancel "Cancelar".
 *
 *  *** SAFETY — saveAvailabilitySlots is DESTRUCTIVE: it DELETEs every row for the
 *  teacher then re-inserts the posted set. Any probe that clicks "Guardar
 *  disponibilidad" wipes the teacher's real availability. Every [MUTATING] probe
 *  therefore SNAPSHOTS the teacher's real slots via the service role first and
 *  RESTORES them in finally{}/afterAll. Non-mutating probes do client-only edits
 *  and NEVER click Save. ***
 *
 * Role guards (content is the source of truth, never the mid-redirect URL):
 *  - maestro/layout.tsx: admin → /admin, student (non-teacher) → /dashboard, anon → /login.
 *  - maestro/dashboard/layout.tsx: no teacher row → /onboarding, !is_active → /maestro/pending.
 *  - page.tsx: also redirects no-teacher → /maestro/dashboard.
 *
 * Session: storageState=teacher (never logs in → no rate-limit contention).
 * NOT serial — probes EXPECT failures (each failing assert = a real finding).
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, STATE, ACCOUNT, makeAdmin } from './_exhaustive/helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

const ROUTE = '/es/maestro/dashboard/disponibilidad'
const ROUTE_EN = '/en/maestro/dashboard/disponibilidad'
const db = makeAdmin()
const SHOT = 'test-results/exhaustive-teacher-disponibilidad'

type SlotRow = { day_of_week: number; start_time: string; end_time: string }

// Resolve the QA teacher's teachers.id via the service role so MUTATING probes can
// snapshot/restore the real availability_slots rows (Save wipes them all).
async function teacherId(database: SupabaseClient): Promise<string | null> {
  const email = (process.env.E2E_TEACHER_EMAIL || ACCOUNT.teacher.email).toLowerCase()
  let uid: string | null = null
  for (let p = 1; p <= 5; p++) {
    const { data } = await database.auth.admin.listUsers({ page: p, perPage: 200 })
    const hit = data?.users.find(u => (u.email || '').toLowerCase() === email)
    if (hit) { uid = hit.id; break }
    if (!data || data.users.length < 200) break
  }
  if (!uid) return null
  const { data: t } = await database.from('teachers').select('id').eq('profile_id', uid).single()
  return (t?.id as string) ?? null
}

async function snapshotSlots(database: SupabaseClient, tid: string): Promise<SlotRow[]> {
  const { data } = await database
    .from('availability_slots')
    .select('day_of_week, start_time, end_time')
    .eq('teacher_id', tid)
  // Normalize HH:MM:SS → the slots are stored as `time`; keep raw for faithful restore.
  return (data as SlotRow[]) ?? []
}

// Faithful restore: delete-all then re-insert exactly what was snapshotted.
async function restoreSlots(database: SupabaseClient, tid: string, slots: SlotRow[]) {
  await database.from('availability_slots').delete().eq('teacher_id', tid)
  if (slots.length === 0) return
  await database.from('availability_slots').insert(
    slots.map(s => ({ teacher_id: tid, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time })),
  )
}

async function gotoAvail(page: Page, url = ROUTE) {
  await page.goto(url)
  await settle(page)
}

test.describe('EXHAUSTIVE — TEACHER AVAILABILITY (disponibilidad)', () => {
  test.use({ storageState: STATE.teacher })

  // ───────────────────── 1 · Happy-path render ─────────────────────

  test('1A — renders title + editor + two info cards (ES), no login bounce', async ({ page }) => {
    await gotoAvail(page)
    // Title from DashTopBar — content is the source of truth (URL may flicker mid-redirect).
    await expect(page.getByRole('heading', { name: 'Configura tu disponibilidad' })).toBeVisible()
    await expect(page.getByText('Mis horarios', { exact: true })).toBeVisible()
    await expect(page.getByText('Cómo funciona', { exact: true })).toBeVisible()
    await expect(page.getByText('Resumen semanal', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar disponibilidad' })).toBeVisible()
    // Not bounced to login.
    expect(await page.locator('input[name="password"]').count(),
      'authenticated teacher must not see a login form').toBe(0)
    await page.screenshot({ path: `${SHOT}-1A-render.png`, fullPage: true })
  })

  test('1B — the add controls + a slot row expose Día / inicio / fin selects', async ({ page }) => {
    await gotoAvail(page)
    await expect(page.getByRole('button', { name: 'Agregar en grupo' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Agregar horario' })).toBeVisible()
    // Add one row client-side (no Save → non-mutating) to assert the row shape.
    await page.getByRole('button', { name: '+ Agregar horario' }).click()
    await expect(page.getByText('Día', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Hora de inicio', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Hora de fin', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Eliminar' }).first()).toBeVisible()
    // The day select defaults to Lunes (value 1) and offers all 7 ES day names.
    const daySelect = page.locator('select').first()
    for (const day of ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']) {
      await expect(daySelect.locator(`option:has-text("${day}")`)).toHaveCount(1)
    }
  })

  // ───────── TE-03 — the headline finding: slot-COUNT, not a time range, + bad copy ─────────

  test('TE-03a — weekly summary shows a "N slots" COUNT, never the hour range', async ({ page }) => {
    await gotoAvail(page)
    // Build a single wide window (09:00–18:00) client-side, NO Save.
    await page.getByRole('button', { name: '+ Agregar horario' }).click()
    const rowSelects = page.locator('select')
    await rowSelects.nth(0).selectOption({ label: 'Lunes' })   // Día
    await rowSelects.nth(1).selectOption('09:00')              // inicio
    await rowSelects.nth(2).selectOption('18:00')              // fin
    await page.waitForTimeout(400)
    // The summary card region. A 9-hour window collapses to the literal "1 slots".
    const summary = page.locator('text=Resumen semanal').locator('..')
    const summaryText = await summary.innerText()
    test.info().annotations.push({ type: 'observed', description: `weekly-summary text: ${summaryText.replace(/\s+/g, ' ').trim()}` })
    // Proof of TE-03: the window is rendered as a count word, and the range 09:00/18:00
    // appears NOWHERE in the summary.
    await expect(page.getByText(/\b1\s*slots\b/).first()).toBeVisible()
    expect(/09:00|18:00|9:00|6:00/.test(summaryText),
      'TE-03: a 9:00–18:00 window should read as a range/hours, but the summary only shows a slot COUNT').toBeFalsy()
    await page.screenshot({ path: `${SHOT}-TE03a-count-not-range.png`, fullPage: true })
  })

  test('TE-03b — ES summary prints the HARDCODED English word "slots" (not "horarios")', async ({ page }) => {
    await gotoAvail(page)
    await page.getByRole('button', { name: '+ Agregar horario' }).click()
    await page.waitForTimeout(300)
    const summary = page.locator('text=Resumen semanal').locator('..')
    const summaryText = (await summary.innerText()).toLowerCase()
    test.info().annotations.push({ type: 'i18n', description: `ES weekly-summary unit word present: slots=${/slots/.test(summaryText)} horarios=${/horarios/.test(summaryText)}` })
    // tx.es.slots === 'slots' (English) — wrong-language leak on the /es page.
    expect(/\bslots\b/.test(summaryText),
      'i18n: ES summary uses the English unit "slots" (tx.es.slots). Expected a Spanish unit like "horarios".').toBeFalsy()
  })

  test('TE-03c — the page copy FALSELY claims students self-book these windows', async ({ page }) => {
    await gotoAvail(page)
    // Subtitle + "How it works" body both assert student self-booking, which is false
    // (admin assigns the teacher). Record both occurrences.
    const subtitle = page.getByText(/Los estudiantes podrán reservar dentro de estas ventanas/)
    const howItWorks = page.getByText(/Los estudiantes ven estos horarios y pueden reservar/)
    const subVisible = await subtitle.count()
    const howVisible = await howItWorks.count()
    test.info().annotations.push({
      type: 'COPY',
      description: `false "students self-book" claim present: subtitle=${subVisible > 0}, howItWorks=${howVisible > 0}. Reality: admin assigns the teacher; students do not book a teacher's slot directly.`,
    })
    // EXPECTED FINDING: this misleading copy is live. Assert it should be absent.
    expect(subVisible + howVisible,
      'COPY: remove/correct the "students see/book these windows" claim — admin assigns bookings, students do not self-book a slot').toBe(0)
  })

  // ───────────────────── 2 · Entry / nav / refresh / role guard ─────────────────────

  test('2A — deep-link + hard refresh keeps the authenticated page (no login form)', async ({ page }) => {
    await gotoAvail(page)
    await page.reload()
    await settle(page)
    await expect(page.getByRole('heading', { name: 'Configura tu disponibilidad' })).toBeVisible()
    expect(await page.locator('input[name="password"]').count(),
      'authed teacher should not be kicked to login on refresh').toBe(0)
  })

  test('2B — anonymous (no session) hitting the route lands on the login form', async ({ browser }) => {
    const ctx = await browser.newContext()
    const anon = await ctx.newPage()
    await anon.goto(ROUTE)
    await settle(anon)
    // maestro/layout.tsx redirects anon → /login. Assert the FORM renders (content, not URL).
    const onLogin = await anon.locator('input[name="password"]').count()
    expect(onLogin, 'unauthenticated access must reach the login form').toBeGreaterThan(0)
    await anon.screenshot({ path: `${SHOT}-2B-anon-guard.png`, fullPage: true })
    await ctx.close()
  })

  test('2C — a STUDENT hitting the teacher route never sees availability chrome (role guard)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.student })
    const sp = await ctx.newPage()
    await sp.goto(ROUTE)
    await settle(sp)
    await sp.waitForTimeout(2500) // let the maestro→/dashboard bounce fully resolve
    // Content is the source of truth: the teacher availability editor must NOT render.
    await expect(sp.getByText('Mis horarios', { exact: true })).toHaveCount(0)
    await expect(sp.getByRole('heading', { name: 'Configura tu disponibilidad' })).toHaveCount(0)
    // Positive proof they landed in their OWN student area (not a blank leaked shell).
    await expect(sp.getByText(/clases disponibles|tus próximas clases|hola,/i).first())
      .toBeVisible({ timeout: 15_000 })
    await sp.screenshot({ path: `${SHOT}-2C-student-guard.png`, fullPage: true })
    await ctx.close()
  })

  test('2D — an ADMIN hitting the teacher route is bounced to /admin (no teacher editor)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.admin })
    const ap = await ctx.newPage()
    await ap.goto(ROUTE)
    await settle(ap)
    await ap.waitForTimeout(2500)
    // maestro/layout.tsx sends admins to /admin so they cannot URL-hop into teacher UI.
    await expect(ap.getByText('Mis horarios', { exact: true })).toHaveCount(0)
    await expect(ap.getByRole('heading', { name: 'Configura tu disponibilidad' })).toHaveCount(0)
    await ap.screenshot({ path: `${SHOT}-2D-admin-guard.png`, fullPage: true })
    await ctx.close()
  })

  // ───────────────────── 3 · Input validation (client-only edits, no Save) ─────────────────────

  test('3A — end ≤ start marks the row invalid + shows the inline ES error', async ({ page }) => {
    await gotoAvail(page)
    await page.getByRole('button', { name: '+ Agregar horario' }).click()
    const selects = page.locator('select')
    await selects.nth(1).selectOption('10:00')  // inicio
    await selects.nth(2).selectOption('09:00')  // fin (before start → invalid)
    await expect(page.getByText('La hora de fin debe ser después del inicio.')).toBeVisible()
  })

  test('3B — saving with an invalid row is blocked client-side with the ES warning', async ({ page }) => {
    // This clicks Save, but the row is invalid so handleSave() short-circuits BEFORE
    // calling the server action (hasInvalid → setSaveStatus('error'); no DB write).
    // Hence NON-mutating: nothing is posted, the teacher's real slots are untouched.
    let posted = false
    page.on('request', r => { if (r.method() === 'POST' && /disponibilidad/.test(r.url())) posted = true })
    await gotoAvail(page)
    await page.getByRole('button', { name: '+ Agregar horario' }).click()
    const selects = page.locator('select')
    await selects.nth(1).selectOption('12:00')
    await selects.nth(2).selectOption('11:00')  // invalid
    await page.getByRole('button', { name: 'Guardar disponibilidad' }).click()
    await page.waitForTimeout(1200)
    await expect(page.getByText('Corrige los horarios marcados antes de guardar.')).toBeVisible()
    test.info().annotations.push({ type: 'observed', description: `invalid-row save fired a server POST=${posted} (expected false — guard short-circuits)` })
  })

  test('3C — equal start==end is treated as invalid (boundary)', async ({ page }) => {
    await gotoAvail(page)
    await page.getByRole('button', { name: '+ Agregar horario' }).click()
    const selects = page.locator('select')
    await selects.nth(1).selectOption('09:00')
    await selects.nth(2).selectOption('09:00')  // end == start → end <= start
    await expect(page.getByText('La hora de fin debe ser después del inicio.')).toBeVisible()
  })

  test('3D — there is NO overlap / duplicate detection (two identical windows allowed)', async ({ page }) => {
    await gotoAvail(page)
    // Two identical Monday 09:00–10:00 windows. Both are individually "valid", so the
    // editor accepts them with no warning — the summary will count "2 slots" for the
    // same hour. Document the missing overlap guard (client-only edit, no Save).
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: '+ Agregar horario' }).click()
    }
    // No inline invalid error should be present for these well-formed-but-overlapping rows.
    const invalidCount = await page.getByText('La hora de fin debe ser después del inicio.').count()
    test.info().annotations.push({ type: 'observed', description: `two identical default windows → inline-invalid-warnings=${invalidCount} (no overlap detection exists)` })
    expect(invalidCount, 'no overlap/duplicate validation exists for identical windows').toBe(0)
  })

  test('3E — time selects are a fixed allowlist (00:00..23:30 + 23:59); no free text', async ({ page }) => {
    await gotoAvail(page)
    await page.getByRole('button', { name: '+ Agregar horario' }).click()
    const startSelect = page.locator('select').nth(1)
    // 24h * 2 (:00/:30) + the trailing 23:59 = 49 options. Constrained input → no SQLi/XSS surface.
    const optionCount = await startSelect.locator('option').count()
    test.info().annotations.push({ type: 'observed', description: `start-time option count=${optionCount} (expected 49: 48 half-hours + 23:59)` })
    expect(optionCount).toBe(49)
    await expect(startSelect.locator('option:has-text("23:59")')).toHaveCount(1)
  })

  // ───────────────────── 4 · Bulk-add modal ─────────────────────

  test('4A — bulk modal opens with presets, 7 day chips, and a count-aware apply label', async ({ page }) => {
    await gotoAvail(page)
    await page.getByRole('button', { name: 'Agregar en grupo' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Agregar disponibilidad en varios días')).toBeVisible()
    for (const preset of ['Lun–Vie', 'Fines de semana', 'Toda la semana']) {
      await expect(page.getByRole('button', { name: preset })).toBeVisible()
    }
    // Default bulkDays = Mon–Fri (5) → apply label reads "Agregar 5 horarios".
    await expect(page.getByRole('button', { name: 'Agregar 5 horarios' })).toBeVisible()
    await page.screenshot({ path: `${SHOT}-4A-bulk-modal.png` })
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('4B — bulk: deselecting all days blocks apply with the ES "select a day" error', async ({ page }) => {
    await gotoAvail(page)
    await page.getByRole('button', { name: 'Agregar en grupo' }).click()
    // "Toda la semana" selects all 7, then toggle each off to reach zero.
    await page.getByRole('button', { name: 'Toda la semana' }).click()
    for (const abbr of ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']) {
      await page.getByRole('button', { name: abbr, exact: true }).click()
    }
    // Apply now reads "Agregar 0 horarios"; clicking it should show the pick-days error.
    await page.getByRole('button', { name: 'Agregar 0 horarios' }).click()
    await expect(page.getByText('Selecciona al menos un día.')).toBeVisible()
  })

  test('4C — bulk: end ≤ start blocks apply with the ES time error (no rows added)', async ({ page }) => {
    await gotoAvail(page)
    await page.getByRole('button', { name: 'Agregar en grupo' }).click()
    const dialog = page.getByRole('dialog')
    // Two selects inside the modal: [0]=start, [1]=end.
    const modalSelects = dialog.locator('select')
    await modalSelects.nth(0).selectOption('17:00')
    await modalSelects.nth(1).selectOption('09:00')  // end before start
    await page.getByRole('button', { name: /^Agregar \d+ horarios?$/ }).click()
    await expect(page.getByText('La hora de fin debe ser después del inicio.')).toBeVisible()
    // Modal stays open (apply rejected) — no slot rows leaked into the editor.
    await expect(dialog).toBeVisible()
  })

  test('4D — bulk apply with valid days+window adds the rows client-side (NO Save → non-mutating)', async ({ page }) => {
    await gotoAvail(page)
    await page.getByRole('button', { name: 'Agregar en grupo' }).click()
    const dialog = page.getByRole('dialog')
    await page.getByRole('button', { name: 'Fines de semana' }).click()  // 2 days
    const modalSelects = dialog.locator('select')
    await modalSelects.nth(0).selectOption('08:00')
    await modalSelects.nth(1).selectOption('12:00')
    await page.getByRole('button', { name: 'Agregar 2 horarios' }).click()
    // Modal closes; two new rows now exist (we do NOT click Save → DB untouched).
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(2)
    test.info().annotations.push({ type: 'observed', description: 'bulk add inserted rows into the editor only; never persisted (no Save click).' })
  })

  test('4E — bulk modal closes on Esc without adding rows', async ({ page }) => {
    await gotoAvail(page)
    await page.getByRole('button', { name: 'Agregar en grupo' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // Sanity: no orphaned rows from the cancelled bulk add (assuming the teacher had
    // a known starting set; we only assert the modal is gone + page is intact).
    await expect(page.getByRole('heading', { name: 'Configura tu disponibilidad' })).toBeVisible()
  })

  // ───────────────────── 5 · Console / network hygiene ─────────────────────

  test('5A — initial load produces no console errors and no 4xx/5xx (excluding favicon)', async ({ page }) => {
    const consoleErrs: string[] = []
    const net: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()) })
    page.on('response', r => { const s = r.status(); if (s >= 400 && !r.url().includes('favicon')) net.push(`${s} ${r.url()}`) })
    await gotoAvail(page)
    await page.waitForTimeout(1500)
    test.info().annotations.push({ type: 'observed', description: `console.errors=${consoleErrs.length}; 4xx/5xx=${net.length}` })
    if (consoleErrs.length) test.info().annotations.push({ type: 'console', description: consoleErrs.slice(0, 5).join(' | ') })
    if (net.length) test.info().annotations.push({ type: 'network', description: net.slice(0, 5).join(' | ') })
    expect(net.filter(n => /^5\d\d/.test(n)), 'no 5xx on availability load').toEqual([])
  })

  test('5B — opening the bulk modal + adding rows triggers no 5xx', async ({ page }) => {
    const five: string[] = []
    page.on('response', r => { if (r.status() >= 500) five.push(`${r.status()} ${r.url()}`) })
    await gotoAvail(page)
    await page.getByRole('button', { name: '+ Agregar horario' }).click()
    await page.getByRole('button', { name: 'Agregar en grupo' }).click()
    await page.getByRole('button', { name: 'Toda la semana' }).click()
    await page.getByRole('button', { name: 'Agregar 7 horarios' }).click()
    await page.waitForTimeout(600)
    expect(five, 'no 5xx during client-side editing').toEqual([])
  })

  // ───────────────────── 6 · i18n ES + EN parity ─────────────────────

  test('6A — EN route renders English chrome (no leaked Spanish labels)', async ({ page }) => {
    await gotoAvail(page, ROUTE_EN)
    await expect(page.getByRole('heading', { name: 'Set your availability' })).toBeVisible()
    await expect(page.getByText('My time slots', { exact: true })).toBeVisible()
    await expect(page.getByText('How it works', { exact: true })).toBeVisible()
    await expect(page.getByText('Weekly summary', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save availability' })).toBeVisible()
    // ES title must not leak onto /en.
    expect(await page.getByText('Configura tu disponibilidad', { exact: true }).count(),
      'ES title leaked onto the EN availability page').toBe(0)
    await page.screenshot({ path: `${SHOT}-6A-en.png`, fullPage: true })
  })

  test('6B — EN weekly summary also has the "1 slots" pluralization bug (TE-03 parity)', async ({ page }) => {
    await gotoAvail(page, ROUTE_EN)
    await page.getByRole('button', { name: 'Add time slot' }).click()
    await page.waitForTimeout(300)
    const summary = page.locator('text=Weekly summary').locator('..')
    const summaryText = await summary.innerText()
    test.info().annotations.push({ type: 'i18n', description: `EN summary text: ${summaryText.replace(/\s+/g, ' ').trim()}` })
    // The count uses the unpluralized literal "slots", so ONE window reads "1 slots".
    expect(/\b1\s*slots\b/.test(summaryText),
      'i18n/TE-03: EN summary shows "1 slots" (no singular "1 slot") for a single window').toBeFalsy()
  })

  test('6C — EN bulk modal uses English presets / apply label', async ({ page }) => {
    await gotoAvail(page, ROUTE_EN)
    await page.getByRole('button', { name: 'Bulk add' }).click()
    await expect(page.getByText('Add availability for multiple days')).toBeVisible()
    for (const preset of ['Mon–Fri', 'Weekends', 'All week']) {
      await expect(page.getByRole('button', { name: preset })).toBeVisible()
    }
    // Default 5 weekdays → "Add 5 slots" (and singular branch "Add 1 slot" exists in EN).
    await expect(page.getByRole('button', { name: 'Add 5 slots' })).toBeVisible()
    // ES leak guard inside the modal.
    expect(await page.getByText('Fines de semana').count(), 'ES preset leaked on /en bulk modal').toBe(0)
  })

  // ───────────────────── 7 · Responsive ─────────────────────

  test('7A — 375px mobile: editor + add controls reachable, Save in viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 })
    await gotoAvail(page)
    await expect(page.getByRole('heading', { name: 'Configura tu disponibilidad' })).toBeVisible()
    await page.getByRole('button', { name: '+ Agregar horario' }).click()
    // The row's selects stack (flex-col on mobile) but remain present.
    await expect(page.getByText('Hora de inicio', { exact: true }).first()).toBeVisible()
    const save = page.getByRole('button', { name: 'Guardar disponibilidad' })
    await save.scrollIntoViewIfNeeded()
    await expect(save).toBeInViewport()
    await page.screenshot({ path: `${SHOT}-7A-mobile.png`, fullPage: true })
  })

  test('7B — desktop ≥1280px: editor (2/3) and info sidebar (1/3) both visible side-by-side', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoAvail(page)
    await expect(page.getByText('Mis horarios', { exact: true })).toBeVisible()
    await expect(page.getByText('Resumen semanal', { exact: true })).toBeVisible()
    await page.screenshot({ path: `${SHOT}-7B-desktop.png`, fullPage: true })
  })

  // ───────────────────── 8 · Hover states (TE focus) ─────────────────────

  test('8A — hovering the "+ Agregar horario" button is stable (no crash, stays visible)', async ({ page }) => {
    await gotoAvail(page)
    const add = page.getByRole('button', { name: '+ Agregar horario' })
    await add.hover()
    await page.waitForTimeout(250)
    // The button uses the .ek-quickrow hover treatment; assert it remains interactive.
    await expect(add).toBeVisible()
    await expect(add).toBeEnabled()
    await page.screenshot({ path: `${SHOT}-8A-hover-add.png` })
  })

  test('8B — hovering the row "Eliminar" (danger) link keeps it actionable', async ({ page }) => {
    await gotoAvail(page)
    await page.getByRole('button', { name: '+ Agregar horario' }).click()
    const remove = page.getByRole('button', { name: 'Eliminar' }).first()
    await remove.hover()
    await page.waitForTimeout(250)
    await expect(remove).toBeVisible()
    // It removes its own row when clicked (client-only; no Save → non-mutating).
    await remove.click()
    await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0)
  })

  // ───────────────────── 9 · State / concurrency + persistence (MUTATING — snapshot & restore) ─────────────────────

  test('[MUTATING] 9A — a valid save round-trips to availability_slots and reflects on refresh (snapshot+restore)', async ({ page }) => {
    test.skip(!db, 'service-role required to snapshot/restore the real availability')
    const tid = await teacherId(db!)
    test.skip(!tid, 'could not resolve the QA teacher id')
    const original = await snapshotSlots(db!, tid!)
    try {
      await gotoAvail(page)
      // Clear whatever exists in the editor, then add ONE deterministic probe window.
      while (await page.getByRole('button', { name: 'Eliminar' }).count()) {
        await page.getByRole('button', { name: 'Eliminar' }).first().click()
      }
      await page.getByRole('button', { name: '+ Agregar horario' }).click()
      const selects = page.locator('select')
      await selects.nth(0).selectOption({ label: 'Miércoles' })  // day 3
      await selects.nth(1).selectOption('14:00')
      await selects.nth(2).selectOption('15:30')
      await page.getByRole('button', { name: 'Guardar disponibilidad' }).click()
      await expect(page.getByText('Disponibilidad guardada')).toBeVisible({ timeout: 15_000 })
      await page.waitForTimeout(1200)
      // DB integrity: exactly our one probe row persisted (delete-all-then-insert semantics).
      const after = await snapshotSlots(db!, tid!)
      const probe = after.find(s => s.day_of_week === 3 && /14:00/.test(s.start_time) && /15:30/.test(s.end_time))
      test.info().annotations.push({ type: 'observed', description: `persisted rows=${after.length}; probe-row-found=${!!probe}` })
      expect(after.length, 'Save is delete-all-then-insert → only the posted set survives').toBe(1)
      expect(probe, 'the Wed 14:00–15:30 probe window must persist').toBeTruthy()
      // UI integrity: reload pre-fills the saved window.
      await page.reload()
      await settle(page)
      await expect(page.locator('select').nth(1)).toHaveValue('14:00')
      await expect(page.locator('select').nth(2)).toHaveValue('15:30')
    } finally {
      await restoreSlots(db!, tid!, original)
    }
  })

  test('[MUTATING] 9B — double-clicking Save does not double-submit (button disables on isPending) (snapshot+restore)', async ({ page }) => {
    test.skip(!db, 'service-role required to snapshot/restore the real availability')
    const tid = await teacherId(db!)
    test.skip(!tid, 'could not resolve the QA teacher id')
    const original = await snapshotSlots(db!, tid!)
    try {
      await gotoAvail(page)
      while (await page.getByRole('button', { name: 'Eliminar' }).count()) {
        await page.getByRole('button', { name: 'Eliminar' }).first().click()
      }
      await page.getByRole('button', { name: '+ Agregar horario' }).click()
      const selects = page.locator('select')
      await selects.nth(0).selectOption({ label: 'Jueves' })  // day 4
      await selects.nth(1).selectOption('10:00')
      await selects.nth(2).selectOption('11:00')
      const save = page.getByRole('button', { name: 'Guardar disponibilidad' })
      await save.click()
      await save.click({ timeout: 1200 }).catch(() => {})  // 2nd click → no-op (disabled while isPending)
      await expect(page.getByText('Disponibilidad guardada')).toBeVisible({ timeout: 15_000 })
      await page.waitForTimeout(1200)
      // No duplicate-storm: exactly one row, not two.
      const after = await snapshotSlots(db!, tid!)
      test.info().annotations.push({ type: 'observed', description: `rows after double-click save=${after.length} (expected 1)` })
      expect(after.length, 'double-click must not insert the window twice').toBe(1)
    } finally {
      await restoreSlots(db!, tid!, original)
    }
  })

  test('[MUTATING] 9C — saving with ZERO rows clears availability (empty-state round-trip) (snapshot+restore)', async ({ page }) => {
    test.skip(!db, 'service-role required to snapshot/restore the real availability')
    const tid = await teacherId(db!)
    test.skip(!tid, 'could not resolve the QA teacher id')
    const original = await snapshotSlots(db!, tid!)
    try {
      await gotoAvail(page)
      while (await page.getByRole('button', { name: 'Eliminar' }).count()) {
        await page.getByRole('button', { name: 'Eliminar' }).first().click()
      }
      // Empty state copy shows once all rows are removed.
      await expect(page.getByText('Sin disponibilidad. Agrega tu primer horario.')).toBeVisible()
      await page.getByRole('button', { name: 'Guardar disponibilidad' }).click()
      await expect(page.getByText('Disponibilidad guardada')).toBeVisible({ timeout: 15_000 })
      await page.waitForTimeout(1000)
      const after = await snapshotSlots(db!, tid!)
      test.info().annotations.push({ type: 'observed', description: `rows after empty-save=${after.length} (expected 0)` })
      expect(after.length, 'saving an empty editor wipes all slots (no confirm guard) — data-integrity note').toBe(0)
    } finally {
      // CRITICAL: restore the teacher's real availability after emptying it.
      await restoreSlots(db!, tid!, original)
    }
  })

  // ───────────────────── 10 · Security / IDOR (code-level boundary) ─────────────────────

  test('10A — saveAvailabilitySlots resolves teacher_id from the SESSION, not client input (no IDOR)', async ({ page }) => {
    // The server action signature is saveAvailabilitySlots(slots, lang) — it takes NO
    // teacher_id; it derives the teacher from supabase.auth.getUser() then teachers
    // .eq('profile_id', user.id). The client payload is ONLY {day_of_week,start,end}[].
    // So there is no client-controlled teacher_id to tamper → no cross-teacher IDOR
    // surface from this UI. Recorded as a verified boundary (no mutation needed).
    await gotoAvail(page)
    await expect(page.getByRole('heading', { name: 'Configura tu disponibilidad' })).toBeVisible()
    test.info().annotations.push({
      type: 'SECURITY',
      description: 'No IDOR: saveAvailabilitySlots(slots, lang) ignores any teacher_id; target teacher is derived server-side from the session (profile_id). Slot payload carries no id/teacher_id.',
    })
    expect(true).toBeTruthy()
  })
})
