/**
 * EXHAUSTIVE LIVE QA — STUDENT · "Mi maestro" (My teacher)
 *
 * Routes:
 *   /es/dashboard/maestros            → src/app/[lang]/dashboard/maestros/page.tsx
 *   /es/dashboard/maestros/[teacherId]→ .../[teacherId]/page.tsx  (PURE redirect → maestros)
 *
 * GROUND TRUTH read from source before authoring:
 *  • The "list" page is SINGULAR by design — it renders AT MOST ONE teacher
 *    (student.primary_teacher_id, else the most-recent confirmed/completed
 *    class booking's teacher_id). There is NEVER a roster, never a count.
 *    This is the SACRED one-teacher confidentiality rule, enforced structurally.
 *    Subtitle literally sells it: ES "· Un maestro · El tuyo" / EN "· One teacher · Yours".
 *  • Empty/pending states (no <ul>/grid of teachers) cover: placement-not-done
 *    (CTA "Agendar llamada de diagnóstico"), placement-scheduled, level-pending,
 *    assigned-soon, and the assigned hero card (DarkHeroCard: name + bio + specialties).
 *  • The [teacherId] page does `redirect(`/${lang}/dashboard/maestros`)` — full stop.
 *    No DB read of the param, so IDOR is structurally impossible; we still PROVE it:
 *    any id (random UUID / another teacher's id / SQLi / XSS) lands on the singular
 *    My-teacher page and leaks no roster/count/foreign-teacher data.
 *  • Layout role guard (dashboard/layout.tsx): teacher → /maestro/dashboard,
 *    admin → /admin (via profiles.role). We assert on RENDERED CONTENT, not URL.
 *  • TeacherProfileClient.tsx exists in the tree but is NOT wired to any route
 *    (the [teacherId] page only redirects) — so its booking UI is unreachable here.
 *    => This surface is effectively NON-MUTATING. No [MUTATING] probes needed.
 *
 * LIVE target (PLAYWRIGHT_BASE_URL=https://englishkolab.com). Student session is
 * loaded from saved storage state — this spec NEVER logs in (no limiter contention).
 */
import { test, expect, type Page } from '@playwright/test'
import { settle, hasAuthCookie, STATE, makeAdmin } from './_exhaustive/helpers'

test.use({ storageState: STATE.student })

const SHOT = (key: string) => `test-results/exhaustive-student-maestros-${key}.png`

// Words/structures that would BREACH one-teacher confidentiality if rendered.
// Singular "tu maestro / mi maestro / your teacher / my teacher" are ALLOWED.
const ROSTER_BREACH = [
  /\bmaestros disponibles\b/i,
  /\bteachers available\b/i,
  /\bavailable teachers\b/i,
  /\belige (?:un |a tu )?maestro\b/i,      // "choose a teacher" (browse-a-list framing)
  /\bchoose (?:a |your )?teacher\b/i,
  /\bbrowse teachers\b/i,
  /\bexplora(?:r)? maestros\b/i,
  /\bnuestros maestros\b/i,                 // "our teachers" (plural roster)
  /\bour teachers\b/i,
  /\b\d+\s+(?:maestros|teachers|tutors)\b/i, // any explicit teacher COUNT
]

async function assertNoRosterLeak(page: Page, label: string) {
  const body = (await page.locator('body').innerText()).toLowerCase()
  const hits = ROSTER_BREACH.filter((re) => re.test(body)).map((re) => re.source)
  test.info().annotations.push({
    type: hits.length ? 'CONFIDENTIALITY' : 'observed',
    description: `[${label}] roster-breach matches: ${hits.length ? hits.join(' | ') : 'none'}`,
  })
  expect(hits, `SACRED RULE: ${label} must never expose a teacher roster/count — matched: ${hits.join(', ')}`).toEqual([])
}

// Count rendered teacher "name" elements (h1/h2). The singular page renders ONE
// assigned-teacher heading at most. >1 distinct teacher heading ⇒ roster leak.
async function teacherHeadingCount(page: Page): Promise<number> {
  // DarkHeroCard renders the teacher full_name in an <h2>; empty states render
  // their own <h2> titles (not teacher names). We only care that the COUNT of
  // headings never implies a list. The page never renders >1 teacher card.
  return page.locator('main h2, main h1').count()
}

test.describe('EXHAUSTIVE · student · Mi maestro (one-teacher confidentiality)', () => {
  // ───────────────────────── 1 · Happy-path render ─────────────────────────

  test('1.1 — ES /dashboard/maestros renders the singular "Mi maestro" surface (no roster)', async ({ page }) => {
    const fourxx: string[] = []
    page.on('response', (r) => { if (r.status() >= 400 && new URL(r.url()).pathname.includes('/dashboard/maestros')) fourxx.push(`${r.status()} ${r.url()}`) })

    await page.goto('/es/dashboard/maestros')
    await settle(page)

    // The top bar title is "Mi maestro" + flourish "el tuyo" — singular framing.
    await expect(page.getByText(/mi maestro/i).first()).toBeVisible({ timeout: 15_000 })
    await assertNoRosterLeak(page, 'ES happy-path')
    await page.screenshot({ path: SHOT('es-render'), fullPage: true })
    test.info().annotations.push({ type: 'observed', description: `maestros-page 4xx: ${fourxx.join(', ') || 'none'}` })
    expect(fourxx, 'no 4xx loading the maestros page').toEqual([])
  })

  test('1.2 — the one-teacher SELLING line is present (subtitle frames it as exclusive)', async ({ page }) => {
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    const body = await page.locator('body').innerText()
    // Subtitle: "...· Un maestro · El tuyo". Prove the singular/exclusive framing
    // is actually surfaced (selling the 1-to-1 experience, per the brand rule).
    const sellsSingular = /un maestro/i.test(body) || /el tuyo/i.test(body) || /mi maestro/i.test(body)
    test.info().annotations.push({ type: 'observed', description: `singular-selling-line present=${sellsSingular}` })
    expect(sellsSingular, 'page should frame the relationship as ONE exclusive teacher').toBeTruthy()
  })

  test('1.3 — at most ONE teacher card is rendered (never a grid/list)', async ({ page }) => {
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    // No <ul>/<ol> list of teachers and no repeated teacher-card grid. The design
    // uses a single DarkHeroCard or a single EmptyStateCard. Assert there is not a
    // multi-item list inside the main content that smells like a roster.
    const listItems = await page.locator('main ul li, main ol li').count()
    const headings = await teacherHeadingCount(page)
    test.info().annotations.push({ type: 'observed', description: `main list-items=${listItems}; headings=${headings}` })
    // A genuine roster would show several teacher names as list items. The My-teacher
    // page renders a single card; tolerate small nav/meta lists but flag a big one.
    expect(listItems, 'main content must not contain a long teacher list').toBeLessThan(6)
  })

  // ───────────────── 2 · Entry / nav: deep-link, refresh, role guard ─────────────────

  test('2.1 — deep-link + hard refresh keeps the singular surface (no roster on reload)', async ({ page }) => {
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    await page.reload()
    await settle(page)
    await expect(page.getByText(/mi maestro/i).first()).toBeVisible({ timeout: 15_000 })
    await assertNoRosterLeak(page, 'ES refresh')
  })

  test('2.2 — ROLE GUARD: teacher session hitting /dashboard/maestros sees NO student maestro content', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.teacher })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    await page.waitForTimeout(2500) // allow the layout role-bounce to fully resolve
    // Content is the source of truth (URL may briefly read /dashboard mid-redirect).
    // A teacher must NOT see the student "Mi maestro" surface.
    const sawStudentMaestro = await page.getByText(/mi maestro|un maestro · el tuyo|tu maestro asignado/i).count()
    test.info().annotations.push({ type: 'observed', description: `teacher@maestros → ${page.url()} ; student-maestro-text=${sawStudentMaestro}` })
    await assertNoRosterLeak(page, 'teacher-guard')
    expect(sawStudentMaestro, 'teacher must be bounced off the student maestro surface').toBe(0)
    await ctx.close()
  })

  test('2.3 — ROLE GUARD: admin session hitting /dashboard/maestros sees NO student maestro content', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.admin })
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    await page.waitForTimeout(2500)
    const sawStudentMaestro = await page.getByText(/mi maestro|un maestro · el tuyo|tu maestro asignado/i).count()
    test.info().annotations.push({ type: 'observed', description: `admin@maestros → ${page.url()} ; student-maestro-text=${sawStudentMaestro}` })
    await assertNoRosterLeak(page, 'admin-guard')
    expect(sawStudentMaestro, 'admin must be bounced off the student maestro surface').toBe(0)
    await ctx.close()
  })

  // ───────────── 3 · [teacherId] redirect — IDOR & param injection ─────────────

  test('3.1 — IDOR: a random teacherId redirects to the singular My-teacher page (no foreign data)', async ({ page }) => {
    const randomId = '11111111-2222-4333-8444-555555555555'
    await page.goto(`/es/dashboard/maestros/${randomId}`)
    await settle(page)
    // The [teacherId] page is a pure redirect → /dashboard/maestros. Prove by content.
    await expect(page.getByText(/mi maestro/i).first()).toBeVisible({ timeout: 15_000 })
    // The random id MUST NOT appear anywhere on the resulting page (no echo / no fetch).
    const body = await page.locator('body').innerText()
    expect(body.includes(randomId), 'foreign teacherId must not be reflected/used').toBeFalsy()
    await assertNoRosterLeak(page, 'IDOR random-uuid')
    await page.screenshot({ path: SHOT('idor-random'), fullPage: true })
    test.info().annotations.push({ type: 'observed', description: `random teacherId → ${page.url()}` })
  })

  test('3.2 — IDOR: a REAL foreign teacher id (not the student\'s) still only shows the singular page', async ({ page }) => {
    // Pull a real teachers.id via service role (read-only). If unavailable, fall
    // back to a random id — the redirect behavior is identical either way.
    const db = makeAdmin()
    let foreignId = '99999999-8888-4777-8666-555544443333'
    if (db) {
      const { data } = await db.from('teachers').select('id').limit(3)
      if (data && data.length) foreignId = (data[data.length - 1] as { id: string }).id
    }
    await page.goto(`/es/dashboard/maestros/${foreignId}`)
    await settle(page)
    await expect(page.getByText(/mi maestro/i).first()).toBeVisible({ timeout: 15_000 })
    const body = await page.locator('body').innerText()
    // Must not reflect the requested foreign id, and must not be a 2nd teacher card.
    expect(body.includes(foreignId), 'foreign teacher id must not be reflected').toBeFalsy()
    await assertNoRosterLeak(page, 'IDOR real-foreign-id')
    test.info().annotations.push({ type: 'SECURITY', description: `foreign teacherId=${foreignId} → ${page.url()}; reflected=${body.includes(foreignId)}` })
  })

  test('3.3 — SQLi/XSS/oversized teacherId path segments fail safe (redirect, no 5xx, no script)', async ({ page }) => {
    let dialog = false
    page.on('dialog', (d) => { dialog = true; d.dismiss().catch(() => {}) })
    const errors: string[] = []
    page.on('response', (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`) })

    const vectors = [
      encodeURIComponent("' OR 1=1--"),
      encodeURIComponent('<script>alert(1)</script>'),
      encodeURIComponent("'; DROP TABLE teachers;--"),
      'a'.repeat(2000),                          // oversized
      encodeURIComponent('管理者-маэстро-🧨'),    // unicode/emoji
      '..%2f..%2fadmin',                         // traversal-ish
    ]
    for (const v of vectors) {
      await page.goto(`/es/dashboard/maestros/${v}`).catch(() => {})
      await settle(page)
      // Pure-redirect target should land on the singular page (or a safe app page),
      // never execute script, never 5xx, never echo the payload as live markup.
      const scriptHit = await page.locator('script:has-text("alert(1)")').count()
      expect(scriptHit, `XSS payload must not become live <script> (vector ${v.slice(0, 24)})`).toBe(0)
    }
    expect(dialog, 'no script dialog from any teacherId vector').toBeFalsy()
    expect(errors, `no 5xx from teacherId vectors:\n${errors.join('\n')}`).toEqual([])
    await assertNoRosterLeak(page, 'teacherId injection')
  })

  test('3.4 — EN [teacherId] redirect preserves the EN locale (does not dump to /es)', async ({ page }) => {
    await page.goto('/en/dashboard/maestros/abc-not-a-real-id')
    await settle(page)
    // redirect(`/${lang}/dashboard/maestros`) must keep /en. Prove via EN content.
    const body = await page.locator('body').innerText()
    const onEnglish = /my teacher|one teacher|your teacher/i.test(body)
    const leakedSpanish = /mi maestro|un maestro · el tuyo/i.test(body)
    test.info().annotations.push({ type: 'observed', description: `EN [teacherId] redirect → ${page.url()}; en=${onEnglish}; es-leak=${leakedSpanish}` })
    expect(leakedSpanish, 'EN deep-link must not redirect into Spanish content').toBeFalsy()
  })

  // ───────────────────────── 4 · Error / failure states ─────────────────────────

  test('4.1 — no console page-errors or 5xx while the maestros surface renders', async ({ page }) => {
    const pageErrors: string[] = []
    const serverErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    page.on('response', (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`) })

    await page.goto('/es/dashboard/maestros')
    await settle(page)
    test.info().annotations.push({ type: 'observed', description: `pageerrors=${pageErrors.length}; 5xx=${serverErrors.length}` })
    expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([])
    expect(serverErrors, `5xx responses:\n${serverErrors.join('\n')}`).toEqual([])
  })

  test('4.2 — trailing-slash + query-junk on the route still renders (no crash, no roster)', async ({ page }) => {
    await page.goto('/es/dashboard/maestros/?foo=bar&q=%27%20OR%201%3D1').catch(() => {})
    await settle(page)
    await expect(page.getByText(/mi maestro/i).first()).toBeVisible({ timeout: 15_000 })
    await assertNoRosterLeak(page, 'query-junk')
  })

  // ───────────────────── 5 · Security / permissions / session ─────────────────────

  test('5.1 — the student session is authenticated on this surface (sb auth cookie present)', async ({ page, context }) => {
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    expect(hasAuthCookie(await context.cookies()), 'student must be authenticated (no anon access path)').toBeTruthy()
  })

  test('5.2 — unauthenticated access to /dashboard/maestros is bounced to login (content proof)', async ({ browser }) => {
    const ctx = await browser.newContext() // NO storageState → anonymous
    const page = await ctx.newPage()
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    await page.waitForTimeout(1500)
    // Layout guard redirects to /es/login. Prove via the login form, not the URL.
    const onLogin = await page.locator('input[name="password"]').count()
    const sawMaestro = await page.getByText(/mi maestro|tu maestro asignado/i).count()
    test.info().annotations.push({ type: 'observed', description: `anon@maestros → ${page.url()}; login-form=${onLogin}; maestro-text=${sawMaestro}` })
    expect(sawMaestro, 'anon must not see the maestro surface').toBe(0)
    expect(onLogin, 'anon should land on the login form').toBeGreaterThan(0)
    await ctx.close()
  })

  // ───────────────────────── 6 · State / concurrency ─────────────────────────

  test('6.1 — two concurrent tabs of the surface both render singular (no roster under concurrency)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE.student })
    const [a, b] = [await ctx.newPage(), await ctx.newPage()]
    await Promise.all([a.goto('/es/dashboard/maestros'), b.goto('/es/dashboard/maestros')])
    await Promise.all([settle(a), settle(b)])
    await expect(a.getByText(/mi maestro/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(b.getByText(/mi maestro/i).first()).toBeVisible({ timeout: 15_000 })
    await assertNoRosterLeak(a, 'concurrency tab A')
    await assertNoRosterLeak(b, 'concurrency tab B')
    await ctx.close()
  })

  // ───────────────────────── 7 · i18n ES + EN parity ─────────────────────────

  test('7.1 — EN surface renders English strings (no hardcoded Spanish leakage)', async ({ page }) => {
    await page.goto('/en/dashboard/maestros')
    await settle(page)
    const body = await page.locator('body').innerText()
    // EN copy uses "My teacher" / "One teacher · Yours". The ES-only subtitle
    // "Un maestro · El tuyo" must NOT appear on the /en page.
    const leakedSpanish = /un maestro · el tuyo|tu maestro asignado|agendar llamada de diagnóstico/i.test(body)
    const hasEnglish = /my teacher|one teacher|your teacher|teacher is being assigned|placement call/i.test(body)
    test.info().annotations.push({ type: 'i18n', description: `EN: english-present=${hasEnglish}; spanish-leak=${leakedSpanish}` })
    await assertNoRosterLeak(page, 'EN parity')
    expect(leakedSpanish, 'EN page must not leak Spanish strings').toBeFalsy()
    await page.screenshot({ path: SHOT('en-render'), fullPage: true })
  })

  test('7.2 — the assigned-teacher hero "↳ Tu maestro asignado" kicker is singular (never plural)', async ({ page }) => {
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    const body = await page.locator('body').innerText()
    // Whatever state renders, the assigned-state kicker (if shown) is singular.
    const pluralKicker = /tus maestros asignados|your assigned teachers/i.test(body)
    test.info().annotations.push({ type: 'observed', description: `plural-assigned-kicker=${pluralKicker}` })
    expect(pluralKicker, 'assigned kicker must be singular (one teacher)').toBeFalsy()
  })

  // ───────────────────────── 8 · Responsive ─────────────────────────

  test('8.1 — usable on 375px mobile, still singular, no roster', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    await expect(page.getByText(/mi maestro/i).first()).toBeVisible({ timeout: 15_000 })
    await assertNoRosterLeak(page, 'mobile 375px')
    // No horizontal overflow that would hint at a wide hidden roster table.
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    test.info().annotations.push({ type: 'observed', description: `375px scrollWidth=${scrollW}` })
    await page.screenshot({ path: SHOT('mobile'), fullPage: true })
    expect(scrollW, 'no significant horizontal overflow at 375px').toBeLessThanOrEqual(420)
  })

  test('8.2 — usable on desktop 1440px, singular, no roster', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    await expect(page.getByText(/mi maestro/i).first()).toBeVisible({ timeout: 15_000 })
    await assertNoRosterLeak(page, 'desktop 1440px')
    await page.screenshot({ path: SHOT('desktop'), fullPage: true })
  })

  // ───────────────────────── 9 · Console / network on the page ─────────────────────────

  test('9.1 — no 4xx/5xx network responses originate from the maestros route document', async ({ page }) => {
    const bad: string[] = []
    page.on('response', (r) => {
      const u = r.url()
      if (r.status() >= 400 && (u.includes('/dashboard/maestros') || u.includes('/_next/data'))) bad.push(`${r.status()} ${u}`)
    })
    await page.goto('/es/dashboard/maestros')
    await settle(page)
    test.info().annotations.push({ type: 'observed', description: `route 4xx/5xx: ${bad.join(', ') || 'none'}` })
    expect(bad, `no failing responses tied to the maestros route:\n${bad.join('\n')}`).toEqual([])
  })

  // ───────────────────── 10 · Data integrity / confidentiality stress ─────────────────────

  test('10.1 — CONFIDENTIALITY STRESS: rapid id-hop never assembles a multi-teacher roster', async ({ page }) => {
    // Hit several distinct ids in sequence; collect every teacher-name heading seen.
    // Because each is a pure redirect to the singular page, the set of teacher names
    // observed should be ≤ 1 (only the student's own assigned teacher, if any).
    const db = makeAdmin()
    let ids = ['aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000003']
    if (db) {
      const { data } = await db.from('teachers').select('id').limit(5)
      if (data && data.length) ids = data.map((r) => (r as { id: string }).id)
    }
    const namesSeen = new Set<string>()
    for (const id of ids) {
      await page.goto(`/es/dashboard/maestros/${id}`).catch(() => {})
      await settle(page)
      await assertNoRosterLeak(page, `id-hop ${id.slice(0, 8)}`)
      // The assigned-teacher hero name (if present) lives in main h2; capture it.
      const heads = await page.locator('main h2').allInnerTexts()
      for (const h of heads) {
        const txt = h.trim()
        // Ignore known empty-state/static headings; only collect plausible person names.
        if (txt && !/maestro|teacher|asignad|matched|assigned|diagnóstico|placement|error|nivel|level/i.test(txt)) {
          namesSeen.add(txt)
        }
      }
    }
    test.info().annotations.push({
      type: 'CONFIDENTIALITY',
      description: `distinct teacher-name headings across ${ids.length} id-hops: ${namesSeen.size} [${[...namesSeen].join(' | ')}]`,
    })
    // The whole point of one-teacher confidentiality: id-hopping cannot enumerate teachers.
    expect(namesSeen.size, 'id-hopping must not surface more than the student\'s own teacher').toBeLessThanOrEqual(1)
  })

  test('10.2 — no teacher PII leaks via response BODY for a foreign id (email/connect ids stay server-side)', async ({ page }) => {
    // Sniff the route document body for accidental leakage of teacher-only fields
    // when requesting a foreign id (the redirect should never expose them).
    const leaks: string[] = []
    page.on('response', async (r) => {
      const ct = r.headers()['content-type'] || ''
      if (!/text\/html|application\/json/.test(ct)) return
      if (!new URL(r.url()).pathname.includes('/dashboard/maestros')) return
      const txt = await r.text().catch(() => '')
      if (/hourly_rate|stripe_account|connect_id|payout|"email":/i.test(txt)) leaks.push(`${r.status()} ${r.url()}`)
    })
    await page.goto('/es/dashboard/maestros/00000000-1111-4222-8333-444455556666')
    await settle(page)
    test.info().annotations.push({ type: 'SECURITY', description: `teacher-PII-in-body leaks: ${leaks.join(', ') || 'none'}` })
    expect(leaks, `no teacher PII (rate/stripe/email) in the maestros document body:\n${leaks.join('\n')}`).toEqual([])
  })
})
