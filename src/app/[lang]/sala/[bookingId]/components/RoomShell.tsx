'use client'

import { useRef, useState } from 'react'
import {
  useTracks,
  useConnectionState,
  useChat,
  isTrackReference,
} from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { Track, ConnectionState } from 'livekit-client'
import type { Locale } from '@/lib/i18n/translations'
import type { SessionSummary } from '@/app/actions/video'
import { videoStrings } from '../i18n'
import { useLeaveFlow } from '../hooks/useLeaveFlow'
import { useRoomLayout } from '../hooks/useRoomLayout'
import { useSelfViewPosition } from '../hooks/useSelfViewPosition'
import { TopBar } from './TopBar'
import { VideoTile } from './VideoTile'
import { LocalSelfView, SelfViewPill } from './LocalSelfView'
import { GridLayout } from './GridLayout'
import { ControlBar } from './ControlBar'
import { NotesPanel } from './NotesPanel'
import { ChatPanel } from './ChatPanel'
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
  const [showChat, setShowChat] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const layout = useRoomLayout()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const selfView = useSelfViewPosition(stageRef)

  // Chat + unread counter. Unread = messages that arrived while the panel
  // was closed. Opening the panel resets the baseline to the current count.
  // Uses React's "adjust state based on change" pattern (prev-value state)
  // instead of a useEffect to stay compiler-clean.
  const { chatMessages, send, isSending } = useChat()
  const [baselineCount, setBaselineCount] = useState(0)
  const [prevShowChat, setPrevShowChat] = useState(showChat)
  if (prevShowChat !== showChat) {
    setPrevShowChat(showChat)
    if (showChat) setBaselineCount(chatMessages.length)
  }
  const unreadCount = Math.max(0, chatMessages.length - baselineCount)

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
      <div ref={stageRef} className="flex-1 relative">
        {layout.mode === 'speaker' ? (
          <>
            <VideoTile lang={lang} trackRef={remoteTrack} fallbackName={otherName} />
            {!selfView.hidden ? (
              <LocalSelfView
                trackRef={localTrack}
                myName={myName}
                isCameraOff={isCameraOff}
                corner={selfView.corner}
                isDragging={selfView.isDragging}
                hideLabel={tx.hideSelf}
                onHide={selfView.hide}
                onPointerDown={selfView.onPointerDown}
                onPointerMove={selfView.onPointerMove}
                onPointerUp={selfView.onPointerUp}
              />
            ) : (
              <SelfViewPill label={tx.showSelf} onShow={selfView.show} />
            )}
          </>
        ) : (
          <GridLayout
            lang={lang}
            remoteTrack={remoteTrack}
            localTrack={localTrack}
            myName={myName}
            otherName={otherName}
            isCameraOff={isCameraOff}
          />
        )}
        <ControlBar
          lang={lang}
          isTeacher={isTeacher}
          showNotes={showNotes}
          onToggleNotes={() => setShowNotes(p => !p)}
          onLeave={leave}
          isLeaving={isLeaving}
          onCameraOffChange={setIsCameraOff}
          layoutMode={layout.mode}
          onToggleLayout={layout.toggle}
          showChat={showChat}
          onToggleChat={() => setShowChat(p => !p)}
          unreadCount={unreadCount}
        />
        {isTeacher && (
          <NotesPanel
            lang={lang}
            sessionId={sessionId}
            show={showNotes}
            onClose={() => setShowNotes(false)}
          />
        )}
        <ChatPanel
          lang={lang}
          show={showChat}
          onClose={() => setShowChat(false)}
          chatMessages={chatMessages}
          send={send}
          isSending={isSending}
        />
      </div>
    </div>
  )
}
