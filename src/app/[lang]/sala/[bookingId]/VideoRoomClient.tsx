'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { MotionConfig } from 'framer-motion'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import { getRoomAccess, completeSession } from '@/app/actions/video'
import type { SessionSummary } from '@/app/actions/video'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from './i18n'
import type { RoomErrorCode } from './i18n'
import { VIDEO_THEME } from './theme'
import { Lobby } from './components/Lobby'
import { RoomShell } from './components/RoomShell'
import { DevRoom } from './components/DevRoom'
import { EndedScreen } from './components/EndedScreen'
import { ErrorScreen } from './components/ErrorScreen'
import { ConnectingScreen } from './components/ConnectingScreen'

interface Props {
  lang: Locale
  bookingId: string
  scheduledAt: string
  durationMinutes: number
  isTeacher: boolean
  myName: string
  otherName: string
  status: string
  teacherIdentity: string | null
  peerIdentities: string[]
}

interface RoomData {
  url: string
  token: string
  sessionId: string
  isDevMode: boolean
}

type Phase = 'init' | 'lobby' | 'room' | 'dev' | 'ended' | 'error'

export default function VideoRoomClient({
  lang, bookingId, scheduledAt, durationMinutes,
  isTeacher, myName, otherName, status,
  teacherIdentity, peerIdentities,
}: Props) {
  const tx = videoStrings(lang)
  const [isPendingDev, startDevTransition] = useTransition()

  const [phase, setPhase] = useState<Phase>('init')
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  // Stable error code from getRoomAccess; ErrorScreen maps it to localized prose.
  const [errorCode, setErrorCode] = useState<RoomErrorCode | null>(null)
  const [summaryData, setSummaryData] = useState<SessionSummary | null>(null)

  const dashboardPath = isTeacher ? `/${lang}/maestro/dashboard` : `/${lang}/dashboard`

  const init = useCallback(async () => {
    setPhase('init')
    setErrorCode(null)
    const result = await getRoomAccess(bookingId)
    if ('error' in result) {
      setErrorCode(result.error)
      setPhase('error')
      return
    }
    setRoomData(result)
    // Zoom-style lobby: if the scheduled time hasn't arrived, show countdown.
    // Otherwise drop straight into the room (or the dev-mode stub).
    if (Date.now() < new Date(scheduledAt).getTime()) {
      setPhase('lobby')
    } else {
      setPhase(result.isDevMode ? 'dev' : 'room')
    }
  }, [bookingId, scheduledAt])

  useEffect(() => {
    // Kick off on a microtask so the initial setPhase inside init() isn't
    // synchronously called from the effect body (satisfies set-state-in-effect).
    queueMicrotask(() => { void init() })
  }, [init])

  // Marks an INTENTIONAL end (teacher's "End Class", the broadcast session-ended
  // event a student receives, or a self-initiated leave). Lets onDisconnected tell
  // a real class-end apart from an involuntary network drop (P2-7).
  const endedRef = useRef(false)
  // Counts involuntary reconnect attempts. A transient mobile drop (backgrounding,
  // a network blip, a stray gesture) silently rejoins instead of ejecting to the
  // error screen; reset to 0 on every successful connect so each new drop gets its
  // own retry, but a truly dead connection still surfaces the error after one try.
  const rejoinAttempts = useRef(0)

  const handleComplete = useCallback((summary?: SessionSummary) => {
    endedRef.current = true
    if (summary) setSummaryData(summary)
    setPhase('ended')
  }, [])

  function handleEnterFromLobby() {
    setPhase(roomData?.isDevMode ? 'dev' : 'room')
  }

  function handleDevLeave() {
    startDevTransition(async () => {
      const result = await completeSession(bookingId, roomData?.sessionId || null, lang)
      handleComplete('summary' in result ? result.summary : undefined)
    })
  }

  if (status === 'completed' || phase === 'ended') {
    return (
      <MotionConfig reducedMotion="user">
        <EndedScreen
          lang={lang}
          isTeacher={isTeacher}
          summary={summaryData}
          isGenerating={isPendingDev}
          dashboardPath={dashboardPath}
        />
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden" style={{ background: VIDEO_THEME.stage, overscrollBehavior: 'none' }}>
      <div className="flex-1 relative">
        {phase === 'init' && <ConnectingScreen message={tx.connecting} />}

        {phase === 'lobby' && (
          <Lobby
            lang={lang}
            otherName={otherName}
            scheduledAt={scheduledAt}
            onEnter={handleEnterFromLobby}
          />
        )}

        {phase === 'error' && (
          <ErrorScreen lang={lang} errorCode={errorCode} onRetry={init} />
        )}

        {phase === 'dev' && (
          <DevRoom
            lang={lang}
            isTeacher={isTeacher}
            myName={myName}
            otherName={otherName}
            isLeaving={isPendingDev}
            onLeave={handleDevLeave}
          />
        )}

        {phase === 'room' && roomData && (
          <LiveKitRoom
            serverUrl={roomData.url}
            token={roomData.token}
            connect={true}
            audio={true}
            video={true}
            className="absolute inset-0"
            // P1-2: a connection failure (firewall / LiveKit incident) no longer
            // leaves a perpetual spinner — surface a connection error + retry.
            onError={(err) => {
              console.error('[livekit] room error:', err?.message || err)
              if (!endedRef.current) { setErrorCode('connection'); setPhase('error') }
            }}
            onConnected={() => { rejoinAttempts.current = 0 }}
            // P2-7 / CALL-mobile: only a real end (teacher End-Class → broadcast →
            // handleComplete, a self leave, or an already-completed booking) goes to
            // the ended screen. An INVOLUNTARY drop (after LiveKit exhausts its own
            // reconnects) silently REJOINS once — re-running init() re-checks access
            // (→ proper "already ended"/"expired" screen if the class really finished,
            // or a fresh-token reconnect if it was just a mobile blip/backgrounding).
            // Only after that retry fails does it surface the connection error +
            // rejoin button, instead of ejecting the user on the first hiccup.
            onDisconnected={() => {
              if (endedRef.current || status === 'completed') return
              if (rejoinAttempts.current < 1) {
                rejoinAttempts.current += 1
                void init()
                return
              }
              setErrorCode('connection')
              setPhase('error')
            }}
          >
            <RoomAudioRenderer />
            <RoomShell
              lang={lang}
              isTeacher={isTeacher}
              myName={myName}
              otherName={otherName}
              bookingId={bookingId}
              sessionId={roomData.sessionId}
              scheduledAt={scheduledAt}
              durationMinutes={durationMinutes}
              teacherIdentity={teacherIdentity}
              peerIdentities={peerIdentities}
              onComplete={handleComplete}
            />
          </LiveKitRoom>
        )}
      </div>
    </div>
    </MotionConfig>
  )
}
