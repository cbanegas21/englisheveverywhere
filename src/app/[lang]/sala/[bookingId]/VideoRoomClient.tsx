'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import { getRoomAccess, completeSession } from '@/app/actions/video'
import type { SessionSummary } from '@/app/actions/video'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from './i18n'
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
}: Props) {
  const tx = videoStrings(lang)
  const [isPendingDev, startDevTransition] = useTransition()

  const [phase, setPhase] = useState<Phase>('init')
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [summaryData, setSummaryData] = useState<SessionSummary | null>(null)

  const dashboardPath = isTeacher ? `/${lang}/maestro/dashboard` : `/${lang}/dashboard`

  const init = useCallback(async () => {
    setPhase('init')
    setErrorMsg(null)
    const result = await getRoomAccess(bookingId)
    if ('error' in result) {
      setErrorMsg(result.error)
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

  const handleComplete = useCallback((summary?: SessionSummary) => {
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
      <EndedScreen
        lang={lang}
        isTeacher={isTeacher}
        summary={summaryData}
        isGenerating={isPendingDev}
        dashboardPath={dashboardPath}
      />
    )
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: VIDEO_THEME.stage }}>
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
          <ErrorScreen lang={lang} errorMsg={errorMsg} onRetry={init} />
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
            onDisconnected={() => { if (!isTeacher) handleComplete() }}
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
              onComplete={handleComplete}
            />
          </LiveKitRoom>
        )}
      </div>
    </div>
  )
}
