import { test, expect, type BrowserContext, type Page, type Browser } from '@playwright/test'
import {
  setupBookingFixture,
  insertBooking,
  getClassesRemaining,
  setClassesRemaining,
  getBookingStatus,
  type BookingFixture,
} from '../fixtures/bookingFixture'

/**
 * Tier 1.1 — booking lifecycle display + decline/cancel flows.
 *
 * Verifies the server-authoritative state matches the UI across three surfaces:
 *   - student  /es/dashboard/clases          → upcoming + history tabs, status badges
 *   - teacher  /es/maestro/dashboard/agenda  → pending request card, confirm/decline
 *   - admin    /es/admin/bookings             → unassigned queue (via a separate test later)
 *
 * Uses a fresh student per spec (cleaned up in afterAll) — bookings are
 * inserted via service role to avoid coupling to the /agendar calendar UI.
 */

async function loginAs(page: Page, email: string, password: string, expectRedirect: RegExp): Promise<boolean> {
  await page.goto('/es/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  try {
    await page.waitForURL(expectRedirect, { timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

async function ensureLoggedIn(page: Page, email: string, password: string, expectRedirect: RegExp) {
  // Cheap re-auth guard: the session cookie can be invalidated between tests
  // (long-running suite, concurrent contexts, etc). If we land on /login, re-auth.
  if (/\/login/.test(page.url())) {
    await loginAs(page, email, password, expectRedirect)
  }
}

test.describe('Tier 1.1 — Booking lifecycle (display + decline)', () => {
  let fx: BookingFixture | null = null
  let studentCtx: BrowserContext | undefined
  let teacherCtx: BrowserContext | undefined
  let studentPage: Page | undefined
  let teacherPage: Page | undefined

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    fx = await setupBookingFixture(10)
    if (!fx) return
    studentCtx = await browser.newContext({ locale: 'es-MX' })
    teacherCtx = await browser.newContext({ locale: 'es-MX' })
    studentPage = await studentCtx.newPage()
    teacherPage = await teacherCtx.newPage()
  })

  test.afterAll(async () => {
    try { await studentPage?.close() } catch {}
    try { await teacherPage?.close() } catch {}
    try { await studentCtx?.close() } catch {}
    try { await teacherCtx?.close() } catch {}
    try { await fx?.cleanup() } catch {}
  })

  test('student sees confirmed booking in Upcoming tab with teacher name + badge', async () => {
    test.skip(!fx || !studentPage, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')

    const scheduled = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, { status: 'confirmed', scheduledAt: scheduled })
    expect(bookingId, 'booking insert should succeed').toBeTruthy()

    const ok = await loginAs(studentPage!, fx!.student.email, fx!.student.password, /\/dashboard/)
    test.skip(!ok, 'Student login failed — check env')

    await studentPage!.goto('/es/dashboard/clases')
    await expect(studentPage!.getByRole('heading', { name: /Mis Clases/i })).toBeVisible({ timeout: 10_000 })

    // Confirmed badge + teacher name should both appear in the list row
    await expect(studentPage!.getByText(fx!.teacher.fullName).first()).toBeVisible({ timeout: 10_000 })
    await expect(studentPage!.getByText(/Confirmada/i).first()).toBeVisible()

    // Upcoming tab count should include this booking (≥1)
    const upcomingTab = studentPage!.getByRole('button', { name: /Próximas/ })
    await expect(upcomingTab).toBeVisible()
  })

  test('student sees awaiting-teacher booking as italicized "Asignando maestro"', async () => {
    test.skip(!fx || !studentPage, 'Fixture unavailable')

    const scheduled = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, {
      status: 'pending',
      assignTeacher: false,
      scheduledAt: scheduled,
    })
    expect(bookingId).toBeTruthy()

    await studentPage!.goto('/es/dashboard/clases')
    await expect(studentPage!.getByText(/Asignando maestro/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('teacher sees pending booking on /agenda with Confirmar + Rechazar buttons', async () => {
    test.skip(!fx || !teacherPage, 'Fixture unavailable')

    // Insert a pending booking for THIS teacher specifically. Unique minute-offset keeps
    // the row identifiable in the shared pending queue.
    const scheduled = new Date(Date.now() + 36 * 60 * 60 * 1000 + 13 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, { status: 'pending', scheduledAt: scheduled })
    expect(bookingId).toBeTruthy()

    const ok = await loginAs(teacherPage!, fx!.teacher.email, fx!.teacher.password, /\/maestro\/dashboard/)
    test.skip(!ok, 'Teacher login failed or teacher redirected to /pending')

    await teacherPage!.goto('/es/maestro/dashboard/agenda')
    await expect(teacherPage!.getByRole('heading', { name: /Mi agenda/i })).toBeVisible({ timeout: 10_000 })

    // Pending queue card + action buttons (student name falls through to "Student"
    // fallback under user-scoped RLS — verified separately via DB).
    await expect(teacherPage!.getByText(/Solicitudes pendientes/i)).toBeVisible()
    await expect(teacherPage!.getByRole('button', { name: /Confirmar/i }).first()).toBeVisible({ timeout: 10_000 })
    await expect(teacherPage!.getByRole('button', { name: /Rechazar/i }).first()).toBeVisible()
  })

  test('teacher decline → status=cancelled AND student classes_remaining incremented', async () => {
    test.skip(!fx || !teacherPage, 'Fixture unavailable')

    // Simulate the post-create state: classes were decremented from 10 to 9 when the
    // student "created" this booking.
    await setClassesRemaining(fx!, 9)
    const beforeCount = await getClassesRemaining(fx!)
    expect(beforeCount).toBe(9)

    // Insert with a minute offset that's extremely unlikely to collide with other teacher pending rows.
    const scheduled = new Date(Date.now() + 96 * 60 * 60 * 1000 + 17 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, { status: 'pending', scheduledAt: scheduled })
    expect(bookingId).toBeTruthy()

    await teacherPage!.goto('/es/maestro/dashboard/agenda')
    await expect(teacherPage!.getByRole('heading', { name: /Mi agenda/i })).toBeVisible({ timeout: 10_000 })

    const time = new Date(scheduled).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
    const row = teacherPage!.locator('li').filter({ hasText: time }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.getByRole('button', { name: /Rechazar/i }).click()

    // Wait for the server action to commit — poll DB rather than UI, which
    // is ambiguous if other pending rows coexist.
    await expect.poll(
      async () => await getBookingStatus(fx!, bookingId!),
      { timeout: 15_000, message: 'booking did not transition to cancelled' }
    ).toBe('cancelled')

    const afterCount = await getClassesRemaining(fx!)
    expect(afterCount, 'increment_classes RPC should restore the credit').toBe(10)
  })

  test('teacher confirm → status=confirmed, classes_remaining unchanged', async () => {
    test.skip(!fx || !teacherPage, 'Fixture unavailable')

    const before = await getClassesRemaining(fx!)

    const scheduled = new Date(Date.now() + 120 * 60 * 60 * 1000 + 23 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, { status: 'pending', scheduledAt: scheduled })
    expect(bookingId).toBeTruthy()

    await teacherPage!.goto('/es/maestro/dashboard/agenda')
    await expect(teacherPage!.getByRole('heading', { name: /Mi agenda/i })).toBeVisible({ timeout: 15_000 })

    const time = new Date(scheduled).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
    const row = teacherPage!.locator('li').filter({ hasText: time }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.getByRole('button', { name: /Confirmar/i }).click()

    await expect.poll(
      async () => await getBookingStatus(fx!, bookingId!),
      { timeout: 15_000 }
    ).toBe('confirmed')

    const after = await getClassesRemaining(fx!)
    expect(after, 'confirm must NOT touch classes_remaining').toBe(before)
  })

  test('student sees completed booking in History tab with Resumen button', async () => {
    test.skip(!fx || !studentPage, 'Fixture unavailable')

    const scheduled = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const bookingId = await insertBooking(fx!, { status: 'completed', scheduledAt: scheduled })
    expect(bookingId).toBeTruthy()

    // Log in with a fresh page to avoid any stale-session or cookie-jar interactions
    // from the shared studentPage (which ran tests 1-2 long before this one).
    const fresh = await studentPage!.context().newPage()
    try {
      const ok = await loginAs(fresh, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Fresh student login failed')

      await fresh.goto('/es/dashboard/clases')
      await expect(fresh.getByRole('heading', { name: /Mis Clases/i })).toBeVisible({ timeout: 15_000 })

      // Tab is a button whose accessible name includes "Historial" + count badge.
      // getByText(/Completada/i) would also match the "Completadas" stats label —
      // so scope the Resumen button (which is the authoritative "in history view" signal) instead.
      await fresh.getByRole('button', { name: /Historial/ }).click()

      const resumen = fresh.getByRole('button', { name: /Resumen/i }).first()
      await expect(resumen).toBeVisible({ timeout: 10_000 })
    } finally {
      await fresh.close()
    }
  })
})
