'use client'

import { useCallback, useRef, useState, type RefObject } from 'react'

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type SelfViewSize = 'sm' | 'md' | 'lg'

const SIZE_ORDER: SelfViewSize[] = ['sm', 'md', 'lg']

// Pick the nearest corner given a release point relative to the stage element.
function nearestCorner(x: number, y: number, width: number, height: number): Corner {
  const top = y < height / 2
  const left = x < width / 2
  if (top && left) return 'top-left'
  if (top && !left) return 'top-right'
  if (!top && left) return 'bottom-left'
  return 'bottom-right'
}

function readCorner(prefix: string, fallback: Corner): Corner {
  if (typeof window === 'undefined') return fallback
  try {
    const saved = window.localStorage.getItem(`${prefix}.corner`)
    if (saved === 'top-left' || saved === 'top-right' || saved === 'bottom-left' || saved === 'bottom-right') {
      return saved
    }
  } catch { /* ignore */ }
  return fallback
}

function readHidden(prefix: string): boolean {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(`${prefix}.hidden`) === 'true' } catch { return false }
}

function readSize(prefix: string): SelfViewSize {
  if (typeof window === 'undefined') return 'md'
  try {
    const saved = window.localStorage.getItem(`${prefix}.size`)
    if (saved === 'sm' || saved === 'md' || saved === 'lg') return saved
  } catch { /* ignore */ }
  return 'md'
}

interface Options {
  /** localStorage key prefix — distinct per tile so the local + remote PiPs
   *  (CALL-10) persist independently. Defaults to the self-view tile. */
  keyPrefix?: string
  /** Corner used when nothing is persisted yet. */
  defaultCorner?: Corner
}

// Caller owns the stage ref and passes it in — this keeps the ref out of
// the hook's return object, which React Compiler flags as "accessing refs
// during render" when destructured in the parent.
//
// Drag uses a CSS `transform` translate (imperative, during the gesture only)
// so the resting corner position can live entirely in the React style prop —
// the parent layers panel/control-bar insets onto it without the drag handlers
// fighting the inline `left/top` values (CALL-01 panel-aware placement).
export function useSelfViewPosition(stageRef: RefObject<HTMLElement | null>, options: Options = {}) {
  const prefix = options.keyPrefix ?? 'ee.sala.selfview'
  const fallbackCorner = options.defaultCorner ?? 'bottom-right'

  const [corner, setCorner] = useState<Corner>(() => readCorner(prefix, fallbackCorner))
  const [hidden, setHidden] = useState<boolean>(() => readHidden(prefix))
  const [size, setSizeState] = useState<SelfViewSize>(() => readSize(prefix))
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  // Step the PiP through sm → md → lg (CALL-09). Persisted per-user.
  const stepSize = useCallback((dir: 1 | -1) => {
    setSizeState(prev => {
      const i = SIZE_ORDER.indexOf(prev)
      const next = SIZE_ORDER[Math.min(SIZE_ORDER.length - 1, Math.max(0, i + dir))]
      try { window.localStorage.setItem(`${prefix}.size`, next) } catch { /* ignore */ }
      return next
    })
  }, [prefix])
  const enlarge = useCallback(() => stepSize(1), [stepSize])
  const shrink = useCallback(() => stepSize(-1), [stepSize])

  const persistCorner = useCallback((next: Corner) => {
    setCorner(next)
    try { window.localStorage.setItem(`${prefix}.corner`, next) } catch { /* ignore */ }
  }, [prefix])

  const show = useCallback(() => {
    setHidden(false)
    try { window.localStorage.setItem(`${prefix}.hidden`, 'false') } catch { /* ignore */ }
  }, [prefix])

  const hide = useCallback(() => {
    setHidden(true)
    try { window.localStorage.setItem(`${prefix}.hidden`, 'true') } catch { /* ignore */ }
  }, [prefix])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-selfview-action]')) return
    dragStart.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    e.currentTarget.style.transform = `translate(${dx}px, ${dy}px)`
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    dragStart.current = null
    setIsDragging(false)
    const tile = e.currentTarget
    const stage = stageRef.current
    if (stage) {
      // Read the rect BEFORE clearing the transform so the corner reflects
      // where the user actually released the tile.
      const stageRect = stage.getBoundingClientRect()
      const tileRect = tile.getBoundingClientRect()
      const cx = tileRect.left - stageRect.left + tileRect.width / 2
      const cy = tileRect.top - stageRect.top + tileRect.height / 2
      persistCorner(nearestCorner(cx, cy, stageRect.width, stageRect.height))
    }
    tile.style.transform = ''
  }, [persistCorner, stageRef])

  return {
    corner,
    hidden,
    size,
    enlarge,
    shrink,
    isDragging,
    show,
    hide,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
