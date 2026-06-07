'use client'

import { useEffect, useState } from 'react'

// Live media-query hook. Re-evaluates on resize/rotation (the call room must
// switch the cuaderno between its desktop rail and the mobile bottom-sheet when
// a phone rotates), unlike the old one-shot window.innerWidth read.
export function useMediaQuery(query: string, fallback = false): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return fallback
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query])

  return matches
}
