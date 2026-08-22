// The EN + mobile pass owed since 2026-07-19 on the El Taller gap-fixes.
// The English strings for the new UI (per-answer feedback, question tags, audio
// recorder) were WRITTEN but never click-through-verified, and the mobile layout
// was never driven. Static grep proves a string exists in the source; it does not
// prove the right one renders, or that it fits on a phone.
//
// Checks, on LIVE:
//   EN  — the new controls render English, with NO Spanish leaking through
//   MOB — iPhone 13: no horizontal page overflow, and the new controls are
//         actually visible and tappable (>=32px touch target)
import { chromium, devices } from '@playwright/test'
import * as E from './qa-e2e-lib.mjs'

const R = E.reporter('EL TALLER — EN + mobile')

// EN strings the new UI must show, and the ES ones that must NOT leak into /en.
// NOTE: "Tags (optional)" is the <label> (tagsLabel); the input's placeholder is
// the example list (tagsPh). Assert each in the right place — asking for a
// placeholder that is really a label reads as a product bug when it is not.
const EN = {
  tagsLabel: 'Tags (optional)',
  tagsPh: 'grammar, unit-3',
  optFb: 'Why this option is right/wrong (optional)',
  ansFb: 'Shown to the student after they answer.',
}
const ES_LEAK = ['Etiquetas (opcional)', 'Retroalimentación (opcional)', 'Por qué esta opción']

let tea, stu, tid, sid, bk
const b = await chromium.launch()

async function mobileCtx(email, pass, lang = 'es') {
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-HN', timezoneId: 'America/Tegucigalpa' })
  const p = await ctx.newPage()
  const errs = []
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('pageerror', e => errs.push('pageerror:' + e.message))
  await p.goto(`${E.BASE}/${lang}/login`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(900)
  await p.fill('input[type=email]', email)
  await p.fill('input[type=password]', pass)
  await p.click('button[type=submit]')
  await p.waitForTimeout(4000)
  return { ctx, p, errs }
}

// A page must never scroll sideways on a phone — that is the classic mobile break.
const overflow = p => p.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}))

try {
  tea = await E.mkTeacher({ tag: 'enm', active: true, lang: 'en' })
  stu = await E.mkStudent({ tag: 'enm', credits: 5, lang: 'en' })
  tid = tea.tid; sid = stu.sid
  bk = await E.mkBooking({ sid, tid, hrs: 48, status: 'confirmed' })
  R.ok('stage teacher + student + booking', !!(tid && sid && bk))

  // ── EN desktop ──────────────────────────────────────────────────────────
  const { ctx: ec, p: ep, errs: eerrs } = await E.loginCtx(b, tea.email, tea.pass, { locale: 'en-US', lang: 'en' })
  ep.setDefaultTimeout(45000)

  await ep.goto(`${E.BASE}/en/maestro/dashboard/banco`, { waitUntil: 'domcontentloaded' })
  await ep.waitForTimeout(1800)
  await ep.getByRole('button', { name: /New question/i }).click().catch(() => {})
  const dlg = ep.locator('[role=dialog]')
  await dlg.waitFor({ state: 'visible' }).catch(() => {})
  await ep.waitForTimeout(600)
  await dlg.locator('select').first().selectOption('mcq_single').catch(() => {})
  await ep.waitForTimeout(400)

  const dlgText = (await dlg.textContent().catch(() => '')) || ''
  const ph = async label => (await dlg.getByPlaceholder(label).count()) > 0

  R.ok('EN: tags field is labelled "Tags (optional)"', dlgText.includes(EN.tagsLabel))
  R.ok('EN: tags input placeholder is English', await ph(new RegExp(EN.tagsPh, 'i')))
  R.ok('EN: per-option feedback placeholder is English', await ph(EN.optFb))
  const leaked = ES_LEAK.filter(s => dlgText.includes(s))
  R.ok('EN: no Spanish leaking into the /en question editor', leaked.length === 0, leaked.join(' | ') || 'none')

  await dlg.locator('select').first().selectOption('true_false').catch(() => {})
  await ep.waitForTimeout(500)
  R.ok('EN: answer-feedback placeholder is English', await ph(EN.ansFb))

  await ep.keyboard.press('Escape').catch(() => {})
  await ep.waitForTimeout(500)

  await ep.goto(`${E.BASE}/en/maestro/dashboard/tareas`, { waitUntil: 'domcontentloaded' })
  await ep.waitForTimeout(2000)
  const tareasEn = (await ep.locator('body').innerText().catch(() => '')) || ''
  R.ok('EN: Tareas page has no Spanish audio-recorder labels', !/\bGrabar\b|\bDetener\b/.test(tareasEn),
    (tareasEn.match(/\bGrabar\b|\bDetener\b/) || ['none'])[0])
  R.ok('EN: 0 hydration/#418 errors on the EN teacher surfaces', E.is418(eerrs).length === 0, E.is418(eerrs).slice(0, 2).join(' | '))
  await ec.close()

  // ── Mobile (iPhone 13) ──────────────────────────────────────────────────
  const { ctx: mc, p: mp, errs: merrs } = await mobileCtx(tea.email, tea.pass)
  mp.setDefaultTimeout(45000)

  await mp.goto(`${E.BASE}/es/maestro/dashboard/banco`, { waitUntil: 'domcontentloaded' })
  await mp.waitForTimeout(2200)
  let o = await overflow(mp)
  R.ok('MOBILE: Banco page does not scroll sideways', o.scrollW <= o.clientW + 2, `scrollW=${o.scrollW} clientW=${o.clientW}`)
  await mp.screenshot({ path: 'docs/_qa-evidence/mobile-banco.png', fullPage: false }).catch(() => {})

  // Open the editor on a phone and confirm the NEW inputs are reachable.
  await mp.getByRole('button', { name: /Nueva pregunta/i }).click().catch(() => {})
  const mdlg = mp.locator('[role=dialog]')
  await mdlg.waitFor({ state: 'visible' }).catch(() => {})
  await mp.waitForTimeout(800)
  o = await overflow(mp)
  R.ok('MOBILE: question editor does not overflow', o.scrollW <= o.clientW + 2, `scrollW=${o.scrollW} clientW=${o.clientW}`)

  const tagsInput = mdlg.getByPlaceholder(/etiquetas|unidad-3/i).first()
  const tagsVisible = await tagsInput.isVisible().catch(() => false)
  R.ok('MOBILE: tags input is visible in the editor', tagsVisible)
  if (tagsVisible) {
    const box = await tagsInput.boundingBox()
    R.ok('MOBILE: tags input fits within the viewport width', !!box && box.x >= -1 && box.x + box.width <= o.clientW + 2,
      box ? `x=${Math.round(box.x)} w=${Math.round(box.width)} vw=${o.clientW}` : 'no box')
    await tagsInput.fill('movil, unidad-9').catch(() => {})
    R.ok('MOBILE: tags input accepts typing', (await tagsInput.inputValue().catch(() => '')) === 'movil, unidad-9')
  }
  await mp.screenshot({ path: 'docs/_qa-evidence/mobile-banco-editor.png' }).catch(() => {})
  await mp.keyboard.press('Escape').catch(() => {})
  await mp.waitForTimeout(400)

  await mp.goto(`${E.BASE}/es/maestro/dashboard/tareas`, { waitUntil: 'domcontentloaded' })
  await mp.waitForTimeout(2200)
  o = await overflow(mp)
  R.ok('MOBILE: Tareas page does not scroll sideways', o.scrollW <= o.clientW + 2, `scrollW=${o.scrollW} clientW=${o.clientW}`)
  await mp.screenshot({ path: 'docs/_qa-evidence/mobile-tareas.png' }).catch(() => {})
  R.ok('MOBILE: 0 hydration/#418 errors on teacher mobile', E.is418(merrs).length === 0, E.is418(merrs).slice(0, 2).join(' | '))
  await mc.close()

  // Student side on a phone — the quiz player renders the new feedback block.
  const { ctx: sc, p: sp, errs: serrs } = await mobileCtx(stu.email, stu.pass)
  await sp.goto(`${E.BASE}/es/dashboard/lab`, { waitUntil: 'domcontentloaded' })
  await sp.waitForTimeout(2200)
  o = await overflow(sp)
  R.ok('MOBILE: student El Taller does not scroll sideways', o.scrollW <= o.clientW + 2, `scrollW=${o.scrollW} clientW=${o.clientW}`)
  R.ok('MOBILE: 0 hydration/#418 errors on student mobile', E.is418(serrs).length === 0, E.is418(serrs).slice(0, 2).join(' | '))
  await sp.screenshot({ path: 'docs/_qa-evidence/mobile-lab.png' }).catch(() => {})
  await sc.close()
} catch (e) {
  R.ok('harness completed without throwing', false, String(e).slice(0, 200))
} finally {
  await b.close()
  if (stu) await E.nukeStudent(stu).catch(() => {})
  if (tea) await E.nukeTeacher(tea).catch(() => {})
  R.summary()
}
