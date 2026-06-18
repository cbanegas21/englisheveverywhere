'use client'

// MUST be the FIRST import — sets window.EXCALIDRAW_ASSET_PATH before any
// Excalidraw code (incl. the CSS import below) evaluates + resolves font URLs.
import './excalidrawAssetPath'
import { useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useDataChannel } from '@livekit/components-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { Z } from '../zLayers'
import '@excalidraw/excalidraw/index.css'

// Excalidraw is a large client-only bundle — keep it out of the initial room JS.
// CRITICAL: set window.EXCALIDRAW_ASSET_PATH IMMEDIATELY BEFORE importing the
// Excalidraw module. Excalidraw resolves its font URLs at module-eval time and
// FALLS BACK to the esm.sh CDN (which our 'self'-only CSP blocks) unless the path
// is already a string. Pointing it at our self-hosted /excalidraw/ (copied to
// public/ at build by scripts/copy-excalidraw-assets.mjs) keeps every asset
// same-origin → CSP-clean, no CDN. Typed loosely at the boundary so we don't
// depend on Excalidraw's internal type subpaths (which move between versions).
const Excalidraw = dynamic(
  async () => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/'
    }
    const m = await import('@excalidraw/excalidraw')
    return m.Excalidraw
  },
  { ssr: false, loading: () => <BoardLoader /> },
) as unknown as React.ComponentType<Record<string, unknown>>

interface Props {
  lang: Locale
  bookingId: string
  show: boolean
  onClose: () => void
  // CALL-01: identities allowed to drive the board (known participants, excluding
  // self). Scene updates from anyone else (e.g. an admin observer) are dropped.
  peerIdentities: string[]
}

// Minimal shapes of the Excalidraw element + API we touch.
type El = { id: string; version: number; isDeleted?: boolean; [k: string]: unknown }
type ExApi = { updateScene: (s: { elements?: readonly El[] }) => void }

export function Whiteboard({ lang, show, onClose, peerIdentities }: Props) {
  const tx = videoStrings(lang)
  const apiRef = useRef<ExApi | null>(null)
  // id -> latest element (incl. soft-deleted). Lives on the always-mounted
  // component, so a scene received while the board is closed is retained and
  // loaded via initialData on next open.
  const sceneRef = useRef<Map<string, El>>(new Map())
  const lastSentVer = useRef<Map<string, number>>(new Map())
  const applyingRemote = useRef(false)
  const flushScheduled = useRef(false)

  const applyRemote = useCallback((incoming: El[]) => {
    let changed = false
    for (const el of incoming) {
      if (!el || typeof el.id !== 'string') continue
      const have = sceneRef.current.get(el.id)
      if (!have || (el.version ?? 0) > (have.version ?? 0)) {
        sceneRef.current.set(el.id, el)
        lastSentVer.current.set(el.id, el.version ?? 0) // don't echo it straight back
        changed = true
      }
    }
    if (changed && apiRef.current) {
      applyingRemote.current = true
      apiRef.current.updateScene({ elements: Array.from(sceneRef.current.values()) })
      requestAnimationFrame(() => { applyingRemote.current = false })
    }
  }, [])

  // Inbound scene updates over the LiveKit data channel (CALL-01 peer gate).
  const { send } = useDataChannel('whiteboard', (msg) => {
    if (msg.from?.identity && !peerIdentities.includes(msg.from.identity)) return
    try {
      const evt = JSON.parse(new TextDecoder().decode(msg.payload)) as { t: 'els'; els: El[] }
      if (evt.t === 'els' && Array.isArray(evt.els)) applyRemote(evt.els)
    } catch { /* ignore malformed frames */ }
  })

  const onChange = useCallback((elements: readonly El[]) => {
    for (const el of elements) if (el && typeof el.id === 'string') sceneRef.current.set(el.id, el)
    if (applyingRemote.current || flushScheduled.current) return
    // Throttle: collect everything whose version changed since last broadcast and
    // send it ~120ms later (Excalidraw fires onChange very rapidly while drawing).
    flushScheduled.current = true
    setTimeout(() => {
      flushScheduled.current = false
      const changed: El[] = []
      for (const el of sceneRef.current.values()) {
        if ((el.version ?? 0) !== (lastSentVer.current.get(el.id) ?? -1)) {
          changed.push(el); lastSentVer.current.set(el.id, el.version ?? 0)
        }
      }
      if (changed.length) {
        try { void send(new TextEncoder().encode(JSON.stringify({ t: 'els', els: changed })), { topic: 'whiteboard', reliable: true }).catch(() => {}) } catch { /* best-effort */ }
      }
    }, 120)
  }, [send])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0"
          style={{ background: VIDEO_THEME.stage, zIndex: Z.whiteboard, display: 'flex', flexDirection: 'column' }}
        >
          {/* App top bar (title + close), above Excalidraw's own UI. */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ background: 'rgba(0,0,0,0.75)', borderBottom: `1px solid ${VIDEO_THEME.border}`, flexShrink: 0 }}
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: VIDEO_THEME.brand }} />
              <h3 className="text-sm font-semibold text-white">{tx.whiteboardTitle}</h3>
            </div>
            <button
              onClick={onClose}
              aria-label={tx.whiteboardClose}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors"
              style={{ background: VIDEO_THEME.brand }}
              onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
              onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Excalidraw fills the rest. Light theme = a white board. */}
          <div className="relative" style={{ flex: 1, minHeight: 0 }}>
            <Excalidraw
              excalidrawAPI={(api: ExApi) => { apiRef.current = api }}
              initialData={{ elements: Array.from(sceneRef.current.values()), appState: { viewBackgroundColor: '#FFFFFF' }, scrollToContent: true }}
              onChange={onChange}
              theme="light"
              langCode={lang === 'es' ? 'es-ES' : 'en'}
              UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false } }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BoardLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#fff' }}>
      <span className="h-8 w-8 rounded-full border-2 border-black/15 border-t-black/60 animate-spin" aria-hidden />
    </div>
  )
}
