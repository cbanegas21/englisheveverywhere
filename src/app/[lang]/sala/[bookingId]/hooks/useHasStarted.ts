import { useEffect, useState } from 'react'

// True once the scheduled start time has arrived. Before that the room is in
// "warm-up": participants can be in the call early (Zoom-style), but the AI
// cuaderno (transcript + vocab) hasn't started and nothing is being saved yet.
//
// Unlike a per-second countdown this fires a SINGLE timer that flips the flag
// exactly at scheduledAt, so it doesn't re-render the (video-heavy) room every
// second. RoomShell only ever mounts client-side, so reading Date.now() in the
// initializer is safe (no SSR hydration mismatch). A malformed scheduledAt is
// treated as already-started so the engine/save path is never permanently stuck.
export function useHasStarted(scheduledAt: string): boolean {
  const [started, setStarted] = useState(() => {
    const t = new Date(scheduledAt).getTime()
    return Number.isNaN(t) ? true : Date.now() >= t
  })

  useEffect(() => {
    if (started) return
    const t = new Date(scheduledAt).getTime()
    if (Number.isNaN(t)) { setStarted(true); return }
    let id: ReturnType<typeof setTimeout>
    // setTimeout delays overflow a signed 32-bit int (~24.86 days) and fire
    // immediately, so clamp each wait and re-arm until the real start time has
    // actually passed (handles a room opened far in advance).
    const arm = () => {
      const ms = t - Date.now()
      if (ms <= 0) { setStarted(true); return }
      id = setTimeout(arm, Math.min(ms, 2_147_483_647))
    }
    arm()
    return () => clearTimeout(id)
  }, [scheduledAt, started])

  return started
}
