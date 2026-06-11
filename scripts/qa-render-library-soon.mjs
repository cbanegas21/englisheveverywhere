// Static render of the coming-soon Library card (ES + EN) with real ek tokens.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const T = { paper: '#F4EFE6', card: '#FFFFFF', border: '#EAE4D6', red: '#C41E3A', text: '#111111', textSoft: '#5C5648' }
const micro = `font-family:ui-monospace,Menlo,monospace;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;`
function card(kicker, title, body) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:${T.paper};padding:28px 36px;">
    <div style="display:flex;align-items:stretch;gap:18px;max-width:560px;background:${T.card};border:1px solid ${T.border};border-radius:14px;padding:28px 30px;">
      <div style="width:3px;background:${T.red};border-radius:2px;flex-shrink:0;"></div>
      <div>
        <div style="${micro}color:${T.red};">${kicker}</div>
        <h2 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${T.text};margin:8px 0 0;">${title}</h2>
        <p style="font-size:14px;line-height:1.6;color:${T.textSoft};margin:10px 0 0;max-width:460px;">${body}</p>
      </div>
    </div></div>`
}
const es = card('Próximamente', 'Una biblioteca interactiva, en camino', 'Estamos creando nuestros propios libros para leer y trabajar dentro de la plataforma — interactivos, no para descargar. Se abrirá aquí muy pronto.')
const en = card('Coming soon', 'An interactive library, in the works', 'We’re building our own books to read and work through right inside the platform — interactive, not downloads. It’ll open up here soon.')

const OUT = join(tmpdir(), 'ek-lib-soon'); mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'es.html'), es); writeFileSync(join(OUT, 'en.html'), en)
const b = await chromium.launch()
const p = await b.newContext({ viewport: { width: 720, height: 280 } }).then(c => c.newPage())
for (const l of ['es', 'en']) { await p.goto('file://' + join(OUT, `${l}.html`).replace(/\\/g, '/')); await p.waitForTimeout(120); await p.screenshot({ path: join(OUT, `${l}.png`) }); console.log('saved', join(OUT, `${l}.png`)) }
await b.close()
