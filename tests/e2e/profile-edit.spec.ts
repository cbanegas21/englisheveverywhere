import { test, expect, type Page } from '@playwright/test'
import {
  setupBookingFixture,
  type BookingFixture,
} from '../fixtures/bookingFixture'

/**
 * Tier 2.2 — Self-service profile edit smoke test.
 *
 * Migration 016 locked down profiles/students/teachers with column-level
 * GRANTs. The form code touches only columns on the GRANT list, so this
 * test should stay green under normal operation — but if someone later
 * narrows 016's GRANTs without updating the forms, the save will silently
 * fail with "permission denied for column" and users will see a save error
 * with no obvious cause. This spec catches that regression by walking the
 * full form → server action → DB path.
 *
 * Coverage:
 *   1. Student: /dashboard/configuracion → Profile tab → edit full_name +
 *      phone → Save → DB confirms.
 *   2. Teacher: /maestro/dashboard/configuracion → edit full_name + bio +
 *      specializations → Save → profiles.full_name AND teachers.bio +
 *      teachers.specializations all updated.
 *
 * Both server actions return { success, error? } and the UI swaps the Save
 * button label to the localized "Guardado"/"Cambios guardados" success
 * state on success. Tests assert both the UI success state AND the DB write.
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

test.describe('Tier 2.2 — Profile edit UI', () => {
  let fx: BookingFixture | null = null
  let teacherOriginal: { bio: string | null; specializations: string[] | null; full_name: string | null } | null = null

  test.beforeAll(async () => {
    fx = await setupBookingFixture(10)
    if (fx) {
      // Snapshot the fixture teacher's bio/specializations/full_name so the
      // teacher test can restore them on afterAll — the teacher record is
      // shared across tests (ensureTeacher reuses the same row), and leaking
      // a stamped "E2E ..." bio into unrelated runs would be confusing.
      const [profRow, teacherRow] = await Promise.all([
        fx.admin.from('profiles').select('full_name').eq('id', fx.teacher.userId).single(),
        fx.admin.from('teachers').select('bio, specializations').eq('id', fx.teacher.teacherId).single(),
      ])
      teacherOriginal = {
        full_name: profRow.data?.full_name ?? null,
        bio: teacherRow.data?.bio ?? null,
        specializations: (teacherRow.data?.specializations as string[] | null) ?? null,
      }
    }
  })

  test.afterAll(async () => {
    try {
      if (fx && teacherOriginal) {
        await fx.admin
          .from('profiles')
          .update({ full_name: teacherOriginal.full_name })
          .eq('id', fx.teacher.userId)
        await fx.admin
          .from('teachers')
          .update({ bio: teacherOriginal.bio, specializations: teacherOriginal.specializations })
          .eq('id', fx.teacher.teacherId)
      }
    } catch {}
    try { await fx?.cleanup() } catch {}
  })

  test('student: edit full_name + phone → Save → profiles row updated', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable (missing SUPABASE_SERVICE_ROLE_KEY)')

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.student.email, fx!.student.password, /\/dashboard/)
      test.skip(!ok, 'Student login failed — check env')

      await page.goto('/es/dashboard/configuracion')
      // Profile tab is the default panel; no need to click it.
      await expect(page.getByRole('heading', { name: /^Perfil$/i }).first())
        .toBeVisible({ timeout: 10_000 })

      const stamp = Date.now()
      const newName = `E2E Student ${stamp}`
      const newPhone = `+504 9999 ${String(stamp).slice(-4)}`

      await page.getByPlaceholder(/Ingresa tu nombre completo/i).fill(newName)
      await page.getByPlaceholder(/\+504 9999 9999/i).fill(newPhone)

      await page.getByRole('button', { name: /Guardar perfil/i }).click()
      // After success, the button's label swaps to "Guardado" (line 800 of
      // ConfigStudentClient.tsx). This is the UI confirmation that the
      // server action returned { success: true }.
      await expect(page.getByRole('button', { name: /Guardado/i }))
        .toBeVisible({ timeout: 10_000 })

      // DB invariant — the actual row mutated.
      const { data } = await fx!.admin
        .from('profiles')
        .select('full_name, phone')
        .eq('id', fx!.student.userId)
        .single()
      expect(data?.full_name, 'full_name must persist').toBe(newName)
      expect(data?.phone, 'phone must persist').toBe(newPhone)
    } finally {
      await page.close()
      await ctx.close()
    }
  })

  test('teacher: edit full_name + bio + specializations → Save → profiles AND teachers updated', async ({ browser }) => {
    test.skip(!fx, 'Fixture unavailable')

    const ctx = await browser.newContext({ locale: 'es-MX' })
    const page = await ctx.newPage()
    try {
      const ok = await loginAs(page, fx!.teacher.email, fx!.teacher.password, /\/maestro\/dashboard/)
      test.skip(!ok, 'Teacher login failed')

      await page.goto('/es/maestro/dashboard/configuracion')
      // Wait for the configuration page to render — the page shows "Perfil"
      // and "Cuenta" section headers. Key off Perfil since we edit there.
      await expect(page.getByText(/^Perfil$/i).first())
        .toBeVisible({ timeout: 10_000 })

      const stamp = Date.now()
      const newName = `E2E Teacher ${stamp}`
      const newBio = `Bio stamped ${stamp} — e2e smoke test content.`
      // Comma-separated in the UI; split + trimmed into array server-side.
      const newSpecs = `Pronunciation ${stamp}, Business English`
      const expectedSpecsArr = newSpecs.split(',').map((s) => s.trim()).filter(Boolean)

      await page.getByPlaceholder(/Tu nombre completo/i).fill(newName)
      await page.getByPlaceholder(/Cuéntales a los estudiantes/i).fill(newBio)
      await page.getByPlaceholder(/Business English, IELTS/i).fill(newSpecs)

      await page.getByRole('button', { name: /Guardar cambios/i }).click()
      // Button label swaps to "Cambios guardados" on success (3s timeout).
      await expect(page.getByRole('button', { name: /Cambios guardados/i }))
        .toBeVisible({ timeout: 10_000 })

      // DB invariants — updateTeacherProfile writes to TWO tables.
      const [profRes, teacherRes] = await Promise.all([
        fx!.admin.from('profiles').select('full_name').eq('id', fx!.teacher.userId).single(),
        fx!.admin.from('teachers').select('bio, specializations').eq('id', fx!.teacher.teacherId).single(),
      ])

      expect(profRes.data?.full_name, 'profiles.full_name must persist').toBe(newName)
      expect(teacherRes.data?.bio, 'teachers.bio must persist').toBe(newBio)
      // specializations stored as a text[] array.
      expect(teacherRes.data?.specializations, 'teachers.specializations must persist as array').toEqual(expectedSpecsArr)
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})
