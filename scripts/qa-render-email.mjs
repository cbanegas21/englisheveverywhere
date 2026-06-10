/**
 * Render the branded transactional-email template (ES + EN) to PNGs so the
 * card + bilingual footer can be eyeballed. Mirrors src/lib/email.ts brandedEmail
 * output exactly + a sample "booking confirmed" body like src/lib/reminders.ts.
 * Run: node scripts/qa-render-email.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── exact copy of brandedEmail() from src/lib/email.ts ────────────────────────
function brandedEmail({ heading, bodyHtml, ctaLabel, ctaUrl, footnote, lang = 'es' }) {
  const tagline = lang === 'en'
    ? 'EnglishKolab — Learn English. At your pace.'
    : 'EnglishKolab — Aprende inglés. A tu ritmo.'
  const cta = ctaLabel && ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;background:#C41E3A;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;margin:4px 0 0;">${ctaLabel}</a>`
    : ''
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F4EFE6;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #EAE4D6;border-radius:16px;padding:32px 28px;color:#111111;">
    <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin-bottom:24px;">English<span style="color:#C41E3A;">Kolab</span></div>
    <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;margin:0 0 14px;">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#5C5648;margin:0 0 20px;">${bodyHtml}</div>
    ${cta}
    ${footnote ? `<p style="font-size:13px;line-height:1.6;color:#8C8578;margin:20px 0 0;">${footnote}</p>` : ''}
    <hr style="border:none;border-top:1px solid #EAE4D6;margin:26px 0 16px;" />
    <p style="font-size:12px;color:#C4BCAA;margin:0;">${tagline}</p>
  </div>
</div>`
}

function confirmBody({ greeting, whenLabel, scheduled, withLabel, counterpart, withLine }) {
  return `
    <p style="margin:0 0 16px;">${greeting},</p>
    <table style="border-collapse:collapse;width:100%;margin:0;">
      <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">${whenLabel}</td><td style="padding:4px 0;color:#111111;font-weight:600;">${scheduled}</td></tr>
      <tr><td style="padding:4px 14px 4px 0;color:#8C8578;font-size:13px;">${withLabel}</td><td style="padding:4px 0;color:#111111;font-weight:600;">${counterpart}</td></tr>
    </table>
    <p style="color:#8C8578;font-size:12px;margin:18px 0 0;">${withLine}</p>`
}

const es = brandedEmail({
  heading: 'Tu clase está confirmada',
  bodyHtml: confirmBody({ greeting: 'Hola María', whenLabel: 'Cuándo', scheduled: 'jueves, 12 de junio, 09:00 CST', withLabel: 'Con', counterpart: 'Lesly', withLine: 'Con tu maestro Lesly' }),
  ctaLabel: 'Ir a la clase', ctaUrl: '#',
  footnote: 'Adjuntamos una invitación de calendario — ábrela para agregar la clase a tu calendario y recibir un recordatorio automático.',
  lang: 'es',
})
const en = brandedEmail({
  heading: 'Your class is confirmed',
  bodyHtml: confirmBody({ greeting: 'Hi Michael', whenLabel: 'When', scheduled: 'Thursday, June 12, 9:00 AM CST', withLabel: 'With', counterpart: 'Lesly', withLine: 'With your teacher Lesly' }),
  ctaLabel: 'Go to the class', ctaUrl: '#',
  footnote: "We've attached a calendar invite — open it to add the class to your calendar and get an automatic reminder.",
  lang: 'en',
})

const OUT = join(tmpdir(), 'ek-email-shots')
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'es.html'), es)
writeFileSync(join(OUT, 'en.html'), en)

const browser = await chromium.launch()
const page = await browser.newContext({ viewport: { width: 640, height: 720 } }).then(c => c.newPage())
for (const lang of ['es', 'en']) {
  await page.goto('file://' + join(OUT, `${lang}.html`).replace(/\\/g, '/'))
  await page.waitForTimeout(200)
  const p = join(OUT, `${lang}.png`)
  await page.screenshot({ path: p, fullPage: true })
  console.log('saved', p)
}
await browser.close()
