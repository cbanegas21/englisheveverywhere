'use client'

import { useState } from 'react'
import {
  useTracks,
  useConnectionState,
  isTrackReference,
} from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { Track, ConnectionState } from 'livekit-client'
import type { Locale } from '@/lib/i18n/translations'
import type { SessionSummary } from '@/app/actions/video'
import { videoStrings } from '../i18n'
import { useLeaveFlow } from '../hooks/useLeaveFlow'
import { TopBar } from './TopBar'
import { VideoTile } from './VideoTile'
import { LocalSelfView } from './LocalSelfView'
import { ControlBar } from './ControlBar'
import { NotesPanel } from './NotesPanel'
import { ConnectingScreen } from './ConnectingScreen'
import { LeavingScreen } from './LeavingScreen'

interface Props {
  lang: Locale
  isTeacher: boolean
  myName: string
  otherName: string
  bookingId: string
  sessionId: string
  scheduledAt: string
  durationMinutes: number
  onComplete: (summary?: SessionSummary) => void
}

// Rendered INSIDE <LiveKitRoom>. Owns the render-dispatch for connecting /
// leaving / connected states so the leave flow never reuses the "joining"
// spinner (old bug: Entrando a la sala flashing on disconnect).
export function RoomShell({
  lang,
  isTeacher,
  myName,
  otherName,
  bookingId,
  sessionId,
  scheduledAt,
  durationMinutes,
  onComplete,
}: Props) {
  const tx = videoStrings(lang)
  const connectionState = useConnectionState()

  const { isLeaving, leave } = useLeaveFlow({
    isTeacher, bookingId, sessionId, lang, onComplete,
  })

  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  )
  const remoteTrack = cameraTracks.find(
    t => !t.participant.isLocal && isTrackReference(t),
  ) as TrackReference | undefined
  const localTrack = cameraTracks.find(
    t => t.participant.isLocal && isTrackReference(t),
  ) as TrackReference | undefined

  const [showNotes, setShowNotes] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)

  // Leaving takes priority — show the branded "ending" screen even if
  // ConnectionState has transitioned away from Connected during disconnect.
  if (isLeaving) {
    return <LeavingScreen message={tx.leaving} />
  }

  if (connectionState === ConnectionState.Connecting) {
    return <ConnectingScreen message={tx.joining} />
  }

  if (connectionState === ConnectionState.Reconnecting) {
    return <ConnectingScreen message={tx.reconnecting} />
  }

  // Disconnected before we initiated leave → treat as a connection drop.
  // (The student flow calls onComplete via LiveKitRoom.onDisconnected in
  // the parent, so this branch only renders for a brief transition.)
  if (connectionState === ConnectionState.Disconnected) {
    return <ConnectingScreen message={tx.reconnecting} />
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        lang={lang}
        isTeacher={isTeacher}
        myName={myName}
        otherName={otherName}
        scheduledAt={scheduledAt}
        durationMinutes={durationMinutes}
      />
      <div className="flex-1 relative">
        <VideoTile lang={lang} trackRef={remoteTrack} fallbackName={otherName} />
        <LocalSelfView trackRef={localTrack} myName={myName} isCameraOff={isCameraOff} />
        <ControlBar
          lang={lang}
          isTeacher={isTeacher}
          showNotes={showNotes}
          onToggleNotes={() => setShowNotes(p => !p)}
          onLeave={leave}
          isLeaving={isLeaving}
          onCameraOffChange={setIsCameraOff}
        />
        {isTeacher && (
          <NotesPanel
            lang={lang}
            sessionId={sessionId}
            show={showNotes}
            onClose={() => setShowNotes(false)}
          />
        )}
      </div>
    </div>
  )
}
