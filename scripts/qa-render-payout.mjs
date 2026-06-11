// Static render of the new teacher payout (Veem) setup card — both states — with
// real ek tokens, to verify the rebuilt earnings UI is on-brand.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const T = { paper: '#F4EFE6', card: '#FFFFFF', border: '#EAE4D6', red: '#C41E3A', text: '#111111', textSoft: '#5C5648', textMuted: '#8C8578' }
const micro = `font-family:ui-monospace,Menlo,monospace;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;`
const card = (inner) => `<section style="background:${T.card};border:1px solid ${T.border};border-radius:14px;padding:20px 22px;margin-bottom:18px;">${inner}</section>`

const setup = card(`
  <div style="${micro}color:${T.red};">Pagos</div>
  <div style="font-size:15px;font-weight:700;color:${T.text};margin-top:8px;">Configura tus pagos</div>
  <p style="font-size:13px;color:${T.textSoft};margin:6px 0 14px;line-height:1.55;max-width:520px;">Te pagamos a través de Veem — una billetera gratuita desde la que puedes retirar a tu banco.</p>
  <ol style="margin:0 0 14px;padding-left:18px;font-size:13px;color:${T.textSoft};line-height:1.6;">
    <li>Crea una cuenta gratuita en Veem (toma un par de minutos). <a style="color:${T.red};font-weight:700;text-decoration:none;">Crear una cuenta Veem →</a></li>
    <li style="margin-top:4px;">Agrega el correo de tu cuenta Veem abajo — ahí te enviamos tus ganancias cada semana.</li>
  </ol>
  <div style="${micro}color:${T.textMuted};margin-bottom:6px;">Tu correo de Veem</div>
  <div style="display:flex;gap:8px;max-width:520px;">
    <input placeholder="tu@correo.com" style="flex:1;padding:10px 12px;font-size:13px;border-radius:6px;border:1px solid ${T.border};background:${T.card};color:${T.text};box-sizing:border-box;" />
    <button style="padding:10px 20px;font-size:13px;font-weight:700;border-radius:6px;border:1px solid ${T.red};background:${T.red};color:#fff;cursor:pointer;">Guardar</button>
  </div>`)

const connected = card(`
  <div style="${micro}color:${T.red};">Pagos</div>
  <div style="margin-top:8px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
    <div>
      <div style="font-size:15px;font-weight:700;color:${T.text};">Tus pagos van a tu Veem</div>
      <div style="font-size:13px;color:${T.textSoft};margin-top:3px;font-family:ui-monospace,Menlo,monospace;">lesly@correo.com</div>
      <div style="font-size:12.5px;color:${T.textMuted};margin-top:8px;line-height:1.5;max-width:460px;">Tus ganancias disponibles se envían a tu Veem automáticamente cada semana.</div>
    </div>
    <button style="flex-shrink:0;padding:8px 16px;font-size:13px;font-weight:700;border-radius:6px;border:1px solid ${T.border};background:transparent;color:${T.text};cursor:pointer;">Cambiar</button>
  </div>`)

const stats = `<div style="display:flex;gap:0;border:1px solid ${T.border};border-radius:14px;overflow:hidden;background:${T.card};margin-bottom:6px;">
  ${[['Disponible','$240',true],['En espera','$60',false],['Ganado este mes','$300',false],['Sesiones','24',false]].map(([k,v,a],i)=>`
    <div style="flex:1;padding:18px 20px;${i?`border-left:1px solid ${T.border};`:''}">
      <div style="${micro}color:${T.textMuted};">${k}</div>
      <div style="font-size:26px;font-weight:800;margin-top:8px;color:${a?T.red:T.text};">${v}</div>
    </div>`).join('')}
</div>
<div style="font-size:12.5px;color:${T.textMuted};font-family:ui-monospace,Menlo,monospace;">↳ Próximo pago: viernes, 13 jun</div>`

const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:${T.paper};padding:30px;max-width:880px;">
  <div style="${micro}color:${T.textMuted};margin-bottom:6px;">Estado: sin configurar</div>${setup}
  <div style="${micro}color:${T.textMuted};margin:18px 0 6px;">Estado: configurado</div>${connected}
  ${stats}
</div>`

const OUT = join(tmpdir(), 'ek-payout'); mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'p.html'), html)
const b = await chromium.launch()
const p = await b.newContext({ viewport: { width: 920, height: 760 } }).then(c => c.newPage())
await p.goto('file://' + join(OUT, 'p.html').replace(/\\/g, '/'))
await p.waitForTimeout(150)
await p.screenshot({ path: join(OUT, 'p.png'), fullPage: true })
console.log('saved', join(OUT, 'p.png'))
await b.close()
