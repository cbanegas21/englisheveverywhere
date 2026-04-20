import { useEffect, useState } from 'react'

// Countdown until scheduledAt. Emits isLive=true once we've crossed the
// scheduled time so the lobby can flip its CTA copy.
export function useCountdown(scheduledAt: string): { display: string | null; isLive: boolean } {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    // Prime on next microtask so the initial setState isn't synchronous
    // inside the effect body (avoids cascading render + lint rule).
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setNow(Date.now()) })
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])
  if (now === null) return { display: null, isLive: false }
  const target = new Date(scheduledAt).getTime()
  const diff = target - now
  if (diff <= 0) return { display: '00:00', isLive: true }
  const totalSec = Math.floor(diff / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return { display: `${d}d ${h}h ${m}m`, isLive: false }
  if (h > 0) return { display: `${h}h ${m}m ${String(s).padStart(2, '0')}s`, isLive: false }
  return { display: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, isLive: false }
}
