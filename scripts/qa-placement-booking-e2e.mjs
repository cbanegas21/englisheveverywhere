// Complete the ENTIRE free-diagnostic-call flow as a brand-new student.
import { chromium } from '@playwright/test'
import * as E from './qa-e2e-lib.mjs'
let stu
const b = await chromium.launch()
try {
  stu = await E.mkStudent({ tag: 'plf', credits: 0 })
  await E.sql(`update students set intake_done=false, placement_scheduled=false, placement_test_done=false where id='${stu.sid}'`)
  const { ctx, p } = await E.loginCtx(b, stu.email, stu.pass, { lang: 'es' })
  await p.goto(`${E.BASE}/es/dashboard/placement`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)

  for (let q = 1; q <= 12; q++) {
    const t = ((await p.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
    const head = (t.match(/Pregunta \d+ de \d+/) || [''])[0]
    const opt = p.locator('[data-ek-opt]')
    if (await opt.count()) await opt.first().click().catch(() => {})
    const ta = p.locator('textarea').first()
    if (await ta.count()) await ta.fill('Quiero hablar con confianza en el trabajo.').catch(() => {})
    await p.waitForTimeout(500)
    const next = p.getByRole('button', { name: /^(siguiente|continuar|listo|next|done)$/i }).first()
    if (await next.count() && await next.isEnabled().catch(() => false)) {
      await next.click().catch(() => {}); await p.waitForTimeout(1400)
    } else {
      console.log(`   [${q}] ${head} — no next enabled; text: ${t.slice(0, 120)}`)
      break
    }
    if (/Agendar mi llamada/i.test(t)) break
  }
  await p.waitForTimeout(2500)
  const t = ((await p.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  console.log('\n── pantalla final:', p.url().replace(E.BASE, ''))
  console.log('   ', t.slice(0, 300))
  await p.screenshot({ path: 'docs/_qa-evidence/placement-final.png', fullPage: true }).catch(() => {})

  const btn = p.getByRole('button', { name: /Agendar mi llamada/i }).first()
  console.log('   botón "Agendar mi llamada" presente:', await btn.count() > 0)
  if (await btn.count()) { await btn.click().catch(() => {}); await p.waitForTimeout(3000) }

  // slot picker
  const st = ((await p.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  console.log('SLOTS:', st.slice(0, 220))
  await p.screenshot({ path: 'docs/_qa-evidence/placement-slots.png', fullPage: true }).catch(() => {})
  // slots render as buttons with a time like "9:00 a. m." — click the first that looks like one
  const slots = p.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ })
  console.log('   horarios ofrecidos:', await slots.count())
  if (await slots.count()) {
    await slots.first().click().catch(() => {})
    await p.waitForTimeout(1500)
    const conf = p.getByRole('button', { name: /confirmar|agendar/i }).last()
    if (await conf.count()) { await conf.click().catch(() => {}); await p.waitForTimeout(5000) }
  }
  const after = ((await p.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  console.log('AFTER:', after.slice(0, 200))
  await p.screenshot({ path: 'docs/_qa-evidence/placement-booked.png', fullPage: true }).catch(() => {})
  const row = await E.sql(`select placement_scheduled, (select count(*) from bookings where student_id='${stu.sid}' and type='placement_test') as pbk from students where id='${stu.sid}'`)
  console.log('   DB tras agendar:', JSON.stringify(row?.[0]))
  await ctx.close()
} finally {
  await b.close()
  if (stu) await E.nukeStudent(stu).catch(() => {})
}
