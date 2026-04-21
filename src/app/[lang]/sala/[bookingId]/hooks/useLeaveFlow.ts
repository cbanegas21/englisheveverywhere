import { useCallback, useRef, useState } from 'react'
import { useRoomContext } from '@livekit/components-react'
import { completeSession, saveSessionTranscript, type SessionSummary } from '@/app/actions/video'
import type { Locale } from '@/lib/i18n/translations'

interface UseLeaveFlowArgs {
  isTeacher: boolean
  bookingId: string
  sessionId: string
  lang: Locale
  onComplete: (summary?: SessionSummary) => void
  getTranscript?: () => string
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
  getTranscript,
}: UseLeaveFlowArgs) {
  const room = useRoomContext()
  const [isLeaving, setIsLeaving] = useState(false)
  const leavingRef = useRef(false)
  const transcriptRef = useRef(getTranscript)
  transcriptRef.current = getTranscript

  const leave = useCallback(async () => {
    if (leavingRef.current) return
    leavingRef.current = true
    setIsLeaving(true)

    // Snapshot the transcript BEFORE disconnecting — after disconnect the
    // room tears down and we lose any buffered peer captions that arrived
    // right before the leave click.
    const transcriptSnapshot = isTeacher && transcriptRef.current
      ? transcriptRef.current()
      : ''

    // Disconnect first so the peer sees us leave immediately.
    await room.disconnect()

    if (isTeacher) {
      if (transcriptSnapshot.trim()) {
        await saveSessionTranscript(sessionId, transcriptSnapshot).catch(() => {
          /* non-blocking — transcript is nice-to-have, not required to end */
        })
      }
      const result = await completeSession(bookingId, sessionId, lang)
      onComplete('summary' in result ? result.summary : undefined)
    } else {
      onComplete()
    }
  }, [room, isTeacher, bookingId, sessionId, lang, onComplete])

  return { isLeaving, leave }
}
