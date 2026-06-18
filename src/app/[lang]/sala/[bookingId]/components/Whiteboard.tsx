'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Pencil, Eraser, Trash2 } from 'lucide-react'
import { useDataChannel } from '@livekit/components-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { Z } from '../zLayers'

interface Props {
  lang: Locale
  bookingId: string
  show: boolean
  onClose: () => void
  // CALL-01: identities allowed to draw on the shared board (known participants,
  // excluding self). Strokes from anyone else (e.g. an admin observer) are dropped.
  peerIdentities: string[]
}

// A self-hosted collaborative whiteboard — no third-party SDK, no license, no CDN.
// Strokes are stored in NORMALIZED [0..1] board coordinates so they map across the
// two participants' different screen sizes, and synced over the existing LiveKit
// 'whiteboard' data channel (one reliable message per completed stroke + a clear).
// Replaces tldraw, which required a license key and silently blanked the board on
// a production domain after a few seconds.

type Pt = [number, number] // normalized 0..1 of the board
interface Stroke { id: string; color: string; size: number; erase: boolean; pts: Pt[] }
type WireEvt = { t: 'stroke'; s: Stroke } | { t: 'clear' }

const COLORS = ['#1A1A1A', '#C41E3A', '#2563EB', '#059669', '#D97706', '#7C3AED']
const SIZES = [3, 6, 12]

export function Whiteboard({ lang, show, onClose, peerIdentities }: Props) {
  const tx = videoStrings(lang)
  const boardRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const strokes = useRef<Stroke[]>([]) // all completed strokes (local + remote)
  const cur = useRef<Stroke | null>(null) // local in-progress stroke
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  // Read current tool settings inside pointer handlers without re-binding them.
  const toolRef = useRef({ tool, color, size })
  toolRef.current = { tool, color, size }

  // ── stroke rendering ──────────────────────────────────────────────────────
  const drawStroke = useCallback((s: Stroke) => {
    const ctx = ctxRef.current, board = boardRef.current
    if (!ctx || !board || s.pts.length === 0) return
    const w = board.clientWidth, h = board.clientHeight
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.erase ? s.size * 2.6 : s.size
    ctx.beginPath()
    ctx.moveTo(s.pts[0][0] * w, s.pts[0][1] * h)
    if (s.pts.length === 1) {
      // a tap = a dot
      ctx.lineTo(s.pts[0][0] * w + 0.1, s.pts[0][1] * h)
    } else {
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0] * w, s.pts[i][1] * h)
    }
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }, [])

  const redraw = useCallback(() => {
    const ctx = ctxRef.current, cv = canvasRef.current
    if (!ctx || !cv) return
    ctx.clearRect(0, 0, cv.width, cv.height)
    for (const s of strokes.current) drawStroke(s)
  }, [drawStroke])

  const sizeCanvas = useCallback(() => {
    const cv = canvasRef.current, board = boardRef.current
    if (!cv || !board) return
    const dpr = window.devicePixelRatio || 1
    const w = board.clientWidth, h = board.clientHeight
    cv.width = Math.max(1, Math.round(w * dpr))
    cv.height = Math.max(1, Math.round(h * dpr))
    cv.style.width = `${w}px`; cv.style.height = `${h}px`
    const ctx = cv.getContext('2d')
    if (ctx) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctxRef.current = ctx }
  }, [])

  // ── data channel sync. CALL-01: ignore strokes from non-peers. ────────────
  const { send } = useDataChannel('whiteboard', (msg) => {
    if (msg.from?.identity && !peerIdentities.includes(msg.from.identity)) return
    try {
      const evt = JSON.parse(new TextDecoder().decode(msg.payload)) as WireEvt
      if (evt.t === 'stroke' && evt.s?.pts?.length) { strokes.current.push(evt.s); drawStroke(evt.s) }
      else if (evt.t === 'clear') { strokes.current = []; redraw() }
    } catch { /* ignore malformed frames */ }
  })
  const broadcast = useCallback((evt: WireEvt) => {
    try { void send(new TextEncoder().encode(JSON.stringify(evt)), { topic: 'whiteboard', reliable: true }).catch(() => {}) } catch { /* best-effort */ }
  }, [send])

  // Size + redraw whenever the board becomes visible or its size changes. The
  // component stays mounted for the whole call (RoomShell), so strokes received
  // while the board was closed are retained and painted on next open.
  useEffect(() => {
    if (!show) return
    const board = boardRef.current
    if (!board) return
    sizeCanvas(); redraw()
    const ro = new ResizeObserver(() => { sizeCanvas(); redraw() })
    ro.observe(board)
    return () => ro.disconnect()
  }, [show, sizeCanvas, redraw])

  // ── pointer drawing ───────────────────────────────────────────────────────
  const ptFromEvent = (e: React.PointerEvent): Pt => {
    const r = boardRef.current!.getBoundingClientRect()
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ]
  }
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
    const t = toolRef.current
    cur.current = { id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, color: t.color, size: t.size, erase: t.tool === 'eraser', pts: [ptFromEvent(e)] }
    drawStroke(cur.current)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = cur.current
    if (!s) return
    s.pts.push(ptFromEvent(e))
    // Paint only the new segment for smoothness (full redraws are reserved for
    // resize / remote / clear).
    const ctx = ctxRef.current, board = boardRef.current
    if (ctx && board && s.pts.length >= 2) {
      const w = board.clientWidth, h = board.clientHeight
      const a = s.pts[s.pts.length - 2], b = s.pts[s.pts.length - 1]
      ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.erase ? s.size * 2.6 : s.size
      ctx.beginPath(); ctx.moveTo(a[0] * w, a[1] * h); ctx.lineTo(b[0] * w, b[1] * h); ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    }
  }
  const endStroke = () => {
    const s = cur.current
    if (!s) return
    cur.current = null
    strokes.current.push(s)
    broadcast({ t: 'stroke', s }) // one reliable message per completed stroke
  }
  const clearAll = () => { strokes.current = []; redraw(); broadcast({ t: 'clear' }) }

  const btn = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
    background: active ? VIDEO_THEME.brandTint20 : 'transparent',
    color: active ? VIDEO_THEME.brand : 'rgba(255,255,255,0.85)',
    border: active ? `1px solid ${VIDEO_THEME.brandTint30}` : '1px solid transparent',
  })

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
          {/* Top bar */}
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

          {/* Board (white) + drawing canvas */}
          <div ref={boardRef} className="relative flex-1 min-h-0" style={{ background: '#FFFFFF', touchAction: 'none' }}>
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
              onPointerLeave={endStroke}
            />

            {/* Floating tool palette */}
            <div
              className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-2 rounded-2xl"
              style={{ bottom: 'calc(16px + env(safe-area-inset-bottom))', background: 'rgba(16,18,22,0.95)', border: `1px solid ${VIDEO_THEME.border}`, boxShadow: '0 8px 30px rgba(0,0,0,0.4)', maxWidth: 'calc(100vw - 16px)', flexWrap: 'wrap', justifyContent: 'center' }}
            >
              <button style={btn(tool === 'pen')} aria-label={tx.whiteboardPen} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}><Pencil className="h-4 w-4" /></button>
              <button style={btn(tool === 'eraser')} aria-label={tx.whiteboardEraser} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}><Eraser className="h-4 w-4" /></button>
              <span className="mx-0.5 h-6 w-px" style={{ background: VIDEO_THEME.border }} />
              {COLORS.map(c => (
                <button
                  key={c}
                  aria-label={c}
                  onClick={() => { setColor(c); setTool('pen') }}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c && tool === 'pen' ? '2px solid #fff' : '2px solid rgba(255,255,255,0.25)', outline: color === c && tool === 'pen' ? `2px solid ${VIDEO_THEME.brand}` : 'none' }}
                />
              ))}
              <span className="mx-0.5 h-6 w-px" style={{ background: VIDEO_THEME.border }} />
              {SIZES.map(sz => (
                <button key={sz} aria-label={`size ${sz}`} onClick={() => setSize(sz)} style={btn(size === sz)}>
                  <span style={{ width: sz + 4, height: sz + 4, borderRadius: '50%', background: size === sz ? VIDEO_THEME.brand : 'rgba(255,255,255,0.8)', display: 'inline-block' }} />
                </button>
              ))}
              <span className="mx-0.5 h-6 w-px" style={{ background: VIDEO_THEME.border }} />
              <button style={btn(false)} aria-label={tx.whiteboardClear} onClick={clearAll}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
