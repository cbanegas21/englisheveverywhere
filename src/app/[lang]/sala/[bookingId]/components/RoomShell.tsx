'use client'

import { useCallback, useRef, useState } from 'react'
import {
  useTracks,
  useConnectionState,
  useChat,
  useDataChannel,
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
import { useLiveTranscript } from '../hooks/useLiveTranscript'
import { TopBar } from './TopBar'
import { VideoTile } from './VideoTile'
import { LocalSelfView, SelfViewPill } from './LocalSelfView'
import { GridLayout } from './GridLayout'
import { ScreenShareView } from './ScreenShareView'
import { ControlBar } from './ControlBar'
import { NotesPanel } from './NotesPanel'
import { ChatPanel } from './ChatPanel'
import { DeviceMenu } from './DeviceMenu'
import { Whiteboard } from './Whiteboard'
import { TranscriptPanel } from './TranscriptPanel'
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

  // Live transcript. Runs for the life of the call so the teacher's leave
  // flow can persist a complete transcript — the panel toggle only affects
  // visibility, not capture.
  const transcript = useLiveTranscript({ enabled: true })

  const { isLeaving, leave } = useLeaveFlow({
    isTeacher, bookingId, sessionId, lang, onComplete,
    getTranscript: transcript.snapshot,
  })

  // When the teacher clicks End Class, only THEIR LiveKit client disconnects.
  // The student's client stays connected to an empty room (LiveKit auto-closes
  // after empty_timeout, but that leaves the student staring at a dead call).
  // Broadcast a 'session-ended' control event so the student auto-leaves and
  // transitions to the EndedScreen immediately.
  const { send: sendSessionControl } = useDataChannel('session-control', msg => {
    if (isTeacher) return
    try {
      const text = new TextDecoder().decode(msg.payload)
      const evt = JSON.parse(text) as { type: 'ended' }
      if (evt.type === 'ended') void leave()
    } catch { /* ignore malformed */ }
  })
  const handleLeave = useCallback(async () => {
    if (isTeacher) {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'ended' }))
      try {
        await sendSessionControl(payload, { topic: 'session-control', reliable: true })
      } catch { /* best-effort — don't block the teacher's own leave */ }
    }
    await leave()
  }, [isTeacher, leave, sendSessionControl])

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

  const screenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: true },
  )
  const activeShareTrack = screenShareTracks.find(isTrackReference) as TrackReference | undefined

  const [showNotes, setShowNotes] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)

  // Whiteboard open/close is mirrored across peers via a lightweight control
  // channel. Without this, when the teacher toggled the board open, the
  // student's Whiteboard component stayed unmounted (show=false) and never
  // subscribed to the content data channel — so strokes never arrived for
  // the peer. This channel is always subscribed regardless of visibility.
  const { send: sendWhiteboardControl } = useDataChannel('whiteboard-control', msg => {
    try {
      const text = new TextDecoder().decode(msg.payload)
      const evt = JSON.parse(text) as { type: 'open' | 'close' }
      if (evt.type === 'open') setShowWhiteboard(true)
      if (evt.type === 'close') setShowWhiteboard(false)
    } catch { /* ignore malformed */ }
  })
  const toggleWhiteboard = useCallback(() => {
    setShowWhiteboard(prev => {
      const next = !prev
      const payload = new TextEncoder().encode(JSON.stringify({ type: next ? 'open' : 'close' }))
      void sendWhiteboardControl(payload, { topic: 'whiteboard-control', reliable: true })
      return next
    })
  }, [sendWhiteboardControl])
  const closeWhiteboard = useCallback(() => {
    setShowWhiteboard(false)
    const payload = new TextEncoder().encode(JSON.stringify({ type: 'close' }))
    void sendWhiteboardControl(payload, { topic: 'whiteboard-control', reliable: true })
  }, [sendWhiteboardControl])
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
        {activeShareTrack ? (
          <>
            <ScreenShareView lang={lang} shareTrack={activeShareTrack} />
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
        ) : layout.mode === 'speaker' ? (
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
          onLeave={handleLeave}
          isLeaving={isLeaving}
          onCameraOffChange={setIsCameraOff}
          layoutMode={layout.mode}
          onToggleLayout={layout.toggle}
          showChat={showChat}
          onToggleChat={() => setShowChat(p => !p)}
          unreadCount={unreadCount}
          showDevices={showDevices}
          onToggleDevices={() => setShowDevices(p => !p)}
          showWhiteboard={showWhiteboard}
          onToggleWhiteboard={toggleWhiteboard}
          showTranscript={showTranscript}
          onToggleTranscript={() => setShowTranscript(p => !p)}
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
        <DeviceMenu
          lang={lang}
          show={showDevices}
          onClose={() => setShowDevices(false)}
        />
        <Whiteboard
          lang={lang}
          bookingId={bookingId}
          show={showWhiteboard}
          onClose={closeWhiteboard}
        />
        <TranscriptPanel
          lang={lang}
          show={showTranscript}
          onClose={() => setShowTranscript(false)}
          finals={transcript.finals}
          interims={transcript.interims}
          supported={transcript.supported}
          listening={transcript.listening}
        />
      </div>
    </div>
  )
}
