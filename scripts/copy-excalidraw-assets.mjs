// Self-host Excalidraw's runtime assets (fonts / locales / font-subset worker
// chunks) under public/excalidraw/ so the whiteboard never fetches them from a
// third-party CDN — which our enforced CSP would block (the exact trap that made
// tldraw blank). Excalidraw reads window.EXCALIDRAW_ASSET_PATH = '/excalidraw/'
// (set in Whiteboard.tsx) and loads everything same-origin → CSP-clean.
// Runs before `next dev` and `next build` (package.json). Gitignored output;
// skips the copy when the installed version already matches.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const SRC = 'node_modules/@excalidraw/excalidraw/dist/prod'
const DST = 'public/excalidraw'

if (!existsSync(SRC)) {
  console.error('[excalidraw-assets] source missing — is @excalidraw/excalidraw installed?')
  process.exit(0)
}
const version = JSON.parse(readFileSync('node_modules/@excalidraw/excalidraw/package.json', 'utf8')).version
const marker = `${DST}/.version`
if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === version) {
  console.log(`[excalidraw-assets] up to date (v${version})`)
  process.exit(0)
}
mkdirSync(DST, { recursive: true })
cpSync(SRC, DST, { recursive: true })
writeFileSync(marker, version)
console.log(`[excalidraw-assets] copied dist/prod -> ${DST} (v${version})`)
