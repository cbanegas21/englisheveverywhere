'use client'

import { useCallback, useState } from 'react'

export type LayoutMode = 'speaker' | 'grid'

// Persist per-user so returning to a class remembers the last layout.
const LS_KEY = 'ee.sala.layout'

export function useRoomLayout() {
  const [mode, setMode] = useState<LayoutMode>(() => {
    if (typeof window === 'undefined') return 'speaker'
    try {
      const saved = window.localStorage.getItem(LS_KEY)
      if (saved === 'speaker' || saved === 'grid') return saved
    } catch { /* ignore */ }
    return 'speaker'
  })

  const setPersisted = useCallback((next: LayoutMode) => {
    setMode(next)
    try { window.localStorage.setItem(LS_KEY, next) } catch { /* ignore */ }
  }, [])

  const toggle = useCallback(() => {
    setPersisted(mode === 'speaker' ? 'grid' : 'speaker')
  }, [mode, setPersisted])

  return { mode, setMode: setPersisted, toggle }
}
