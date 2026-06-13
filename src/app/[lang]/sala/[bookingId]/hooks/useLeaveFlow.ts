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

  // Teacher leave can be REFUSED by completeSession (e.g. the class hasn't
  // started). On refusal we must NOT disconnect, broadcast "ended", or show the
  // EndedScreen — the teacher stays in the room and sees the reason. So the
  // teacher path completes FIRST, and only on success does it tell the student
  // (onBeforeDisconnect), disconnect, and finish. Returns the outcome so the
  // caller can surface a refusal.
  const leave = useCallback(async (
    onBeforeDisconnect?: () => Promise<void>,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (leavingRef.current) return { ok: true }
    leavingRef.current = true
    setIsLeaving(true)

    if (isTeacher) {
      // Snapshot the transcript BEFORE anything tears down — after disconnect the
      // room loses buffered peer captions that arrived right before the click.
      const transcriptSnapshot = transcriptRef.current ? transcriptRef.current() : ''

      const result = await completeSession(bookingId, sessionId, lang)
      if ('error' in result) {
        // Refused — undo the "leaving" state and stay put. Nothing was torn down,
        // the student was not told, no payout was minted.
        leavingRef.current = false
        setIsLeaving(false)
        return { ok: false, error: result.error }
      }

      if (transcriptSnapshot.trim()) {
        await saveSessionTranscript(sessionId, transcriptSnapshot).catch(() => {
          /* non-blocking — transcript is nice-to-have, not required to end */
        })
      }
      // Tell the student to leave, then disconnect, then transition to Ended.
      if (onBeforeDisconnect) await onBeforeDisconnect().catch(() => {})
      await room.disconnect()
      onComplete(result.summary)
      return { ok: true }
    }

    // Student (or data-channel-triggered) leave: just disconnect + show Ended.
    await room.disconnect()
    onComplete()
    return { ok: true }
  }, [room, isTeacher, bookingId, sessionId, lang, onComplete])

  return { isLeaving, leave }
}
