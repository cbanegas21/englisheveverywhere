import { useCallback, useRef, useState } from 'react'
import { useRoomContext } from '@livekit/components-react'
import { completeSession, type SessionSummary } from '@/app/actions/video'
import type { Locale } from '@/lib/i18n/translations'

interface UseLeaveFlowArgs {
  isTeacher: boolean
  bookingId: string
  sessionId: string
  lang: Locale
  onComplete: (summary?: SessionSummary) => void
}

// Owns the leave/end-class transition. Sets `isLeaving` BEFORE we call
// room.disconnect() so the shell can render a branded "Finalizando clase…"
// screen instead of the generic reconnecting spinner (which would otherwise
// flash because ConnectionState briefly leaves `Connected` during disconnect).
export function useLeaveFlow({
  isTeacher,
  bookingId,
  sessionId,
  lang,
  onComplete,
}: UseLeaveFlowArgs) {
  const room = useRoomContext()
  const [isLeaving, setIsLeaving] = useState(false)
  const leavingRef = useRef(false)

  const leave = useCallback(async () => {
    if (leavingRef.current) return
    leavingRef.current = true
    setIsLeaving(true)

    // Disconnect first so the peer sees us leave immediately.
    await room.disconnect()

    if (isTeacher) {
      const result = await completeSession(bookingId, sessionId, lang)
      onComplete('summary' in result ? result.summary : undefined)
    } else {
      onComplete()
    }
  }, [room, isTeacher, bookingId, sessionId, lang, onComplete])

  return { isLeaving, leave }
}
