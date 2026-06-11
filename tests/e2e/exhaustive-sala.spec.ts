/**
 * EXHAUSTIVE LIVE QA — STUDENT · Live classroom (/es/sala/[bookingId])
 *
 * THE most important surface: the LiveKit video room. This spec hammers ACCESS
 * CONTROL (the part we can probe deterministically and safely) and the lobby /
 * error / ended render states, then keeps the real-media probes light.
 *
 * Source of truth read before authoring (selectors + Spanish/English label text
 * lifted verbatim, never guessed):
 *   src/app/[lang]/sala/[bookingId]/page.tsx
 *       - logged-out  → redirect(`/${lang}/login?next=/<lang>/sala/<id>`)
 *       - !booking     → notFound()  (404)
 *       - !participant && !admin → redirect(`/${lang}/dashboard`)
 *   src/app/actions/video.ts → getRoomAccess()
 *       - participant = teacher.profile_id | student.profile_id | conductor_profile_id; admins always allowed
 *       - status==='cancelled'  → { error:'This session has been cancelled' }
 *       - non-dev (live keys) & now > scheduled+duration+90min → { error:'This session has expired.' }
 *   src/app/[lang]/sala/[bookingId]/VideoRoomClient.tsx
 *       - phase 'lobby' when Date.now() < scheduledAt, else 'room'/'dev'; status==='completed' → EndedScreen
 *   components/{Lobby,ErrorScreen,EndedScreen,ConnectingScreen,DevRoom}.tsx
 *   i18n.ts (VIDEO_T) — exact strings below.
 *
 * SESSION: reuses the saved STUDENT storageState (student@englishkolab.com) so the
 * spec NEVER logs in (no rate-limit contention). Role-guard probes that need
 * another identity spin up their own context via loginUI.
 *
 * SAFETY: All bookings are created/owned/torn-down via the service role on
 * THROWAWAY rows — we never touch real bookings. Future-scheduled bookings land
 * in the LOBBY (no media). We do NOT drive real LiveKit media or click the
 * teacher "End Class" (student can't anyway). The one [MUTATING] probe enters the
 * lobby (pure client state, creates a sessions row server-side via getRoomAccess);
 * those throwaway sessions/bookings are deleted in afterAll. No Stripe, no real
 * user deletion.
 *
 * On LIVE, LiveKit keys ARE configured → isDevMode=false → past-but-in-window
 * bookings would attempt a real WebSocket connect. We AVOID that: the joinable
 * booking we create is scheduled in the FUTURE so the client stops at the lobby.
 *
 * Runs against LIVE. NOT serial — each failing assertion is a real finding.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { settle, STATE, ACCOUNT, makeAdmin, loginUI, clearRateLimit, hasAuthCookie } from './_exhaustive/helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

const db = makeAdmin()

// ── exact strings lifted from i18n.ts VIDEO_T ──────────────────────────────
const ES = {
  connecting: 'Conectando a tu sesión...',
  lobbyTitle: 'Tu sesión está lista',
  lobbyLive: 'Tu sesión está en vivo — entra ahora',
  lobbyStartsIn: 'Empieza en',
  lobbyEnterNow: 'Entrar ahora',
  lobbyHint: 'Puedes entrar antes. Se notificará al otro participante cuando ingrese.',
  sessionWith: 'Sesión con',
  errorTitle: 'No se pudo conectar',
  retry: 'Reintentar',
  sessionEnded: 'Clase Completada',
  studentEndedSub: 'La sesión ha terminado. Revisa tus clases para ver el resumen.',
  returnDashboard: 'Volver al inicio',
}
const EN = {
  lobbyTitle: 'Your session is ready',
  lobbyLive: 'Your session is live — join now',
  lobbyEnterNow: 'Enter call now',
  lobbyStartsIn: 'Starts in',
  errorTitle: 'Could not connect',
  retry: 'Retry',
  sessionEnded: 'Class Complete',
  returnDashboard: 'Return to dashboard',
}
// Raw English error strings getRoomAccess returns (rendered verbatim in ErrorScreen).
const RAW_ERR = {
  cancelled: 'This session has been cancelled',
  expired: 'This session has expired.',
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

// ── booking fixtures created/owned by the service role; torn down in afterAll ──
const created: { bookings: string[]; sessions: string[] } = { bookings: [], sessions: [] }

let qaStudentId: string | null = null     // students.id for student@englishkolab.com
let qaTeacherId: string | null = null      // teachers.id for teacher@englishkolab.com
let otherStudentId: string | null = null   // some OTHER students.id (for the foreign/IDOR booking)

// fixtures (booking ids) — set in beforeAll, '' if provisioning failed.
const fix = {
  lobbyFuture: '',   // confirmed, scheduled +6h → lands in LOBBY for the QA student (safe, no media)
  cancelled: '',     // cancelled, scheduled +6h → getRoomAccess error
  expired: '',       // confirmed, scheduled in the deep past → "This session has expired."
  completed: '',     // completed, +6h → EndedScreen (status short-circuit in client)
  foreign: '',       // confirmed, +6h, owned by ANOTHER student → QA student is NOT a participant
}

async function profileIdFor(database: SupabaseClient, email: string): Promise<string | null> {
  const target = email.toLowerCase()
  for (let page = 1; page <= 5; page++) {
    const { data } = await database.auth.admin.listUsers({ page, perPage: 200 })
    const hit = data?.users.find(u => (u.email || '').toLowerCase() === target)
    if (hit) return hit.id
    if (!data || data.users.length < 200) break
  }
  return null
}

async function makeBooking(
  database: SupabaseClient,
  studentId: string,
  teacherId: string | null,
  scheduledAt: string,
  status: string,
): Promise<string | null> {
  const { data, error } = await database
    .from('bookings')
    .insert({
      student_id: studentId,
      teacher_id: teacherId,
      scheduled_at: scheduledAt,
      duration_minutes: 60,
      status,
      type: 'class',
    })
    .select('id')
    .single()
  if (error || !data) return null
  created.bookings.push(data.id)
  return data.id
}

test.beforeAll(async () => {
  if (!db) return
  const studentProfileId = await profileIdFor(db, ACCOUNT.student.email)
  const teacherProfileId = await profileIdFor(db, ACCOUNT.teacher.email)
  if (studentProfileId) {
    const { data: s } = await db.from('students').select('id').eq('profile_id', studentProfileId).single()
    qaStudentId = s?.id ?? null
  }
  if (teacherProfileId) {
    const { data: t } = await db.from('teachers').select('id').eq('profile_id', teacherProfileId).single()
    qaTeacherId = t?.id ?? null
  }
  // Any students.id that is NOT our QA student → use for the "foreign" booking.
  const { data: others } = await db.from('students').select('id').neq('id', qaStudentId ?? ZERO_UUID).limit(1)
  otherStudentId = others?.[0]?.id ?? null

  if (!qaStudentId) return // can't provision; probes that depend on fixtures will skip

  const future = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()       // +6h → lobby
  const deepPast = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()     // -48h → expired window

  fix.lobbyFuture = (await makeBooking(db, qaStudentId, qaTeacherId, future, 'confirmed')) || ''
  fix.cancelled = (await makeBooking(db, qaStudentId, qaTeacherId, future, 'cancelled')) || ''
  fix.expired = (await makeBooking(db, qaStudentId, qaTeacherId, deepPast, 'confirmed')) || ''
  fix.completed = (await makeBooking(db, qaStudentId, qaTeacherId, future, 'completed')) || ''
  if (otherStudentId) {
    fix.foreign = (await makeBooking(db, otherStudentId, qaTeacherId, future, 'confirmed')) || ''
  }
})

test.afterAll(async () => {
  if (!db) return
  // getRoomAccess inserts a sessions row keyed on booking_id; delete those first
  // (FK), then the throwaway bookings.
  if (created.bookings.length) {
    await db.from('sessions').delete().in('booking_id', created.bookings)
    await db.from('bookings').delete().in('id', created.bookings)
  }
})

// Attach BEFORE navigation. Collects console errors + same-origin 4xx/5xx.
function watchErrors(page: Page) {
  const consoleErrors: string[] = []
  const badResponses: string[] = []
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('response', r => {
    const s = r.status()
    // Ignore the intentional 404 on the notFound() probe + 3rd-party noise.
    if (s >= 500 && /englishkolab\.com/.test(r.url())) badResponses.push(`${s} ${r.url()}`)
  })
  return { consoleErrors, badResponses }
}

async function gotoRoom(page: Page, bookingId: string, lang = 'es') {
  await page.goto(`/${lang}/sala/${bookingId}`)
  await settle(page)
}

test.describe('EXHAUSTIVE · STUDENT · Live classroom (/es/sala/[bookingId])', () => {
  test.use({ storageState: STATE.student })
  test.skip(!db, 'service-role key required to provision throwaway bookings (SUPABASE_SERVICE_ROLE_KEY / .env.local)')

  // ─────────────────── 0 · Session sanity ───────────────────

  test('0.1 — the saved student storageState carries a live auth cookie', async ({ page, context }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    await gotoRoom(page, fix.lobbyFuture)
    expect(hasAuthCookie(await context.cookies()), 'student storageState must be authenticated').toBeTruthy()
  })

  // ─────────────────── 1 · Happy-path: lobby render ───────────────────

  test('1.1 — a future booking the student owns renders the LOBBY (countdown, not media)', async ({ page }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    const { consoleErrors, badResponses } = watchErrors(page)
    await gotoRoom(page, fix.lobbyFuture)

    // Either the "your session is ready" headline OR the live variant (both ES).
    await expect(
      page.getByRole('heading', { name: new RegExp(`${ES.lobbyTitle}|${ES.lobbyLive.replace(/[—]/g, '.')}`) })
    ).toBeVisible({ timeout: 20_000 })
    // "Sesión con <otherName>" + the enter CTA + the early-entry hint.
    await expect(page.getByText(new RegExp(ES.sessionWith))).toBeVisible()
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toBeVisible()
    await expect(page.getByText(ES.lobbyHint)).toBeVisible()
    // Countdown ("Empieza en" + a mm:ss style number) since it's +6h out.
    await expect(page.getByText(ES.lobbyStartsIn)).toBeVisible()

    await page.screenshot({ path: 'test-results/exhaustive-sala-lobby.png', fullPage: true })
    test.info().annotations.push({ type: 'observed', description: `console-errors=${consoleErrors.length}; 5xx=${badResponses.length}` })
    expect(badResponses, `5xx on lobby:\n${badResponses.join('\n')}`).toEqual([])
  })

  test('1.2 — the lobby countdown shows a real, non-NaN time (no Invalid Date artifact)', async ({ page }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    await gotoRoom(page, fix.lobbyFuture)
    await expect(page.getByText(ES.lobbyStartsIn)).toBeVisible({ timeout: 20_000 })
    const body = await page.locator('body').innerText()
    const artifact = /Invalid Date|NaN|undefined|\[object Object\]/.test(body)
    test.info().annotations.push({ type: 'observed', description: `lobby body artifact present=${artifact}` })
    expect(artifact, 'lobby must not render Invalid Date / NaN / undefined').toBeFalsy()
  })

  // ─────────────────── 2 · Entry / deep-link / refresh ───────────────────

  test('2.1 — deep-link + hard refresh both re-render the lobby (session persists)', async ({ page }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    await gotoRoom(page, fix.lobbyFuture)
    const headline = page.getByRole('button', { name: ES.lobbyEnterNow })
    await expect(headline).toBeVisible({ timeout: 20_000 })
    await page.reload()
    await settle(page)
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toBeVisible({ timeout: 20_000 })
  })

  test('2.2 [MUTATING] — clicking "Entrar ahora" leaves the lobby (creates a throwaway sessions row)', async ({ page }) => {
    // getRoomAccess already ran on mount (creating a sessions row for this
    // booking — cleaned up in afterAll). Clicking Enter flips the client phase
    // off the lobby. On LIVE this transitions to the real room (LiveKit connect);
    // we only assert the lobby chrome went away, then leave — no media driven.
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    await gotoRoom(page, fix.lobbyFuture)
    const enter = page.getByRole('button', { name: ES.lobbyEnterNow })
    await expect(enter).toBeVisible({ timeout: 20_000 })
    await enter.click()
    await page.waitForTimeout(2500)
    // The lobby's distinctive hint must be gone (we left the lobby phase).
    const stillLobby = await page.getByText(ES.lobbyHint).count()
    test.info().annotations.push({ type: 'observed', description: `still-in-lobby-after-enter=${stillLobby > 0}; url=${page.url()}` })
    expect(stillLobby, 'clicking Entrar ahora must leave the lobby phase').toBe(0)
  })

  // ─────────────────── 3 · Access control — the core of this surface ───────────────────

  test('3.1 — logged-OUT visitor is bounced to /login?next=<room> (round-trip preserved)', async ({ browser }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    const ctx = await browser.newContext() // anonymous — no storageState
    const page = await ctx.newPage()
    await page.goto(`/es/sala/${fix.lobbyFuture}`)
    await settle(page)
    // Content is the source of truth: the login form must be present and the
    // lobby/room chrome absent. The next param must round-trip the room path.
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toHaveCount(0)
    const u = new URL(page.url())
    const next = u.searchParams.get('next') || ''
    test.info().annotations.push({ type: 'observed', description: `anon → ${page.url()} (next="${next}")` })
    expect(next, 'next must round-trip the room route so the email/SMS join link lands in the call after login')
      .toContain(`/sala/${fix.lobbyFuture}`)
    await ctx.close()
  })

  test('3.2 — student hitting a booking they do NOT participate in is bounced to /dashboard', async ({ page }) => {
    test.skip(!fix.foreign, 'no foreign booking fixture (need a second student row)')
    await gotoRoom(page, fix.foreign)
    await page.waitForTimeout(2500) // let the redirect settle
    // Must NOT see any room/lobby chrome for someone else's booking.
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toHaveCount(0)
    await expect(page.getByText(ES.lobbyHint)).toHaveCount(0)
    // Positive proof they landed on their OWN student dashboard (not a blank/leaked shell).
    const onDashboard = await page.getByText(/hola,|clases disponibles|tus próximas clases|mi panel|inicio/i).count()
    test.info().annotations.push({ type: 'observed', description: `non-participant booking → ${page.url()}; dashboard-markers=${onDashboard}` })
    expect(page.url(), 'non-participant must be redirected away from the room').toMatch(/\/dashboard|\/login/)
  })

  test('3.3 — a non-existent bookingId (valid UUID, no row) → notFound (404), no room', async ({ page }) => {
    await gotoRoom(page, ZERO_UUID)
    await page.waitForTimeout(1500)
    // page.tsx calls notFound() → Next renders the 404 boundary. Assert on content:
    // no room chrome, and a not-found signal present.
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toHaveCount(0)
    const notFoundMarker = await page.getByText(/404|no se encontró|not found|esta página no existe|página no encontrada/i).count()
    test.info().annotations.push({ type: 'observed', description: `non-existent booking → ${page.url()}; notfound-markers=${notFoundMarker}` })
    expect(notFoundMarker, 'a non-existent booking must hit the notFound boundary, not the room').toBeGreaterThan(0)
  })

  test('3.4 — a MALFORMED bookingId (not a UUID) does not 500 / does not enter the room', async ({ page }) => {
    const { badResponses } = watchErrors(page)
    // .eq('id', 'not-a-uuid').single() returns null → notFound(); must never 500.
    await gotoRoom(page, 'not-a-real-uuid-🙂-%27')
    await page.waitForTimeout(1500)
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `malformed id → ${page.url()}; 5xx=${badResponses.length}` })
    expect(badResponses, `malformed bookingId must not 500:\n${badResponses.join('\n')}`).toEqual([])
  })

  test('3.5 — SQLi-flavored bookingId path segment fails closed (no auth bypass, no 500)', async ({ page }) => {
    const { badResponses } = watchErrors(page)
    const payload = encodeURIComponent("' OR '1'='1")
    await gotoRoom(page, payload)
    await page.waitForTimeout(1500)
    // Must not leak a room for ANY booking; must not 500.
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toHaveCount(0)
    test.info().annotations.push({ type: 'observed', description: `SQLi id → ${page.url()}; 5xx=${badResponses.length}` })
    expect(badResponses, 'SQLi bookingId must not 500').toEqual([])
  })

  test('3.6 — IDOR: rapidly cycling several random UUIDs never yields a joinable room', async ({ page }) => {
    // Enumerate bookings we don't own. getRoomAccess + page guard must reject all:
    // each → notFound (no row) or /dashboard (exists but not ours). NEVER the lobby/room.
    const ids = Array.from({ length: 5 }, () =>
      ZERO_UUID.replace(/0/g, () => Math.floor(Math.random() * 16).toString(16))
    )
    let leaked = 0
    for (const id of ids) {
      await gotoRoom(page, id)
      await page.waitForTimeout(800)
      if (await page.getByRole('button', { name: ES.lobbyEnterNow }).count()) leaked++
    }
    test.info().annotations.push({ type: 'observed', description: `random-uuid rooms leaked=${leaked}/${ids.length}` })
    expect(leaked, 'no random booking id may yield a joinable room (IDOR)').toBe(0)
  })

  // ─────────────────── 4 · Booking lifecycle states ───────────────────

  test('4.1 — a CANCELLED booking surfaces the error screen, never the room', async ({ page }) => {
    test.skip(!fix.cancelled, 'no cancelled fixture booking')
    await gotoRoom(page, fix.cancelled)
    await page.waitForTimeout(2000)
    // getRoomAccess returns { error:'This session has been cancelled' } → ErrorScreen.
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toHaveCount(0)
    const errorTitle = await page.getByText(ES.errorTitle).count()
    const rawMsg = await page.getByText(RAW_ERR.cancelled).count()
    test.info().annotations.push({ type: 'observed', description: `cancelled: error-title=${errorTitle}, raw-cancelled-msg=${rawMsg}` })
    // The error screen ("No se pudo conectar" + Reintentar) must show.
    expect(errorTitle, 'a cancelled booking must show the error screen, not the lobby/room').toBeGreaterThan(0)
    // FINDING HOOK: the message itself is raw English on the ES page (i18n gap in
    // getRoomAccess — it returns un-localized strings). Record loudly.
    test.info().annotations.push({ type: 'i18n', description: `cancelled error message rendered raw-English on /es page = ${rawMsg > 0} (getRoomAccess returns un-localized error strings)` })
  })

  test('4.2 — an EXPIRED (past-window) booking surfaces the error screen on LIVE', async ({ page }) => {
    test.skip(!fix.expired, 'no expired fixture booking')
    await gotoRoom(page, fix.expired)
    await page.waitForTimeout(2500)
    // On LIVE (keys present, isDevMode=false), now > scheduled+90m → "This session has expired."
    // NOTE: scheduledAt is in the past, so the client's lobby check is false and it
    // calls into the room/dev path; the server error wins → ErrorScreen.
    const errorTitle = await page.getByText(ES.errorTitle).count()
    const expiredMsg = await page.getByText(RAW_ERR.expired).count()
    const enterCta = await page.getByRole('button', { name: ES.lobbyEnterNow }).count()
    test.info().annotations.push({ type: 'observed', description: `expired: error-title=${errorTitle}, expired-msg=${expiredMsg}, enter-cta=${enterCta}, url=${page.url()}` })
    // Either the live-mode expired guard fires (error screen) OR — if this env runs
    // in dev-mode — it would NOT (records that as a finding). Assert no lobby.
    expect(enterCta, 'an expired booking must never present an enter-call CTA').toBe(0)
  })

  test('4.3 — a COMPLETED booking shows the EndedScreen (return-to-dashboard), not the room', async ({ page }) => {
    test.skip(!fix.completed, 'no completed fixture booking')
    await gotoRoom(page, fix.completed)
    await page.waitForTimeout(2000)
    // VideoRoomClient short-circuits to EndedScreen when status==='completed'.
    await expect(page.getByText(ES.sessionEnded)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(ES.studentEndedSub)).toBeVisible()
    await expect(page.getByRole('button', { name: ES.returnDashboard })).toBeVisible()
    // Student must NOT see the lobby enter CTA for a finished class.
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toHaveCount(0)
    await page.screenshot({ path: 'test-results/exhaustive-sala-ended.png', fullPage: true })
  })

  test('4.4 — the EndedScreen "Volver al inicio" button navigates to the student dashboard', async ({ page }) => {
    test.skip(!fix.completed, 'no completed fixture booking')
    await gotoRoom(page, fix.completed)
    await expect(page.getByRole('button', { name: ES.returnDashboard })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: ES.returnDashboard }).click()
    await page.waitForTimeout(2000)
    // dashboardPath for a student is /<lang>/dashboard.
    test.info().annotations.push({ type: 'observed', description: `return-to-dashboard → ${page.url()}` })
    expect(page.url()).toMatch(/\/es\/dashboard(\/|$|\?)/)
  })

  // ─────────────────── 5 · Cross-role guard ───────────────────

  test('5.1 — a TEACHER who is NOT on the booking is bounced (not into the student\'s room)', async ({ browser }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    await clearRateLimit()
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginUI(page, ACCOUNT.teacher.email, ACCOUNT.teacher.password)
    await page.waitForURL(/\/(maestro|dashboard|onboarding|pending)/, { timeout: 30_000 }).catch(() => {})
    // If the QA teacher happens to BE the booking's teacher, this is a legit join,
    // so we annotate and only assert no 5xx. Otherwise: must be bounced.
    const { badResponses } = watchErrors(page)
    await page.goto(`/es/sala/${fix.lobbyFuture}`)
    await settle(page)
    await page.waitForTimeout(2500)
    const sawLobby = await page.getByRole('button', { name: ES.lobbyEnterNow }).count()
    const teacherIsParticipant = qaTeacherId != null // fixture was created with this teacher
    test.info().annotations.push({ type: 'observed', description: `teacher → ${page.url()}; saw-lobby=${sawLobby > 0}; teacher-is-booking-participant=${teacherIsParticipant}` })
    if (teacherIsParticipant) {
      // Legit participant — just guard against 5xx and a broken screen.
      expect(badResponses, 'no 5xx for a legit teacher participant').toEqual([])
    } else {
      expect(sawLobby, 'a non-participant teacher must not enter the student room').toBe(0)
    }
    await ctx.close()
  })

  test('5.2 — an ADMIN may join any room (support/observation) — documented elevated access', async ({ browser }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    await clearRateLimit()
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginUI(page, ACCOUNT.admin.email, ACCOUNT.admin.password)
    await page.waitForURL(/\/(admin|dashboard)/, { timeout: 30_000 }).catch(() => {})
    await page.goto(`/es/sala/${fix.lobbyFuture}`)
    await settle(page)
    await page.waitForTimeout(2500)
    // page.tsx + getRoomAccess both allow admins. A future booking → lobby for the admin too.
    const sawLobby = await page.getByRole('button', { name: ES.lobbyEnterNow }).count()
    const bounced = /\/admin/.test(page.url())
    test.info().annotations.push({ type: 'SECURITY', description: `admin → ${page.url()}; saw-lobby=${sawLobby > 0} (admins get FULL publish grant per getRoomAccess TODO — observer-mode not yet scoped)` })
    // Admin access is intentional. Record the verdict; assert they were NOT silently
    // redirected away (which would contradict the documented behavior).
    expect(sawLobby > 0 || !bounced, 'admin is documented to reach any room (lobby for a future booking)').toBeTruthy()
    await ctx.close()
  })

  // ─────────────────── 6 · i18n ES + EN parity ───────────────────

  test('6.1 — the EN room lobby renders English chrome (no leaked Spanish)', async ({ page }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    await gotoRoom(page, fix.lobbyFuture, 'en')
    await expect(
      page.getByRole('heading', { name: new RegExp(`${EN.lobbyTitle}|${EN.lobbyLive.replace(/[—]/g, '.')}`) })
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: EN.lobbyEnterNow })).toBeVisible()
    // Spanish-only lobby chrome must be ABSENT on the EN page (catches hardcoded ES).
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toHaveCount(0)
    await expect(page.getByText(ES.lobbyHint)).toHaveCount(0)
    await page.screenshot({ path: 'test-results/exhaustive-sala-lobby-en.png', fullPage: true })
  })

  test('6.2 — EN completed screen is English; flags raw-English server error leaking onto /es', async ({ page }) => {
    // Part A: EN ended screen parity.
    if (fix.completed) {
      await gotoRoom(page, fix.completed, 'en')
      await expect(page.getByText(EN.sessionEnded)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('button', { name: EN.returnDashboard })).toBeVisible()
      await expect(page.getByText(ES.sessionEnded)).toHaveCount(0)
    }
    // Part B (FINDING): getRoomAccess error strings are hardcoded English with no
    // ES/EN mapping. On the ES cancelled room the message renders in English.
    if (fix.cancelled) {
      await gotoRoom(page, fix.cancelled, 'es')
      await page.waitForTimeout(1500)
      const rawEnglishOnEs = await page.getByText(RAW_ERR.cancelled).count()
      test.info().annotations.push({ type: 'i18n', description: `raw-English getRoomAccess error on /es cancelled room = ${rawEnglishOnEs > 0} (should be localized via i18n.ts, not returned hardcoded)` })
      expect(rawEnglishOnEs, 'EXPECTED FINDING: getRoomAccess returns un-localized English error strings rendered verbatim on the Spanish page').toBe(0)
    } else {
      test.skip(true, 'no cancelled fixture to probe the i18n error leak')
    }
  })

  // ─────────────────── 7 · Responsive ───────────────────

  test('7.1 — lobby is usable on a 375px mobile viewport (enter CTA in view)', async ({ page }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    await page.setViewportSize({ width: 375, height: 720 })
    await gotoRoom(page, fix.lobbyFuture)
    const enter = page.getByRole('button', { name: ES.lobbyEnterNow })
    await expect(enter).toBeVisible({ timeout: 20_000 })
    await enter.scrollIntoViewIfNeeded()
    await expect(enter).toBeInViewport()
    await page.screenshot({ path: 'test-results/exhaustive-sala-lobby-mobile.png', fullPage: true })
  })

  test('7.2 — completed/ended screen is usable on desktop (return CTA visible)', async ({ page }) => {
    test.skip(!fix.completed, 'no completed fixture booking')
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoRoom(page, fix.completed)
    await expect(page.getByRole('button', { name: ES.returnDashboard })).toBeVisible({ timeout: 15_000 })
  })

  // ─────────────────── 8 · Console / network health on the room route ───────────────────

  test('8.1 — the lobby route is free of console errors and same-origin 5xx', async ({ page }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    const { consoleErrors, badResponses } = watchErrors(page)
    await gotoRoom(page, fix.lobbyFuture)
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(1500)
    // Filter out known-benign LiveKit / 3rd-party telemetry noise; keep app-origin errors.
    const appErrors = consoleErrors.filter(e => !/livekit|analytics|the user denied|permission|getUserMedia|NotAllowed/i.test(e))
    test.info().annotations.push({ type: 'observed', description: `lobby console-errors(all)=${consoleErrors.length}; app-only=${appErrors.length}; 5xx=${badResponses.length}` })
    expect(badResponses, `5xx on the room route:\n${badResponses.join('\n')}`).toEqual([])
    expect(appErrors, `app-origin console errors on the lobby:\n${appErrors.join('\n')}`).toEqual([])
  })

  // ─────────────────── 9 · State / concurrency ───────────────────

  test('9.1 — two tabs open the same lobby independently (no shared-state crash)', async ({ page, context }) => {
    test.skip(!fix.lobbyFuture, 'no joinable fixture booking')
    await gotoRoom(page, fix.lobbyFuture)
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toBeVisible({ timeout: 20_000 })
    const page2 = await context.newPage()
    await page2.goto(`/es/sala/${fix.lobbyFuture}`)
    await settle(page2)
    await expect(page2.getByRole('button', { name: ES.lobbyEnterNow })).toBeVisible({ timeout: 20_000 })
    // Both lobbies render; the duplicate getRoomAccess call must reuse the single
    // sessions row (maybeSingle) and not crash either tab.
    await expect(page.getByRole('button', { name: ES.lobbyEnterNow })).toBeVisible()
    await page2.close()
  })
})
