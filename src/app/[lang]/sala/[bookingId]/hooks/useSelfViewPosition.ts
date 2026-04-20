'use client'

import { useCallback, useState, type RefObject } from 'react'

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const LS_KEY_CORNER = 'ee.sala.selfview.corner'
const LS_KEY_HIDDEN = 'ee.sala.selfview.hidden'

// Pick the nearest corner given a release point relative to the stage element.
function nearestCorner(x: number, y: number, width: number, height: number): Corner {
  const top = y < height / 2
  const left = x < width / 2
  if (top && left) return 'top-left'
  if (top && !left) return 'top-right'
  if (!top && left) return 'bottom-left'
  return 'bottom-right'
}

function readInitialCorner(): Corner {
  if (typeof window === 'undefined') return 'bottom-right'
  try {
    const saved = window.localStorage.getItem(LS_KEY_CORNER)
    if (saved === 'top-left' || saved === 'top-right' || saved === 'bottom-left' || saved === 'bottom-right') {
      return saved
    }
  } catch { /* ignore */ }
  return 'bottom-right'
}

function readInitialHidden(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(LS_KEY_HIDDEN) === 'true' } catch { return false }
}

// Caller owns the stage ref and passes it in — this keeps the ref out of
// the hook's return object, which React Compiler flags as "accessing refs
// during render" when destructured in the parent.
export function useSelfViewPosition(stageRef: RefObject<HTMLElement | null>) {
  const [corner, setCorner] = useState<Corner>(readInitialCorner)
  const [hidden, setHidden] = useState<boolean>(readInitialHidden)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)

  const persistCorner = useCallback((next: Corner) => {
    setCorner(next)
    try { window.localStorage.setItem(LS_KEY_CORNER, next) } catch { /* ignore */ }
  }, [])

  const show = useCallback(() => {
    setHidden(false)
    try { window.localStorage.setItem(LS_KEY_HIDDEN, 'false') } catch { /* ignore */ }
  }, [])

  const hide = useCallback(() => {
    setHidden(true)
    try { window.localStorage.setItem(LS_KEY_HIDDEN, 'true') } catch { /* ignore */ }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-selfview-action]')) return
    const tile = e.currentTarget
    const rect = tile.getBoundingClientRect()
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setIsDragging(true)
    tile.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragOffset) return
    const stage = stageRef.current
    if (!stage) return
    const stageRect = stage.getBoundingClientRect()
    const tile = e.currentTarget
    const x = e.clientX - stageRect.left - dragOffset.x
    const y = e.clientY - stageRect.top - dragOffset.y
    tile.style.left = `${x}px`
    tile.style.top = `${y}px`
    tile.style.right = 'auto'
    tile.style.bottom = 'auto'
  }, [isDragging, dragOffset, stageRef])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const stage = stageRef.current
    if (!stage) {
      setIsDragging(false)
      setDragOffset(null)
      return
    }
    const stageRect = stage.getBoundingClientRect()
    const tile = e.currentTarget
    const tileRect = tile.getBoundingClientRect()
    const cx = tileRect.left - stageRect.left + tileRect.width / 2
    const cy = tileRect.top - stageRect.top + tileRect.height / 2
    const next = nearestCorner(cx, cy, stageRect.width, stageRect.height)
    tile.style.left = ''
    tile.style.top = ''
    tile.style.right = ''
    tile.style.bottom = ''
    persistCorner(next)
    setIsDragging(false)
    setDragOffset(null)
  }, [isDragging, persistCorner, stageRef])

  return {
    corner,
    hidden,
    isDragging,
    show,
    hide,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
