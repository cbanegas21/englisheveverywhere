'use client'

import { useCallback, useRef, useState } from 'react'
import {
  useTracks,
  useConnectionState,
  useChat,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
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
import { useLiveVocab } from '../hooks/useLiveVocab'
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
import { ReactionsPopover, ReactionsLayer } from './Reactions'
import type { FloatingReaction, RemoteHand } from './Reactions'
import { CuadernoPanel } from './CuadernoPanel'
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
  // visibility, not capture. Default recognizer language follows the UI
  // locale; user can toggle ES/EN from the cuaderno header at any time.
  const [recognizerLang, setRecognizerLang] = useState<'es-ES' | 'en-US'>(
    lang === 'es' ? 'es-ES' : 'en-US'
  )
  const transcript = useLiveTranscript({ enabled: true, bookingId, lang: recognizerLang })

  // Live AI cuaderno — extracts teaching-worthy vocab from the running
  // transcript every ~30s via Claude haiku 4.5. Best-effort, silent on
  // failure (no Anthropic key = empty vocab list, panel still works).
  const liveVocab = useLiveVocab({
    finals: transcript.finals,
    uiLang: lang,
    enabled: true,
  })

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
  // Cuaderno is the editorial replacement for the prior TranscriptPanel —
  // a paper-cream notebook on the right with both AI vocab and raw
  // transcript tabs. The control-bar toggle collapses it. Defaults ON on
  // desktop, but OFF on narrow screens where its fixed 360px would otherwise
  // crush the video stage (mobile = video focus).
  const [showCuaderno, setShowCuaderno] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1024
  )
  const [isCameraOff, setIsCameraOff] = useState(false)
  // Measured control-bar height (wraps to 2 rows on narrow screens) so the PiP
  // self-view always rests above it (CALL-08).
  const [controlBarHeight, setControlBarHeight] = useState(96)

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
      void sendWhiteboardControl(payload, { topic: 'whiteboard-control', reliable: true }).catch(() => {})
      return next
    })
  }, [sendWhiteboardControl])
  const closeWhiteboard = useCallback(() => {
    setShowWhiteboard(false)
    const payload = new TextEncoder().encode(JSON.stringify({ type: 'close' }))
    void sendWhiteboardControl(payload, { topic: 'whiteboard-control', reliable: true }).catch(() => {})
  }, [sendWhiteboardControl])
  // Raise-hand (CALL-11) + emoji reactions (CALL-12), mirrored to the peer over
  // a 'reactions' data channel. Floating emojis + a hand-raise pill render over
  // the stage; the popover lives above the control bar.
  const [showReactions, setShowReactions] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [remoteHand, setRemoteHand] = useState<RemoteHand>({ raised: false, name: otherName })
  const [floating, setFloating] = useState<FloatingReaction[]>([])
  const reactionId = useRef(0)

  const pushFloating = useCallback((emoji: string) => {
    const id = ++reactionId.current
    setFloating(prev => [...prev, { id, emoji }])
    setTimeout(() => setFloating(prev => prev.filter(f => f.id !== id)), 2400)
  }, [])

  const { send: sendReaction } = useDataChannel('reactions', msg => {
    try {
      const evt = JSON.parse(new TextDecoder().decode(msg.payload)) as
        | { type: 'reaction'; emoji: string }
        | { type: 'hand'; raised: boolean; name?: string }
      if (evt.type === 'reaction' && typeof evt.emoji === 'string') pushFloating(evt.emoji)
      if (evt.type === 'hand') setRemoteHand({ raised: !!evt.raised, name: evt.name || otherName })
    } catch { /* ignore malformed */ }
  })

  const handleReact = useCallback((emoji: string) => {
    pushFloating(emoji)
    const payload = new TextEncoder().encode(JSON.stringify({ type: 'reaction', emoji }))
    void sendReaction(payload, { topic: 'reactions', reliable: true })
  }, [pushFloating, sendReaction])

  const handleToggleHand = useCallback(() => {
    setHandRaised(prev => {
      const next = !prev
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'hand', raised: next, name: myName }))
      void sendReaction(payload, { topic: 'reactions', reliable: true }).catch(() => {})
      return next
    })
  }, [sendReaction, myName])

  const participants = useParticipants()
  const layout = useRoomLayout()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const selfView = useSelfViewPosition(stageRef)
  // Second PiP for the remote camera, shown during screen-share so both faces
  // stay visible over the shared screen (CALL-10). Independent position/size/
  // hidden state (own localStorage prefix); defaults to the opposite corner.
  const remoteView = useSelfViewPosition(stageRef, { keyPrefix: 'ee.sala.remoteview', defaultCorner: 'bottom-left' })

  // Chat + unread counter. Unread = messages that arrived while the panel
  // was closed. Opening the panel resets the baseline to the current count.
  // Uses React's "adjust state based on change" pattern (prev-value state)
  // instead of a useEffect to stay compiler-clean.
  const { chatMessages, send, isSending } = useChat()
  const { localParticipant } = useLocalParticipant()
  const [baselineCount, setBaselineCount] = useState(0)
  const [prevShowChat, setPrevShowChat] = useState(showChat)
  if (prevShowChat !== showChat) {
    setPrevShowChat(showChat)
    if (showChat) setBaselineCount(chatMessages.length)
  }
  // Unread = messages that arrived while the panel was closed, EXCLUDING your
  // own — sending a message should never badge yourself (CALL-02).
  const unreadCount = chatMessages
    .slice(baselineCount)
    .filter((m) => m.from?.identity !== localParticipant.identity).length

  // Keep the PiP self-view clear of an open right-side panel (chat 360 / notes
  // 320) and of the control bar (CALL-01 / CALL-08). When both chat + notes are
  // open, use the wider inset.
  const selfViewRightInset = Math.max(showChat ? 360 : 0, showNotes ? 320 : 0)
  const selfViewBottomInset = controlBarHeight

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
        participantCount={participants.length}
      />
      <div className="flex flex-1 min-h-0">
      <div ref={stageRef} className="flex-1 relative min-w-0">
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
                size={selfView.size}
                rightInset={selfViewRightInset}
                bottomInset={selfViewBottomInset}
                hideLabel={tx.hideSelf}
                shrinkLabel={tx.shrinkSelf}
                enlargeLabel={tx.enlargeSelf}
                onHide={selfView.hide}
                onShrink={selfView.shrink}
                onEnlarge={selfView.enlarge}
                onPointerDown={selfView.onPointerDown}
                onPointerMove={selfView.onPointerMove}
                onPointerUp={selfView.onPointerUp}
              />
            ) : (
              <SelfViewPill
                label={tx.showSelf}
                rightInset={selfViewRightInset}
                bottomInset={selfViewBottomInset}
                onShow={selfView.show}
              />
            )}
            {/* Remote face PiP — only while screen-sharing, so you keep seeing
                them over the shared screen. Hide-able + resizable independently. */}
            {remoteTrack && (!remoteView.hidden ? (
              <LocalSelfView
                trackRef={remoteTrack}
                myName={otherName}
                isCameraOff={false}
                corner={remoteView.corner}
                isDragging={remoteView.isDragging}
                size={remoteView.size}
                rightInset={selfViewRightInset}
                bottomInset={selfViewBottomInset}
                hideLabel={tx.hideTheirs}
                shrinkLabel={tx.shrinkSelf}
                enlargeLabel={tx.enlargeSelf}
                onHide={remoteView.hide}
                onShrink={remoteView.shrink}
                onEnlarge={remoteView.enlarge}
                onPointerDown={remoteView.onPointerDown}
                onPointerMove={remoteView.onPointerMove}
                onPointerUp={remoteView.onPointerUp}
              />
            ) : (
              <SelfViewPill
                label={tx.showTheirs}
                side="left"
                rightInset={selfViewRightInset}
                bottomInset={selfViewBottomInset}
                onShow={remoteView.show}
              />
            ))}
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
                size={selfView.size}
                rightInset={selfViewRightInset}
                bottomInset={selfViewBottomInset}
                hideLabel={tx.hideSelf}
                shrinkLabel={tx.shrinkSelf}
                enlargeLabel={tx.enlargeSelf}
                onHide={selfView.hide}
                onShrink={selfView.shrink}
                onEnlarge={selfView.enlarge}
                onPointerDown={selfView.onPointerDown}
                onPointerMove={selfView.onPointerMove}
                onPointerUp={selfView.onPointerUp}
              />
            ) : (
              <SelfViewPill
                label={tx.showSelf}
                rightInset={selfViewRightInset}
                bottomInset={selfViewBottomInset}
                onShow={selfView.show}
              />
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
          showReactions={showReactions}
          onToggleReactions={() => setShowReactions(p => !p)}
          handRaised={handRaised}
          showDevices={showDevices}
          onToggleDevices={() => setShowDevices(p => !p)}
          showWhiteboard={showWhiteboard}
          onToggleWhiteboard={toggleWhiteboard}
          showTranscript={showCuaderno}
          onToggleTranscript={() => setShowCuaderno(p => !p)}
          onHeightChange={setControlBarHeight}
        />
        {isTeacher && (
          <NotesPanel
            lang={lang}
            sessionId={sessionId}
            show={showNotes}
            onClose={() => setShowNotes(false)}
            bottomInset={selfViewBottomInset}
          />
        )}
        <ChatPanel
          lang={lang}
          show={showChat}
          onClose={() => setShowChat(false)}
          chatMessages={chatMessages}
          send={send}
          isSending={isSending}
          bottomInset={selfViewBottomInset}
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
        <ReactionsPopover
          lang={lang}
          show={showReactions}
          onClose={() => setShowReactions(false)}
          handRaised={handRaised}
          onToggleHand={handleToggleHand}
          onReact={handleReact}
        />
        <ReactionsLayer
          lang={lang}
          floating={floating}
          localHandRaised={handRaised}
          remoteHand={remoteHand}
        />
      </div>
      <CuadernoPanel
        lang={lang}
        show={showCuaderno}
        finals={transcript.finals}
        interims={transcript.interims}
        supported={transcript.supported}
        listening={transcript.listening}
        vocab={liveVocab.entries}
        isExtractingVocab={liveVocab.isExtracting}
        recognizerLang={recognizerLang}
        onChangeRecognizerLang={setRecognizerLang}
      />
      </div>
    </div>
  )
}
