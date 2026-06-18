// Side-effect module — imported FIRST in Whiteboard.tsx, before the Excalidraw
// CSS import (which eagerly pulls Excalidraw's JS at module-eval). Excalidraw
// resolves its font URLs the moment its code evaluates and otherwise appends the
// esm.sh CDN as the fallback source (blocked by our 'self'-only CSP → noisy
// violations + the hand-drawn font never loads). Setting window.EXCALIDRAW_ASSET_PATH
// here, before any Excalidraw code runs, makes our self-hosted /excalidraw/ assets
// (copied to public/ at build) the first — and only-needed — source.
if (typeof window !== 'undefined') {
  ;(window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/'
}

export {}
