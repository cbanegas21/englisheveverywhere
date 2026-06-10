/**
 * Render the de-AI'd NotificationPreferences CARD variant (placement screen) with
 * real ek-token values, to confirm it matches the editorial system. Static mock
 * of the JSX output (channels Email on / WhatsApp off, both timings on).
 * Run: node scripts/qa-render-notif.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const T = { card: '#FFFFFF', border: '#EAE4D6', borderMid: '#D4CDB8', red: '#C41E3A',
  redTint: 'rgba(196,30,58,0.06)', redTint3: 'rgba(196,30,58,0.18)', text: '#111111', textSoft: '#5C5648' }

const micro = `font-family:ui-monospace,Menlo,monospace;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;`
function row(label, on) {
  return `<button style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:8px;background:${on ? T.redTint : T.card};border:1px solid ${on ? T.redTint3 : T.border};cursor:pointer;margin-bottom:8px;">
    <span style="font-size:12px;font-weight:700;color:${on ? T.red : T.text};">${label}</span>
    <span style="height:18px;width:32px;border-radius:999px;display:flex;align-items:center;flex-shrink:0;padding:2px;background:${on ? T.red : T.borderMid};">
      <span style="height:14px;width:14px;border-radius:999px;background:${T.card};display:block;transform:translateX(${on ? '14px' : '0'});"></span>
    </span></button>`
}
const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F4EFE6;padding:28px;">
<div style="max-width:360px;border-radius:16px;padding:20px;background:${T.card};border:1px solid ${T.border};">
  <div style="display:flex;align-items:stretch;justify-content:space-between;gap:12px;margin-bottom:16px;">
    <div style="display:flex;align-items:stretch;gap:12px;">
      <div style="width:3px;background:${T.red};border-radius:2px;flex-shrink:0;"></div>
      <div>
        <div style="${micro}color:${T.red};">Recordatorios</div>
        <p style="font-size:12px;margin:2px 0 0;color:${T.textSoft};">Te avisamos antes de la llamada.</p>
      </div>
    </div>
    <span style="${micro}font-size:9px;letter-spacing:0.12em;color:${T.red};background:${T.redTint};border:1px solid ${T.redTint3};border-radius:6px;padding:4px 8px;align-self:flex-start;flex-shrink:0;">Próximamente</span>
  </div>
  ${row('Correo', true)}
  ${row('WhatsApp', false)}
  ${row('24 horas antes', true)}
  ${row('1 hora antes', true)}
</div></div>`

const OUT = join(tmpdir(), 'ek-notif-shots'); mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'card.html'), html)
const browser = await chromium.launch()
const page = await browser.newContext({ viewport: { width: 440, height: 460 } }).then(c => c.newPage())
await page.goto('file://' + join(OUT, 'card.html').replace(/\\/g, '/'))
await page.waitForTimeout(150)
await page.screenshot({ path: join(OUT, 'card.png'), fullPage: true })
console.log('saved', join(OUT, 'card.png'))
await browser.close()
