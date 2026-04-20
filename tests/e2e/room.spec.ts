import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { setupRoomFixture, type RoomFixture } from '../fixtures/setupRoomFixture'

/**
 * Two-browser exercise of /sala/:bookingId — teacher + student in separate
 * contexts connect to the same LiveKit room. Covers the Phase A–F surface:
 *   - ControlBar rendering (mic, cam, layout, chat, share, whiteboard, devices)
 *   - Chat send/receive across browsers
 *   - Layout toggle flips aria-pressed / label
 *   - Device menu popover opens
 *   - Whiteboard overlay opens and closes
 *   - Leave flow doesn't flash the "Entrando a la sala..." loader
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + teacher creds in .env.local. If the
 * fixture can't provision (missing env, network, auth), every test is skipped.
 */

async function loginInContext(ctx: BrowserContext, email: string, password: string, landing: RegExp): Promise<Page> {
  const page = await ctx.newPage()
  await page.goto('/es/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
  await page.waitForURL(landing, { timeout: 20_000 })
  return page
}

async function gotoRoom(page: Page, bookingId: string) {
  const errors: string[] = []
  page.on('pageerror', err => errors.push(err.message))
  await page.goto(`/es/sala/${bookingId}`)
  return errors
}

test.describe('Video room (sala) — two-browser integration', () => {
  let fixture: RoomFixture | null = null
  let teacherCtx: BrowserContext | null = null
  let studentCtx: BrowserContext | null = null
  let teacherPage: Page | null = null
  let studentPage: Page | null = null
  let teacherErrors: string[] = []
  let studentErrors: string[] = []

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    fixture = await setupRoomFixture()
    if (!fixture) return
    teacherCtx = await browser.newContext({
      permissions: ['microphone', 'camera'],
      locale: 'es-MX',
    })
    studentCtx = await browser.newContext({
      permissions: ['microphone', 'camera'],
      locale: 'es-MX',
    })
    try {
      teacherPage = await loginInContext(teacherCtx, fixture.teacher.email, fixture.teacher.password, /\/maestro\/dashboard/)
    } catch {
      teacherPage = null
    }
    try {
      studentPage = await loginInContext(studentCtx, fixture.student.email, fixture.student.password, /\/dashboard(\/|$)/)
    } catch {
      studentPage = null
    }
    if (!teacherPage || !studentPage) return
    teacherErrors = await gotoRoom(teacherPage, fixture.bookingId)
    studentErrors = await gotoRoom(studentPage, fixture.bookingId)
    // Wait for either the ControlBar (real room) or the dev-mode banner.
    await Promise.all([
      teacherPage.waitForSelector('[aria-label="Silenciar"], [aria-label="Activar mic"], [role="alert"]', { timeout: 30_000 }).catch(() => {}),
      studentPage.waitForSelector('[aria-label="Silenciar"], [aria-label="Activar mic"], [role="alert"]', { timeout: 30_000 }).catch(() => {}),
    ])
  })

  test.afterAll(async () => {
    await teacherCtx?.close().catch(() => {})
    await studentCtx?.close().catch(() => {})
    await fixture?.cleanup()
  })

  test('fixture provisioned + both sides connected', async () => {
    test.skip(!fixture, 'Room fixture unavailable — likely missing SUPABASE_SERVICE_ROLE_KEY or teacher auth user')
    test.skip(!teacherPage || !studentPage, 'Login failed for one of the test users')
    expect(teacherErrors).toEqual([])
    expect(studentErrors).toEqual([])
  })

  test('both sides render the ControlBar with core buttons', async () => {
    test.skip(!teacherPage || !studentPage, 'Both sides must be connected')
    for (const page of [teacherPage!, studentPage!]) {
      await expect(page.locator('[aria-label="Silenciar"], [aria-label="Activar mic"]').first()).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('[aria-label="Chat"]').first()).toBeVisible()
      await expect(page.locator('[aria-label="Pizarra"]').first()).toBeVisible()
      await expect(page.locator('[aria-label="Ajustes de audio y video"]').first()).toBeVisible()
      await expect(page.locator('[aria-label="Compartir pantalla"], [aria-label="Dejar de compartir"]').first()).toBeVisible()
    }
  })

  test('layout toggle flips state', async () => {
    test.skip(!teacherPage || !fixture, 'Teacher side not connected')
    // Ensure we are on the sala page — earlier parallel work may have raced a redirect.
    if (!teacherPage!.url().includes(`/sala/${fixture!.bookingId}`)) {
      await teacherPage!.goto(`/es/sala/${fixture!.bookingId}`)
    }
    const eitherBtn = teacherPage!.locator(
      '[aria-label="Vista presentador"], [aria-label="Lado a lado"]'
    ).first()
    await expect(eitherBtn).toBeVisible({ timeout: 20_000 })
    const before = await eitherBtn.getAttribute('aria-label')
    await eitherBtn.click()
    const expected = before === 'Vista presentador' ? 'Lado a lado' : 'Vista presentador'
    await expect(teacherPage!.locator(`[aria-label="${expected}"]`).first()).toBeVisible({ timeout: 5_000 })
  })

  test('device menu popover opens and closes via Escape', async () => {
    test.skip(!teacherPage, 'Teacher side not connected')
    await teacherPage!.locator('[aria-label="Ajustes de audio y video"]').first().click()
    const dialog = teacherPage!.getByRole('dialog', { name: 'Ajustes de audio y video' })
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(teacherPage!.getByText(/micrófono/i).first()).toBeVisible()
    await teacherPage!.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 3_000 })
  })

  test('chat panel opens, sends, receives across browsers', async () => {
    test.skip(!teacherPage || !studentPage, 'Both sides must be connected')
    const msg = `e2e-${Date.now()}`

    await teacherPage!.locator('[aria-label="Chat"]').first().click()
    await studentPage!.locator('[aria-label="Chat"]').first().click()

    // Send from teacher side.
    const input = teacherPage!.locator('input[placeholder="Mensaje…"], textarea[placeholder="Mensaje…"]').first()
    await input.fill(msg)
    await input.press('Enter')

    // Student side should receive the text within a few seconds.
    await expect(studentPage!.getByText(msg).first()).toBeVisible({ timeout: 15_000 })
  })

  test('whiteboard overlay opens and closes via header X', async () => {
    test.skip(!teacherPage, 'Teacher side not connected')
    await teacherPage!.locator('[aria-label="Pizarra"]').first().click()
    await expect(teacherPage!.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
    // tldraw's own toolbar sits on top of the ControlBar; use the header X.
    await teacherPage!.locator('[aria-label="Cerrar pizarra"]').click()
    await expect(teacherPage!.locator('canvas').first()).not.toBeVisible({ timeout: 5_000 })
  })

  test('leave flow does not flash the joining loader', async () => {
    test.skip(!studentPage || !fixture, 'Student side not connected')
    // Close the chat panel on the student side so it doesn't cover ControlBar.
    await studentPage!.locator('[aria-label="Cerrar chat"]').click().catch(() => {})
    const leaveBtn = studentPage!.locator('[aria-label="Salir"]').first()
    await leaveBtn.click()
    // "Entrando a la sala..." must NOT appear between leave click and ended screen.
    const flashed = await studentPage!.getByText('Entrando a la sala...').isVisible().catch(() => false)
    expect(flashed).toBe(false)
  })
})
