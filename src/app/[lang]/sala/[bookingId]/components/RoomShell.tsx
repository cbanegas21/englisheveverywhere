'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useTracks,
  useConnectionState,
  useChat,
  useDataChannel,
  useLocalParticipant,
  isTrackReference,
} from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { Track, ConnectionState } from 'livekit-client'
import type { Locale } from '@/lib/i18n/translations'
import type { SessionSummary } from '@/app/actions/video'
import { videoStrings } from '../i18n'
import { useLeaveFlow } from '../hooks/useLeaveFlow'
import { useRoomLayout } from '../hooks/useRoomLayout'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useSelfViewPosition } from '../hooks/useSelfViewPosition'
import { useLiveTranscript } from '../hooks/useLiveTranscript'
import { useLiveVocab } from '../hooks/useLiveVocab'
import { useHasStarted } from '../hooks/useHasStarted'
import { TopBar } from './TopBar'
import { VideoTile } from './VideoTile'
import { LocalSelfView, SelfViewPill } from './LocalSelfView'
import { GridLayout } from './GridLayout'
import { ScreenShareView } from './ScreenShareView'
import { ShareScreenMenu } from './ShareScreenMenu'
import type { ShareOptions } from './ShareScreenMenu'
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
import { ErrorBoundary } from './ErrorBoundary'

interface Props {
  lang: Locale
  isTeacher: boolean
  myName: string
  otherName: string
  bookingId: string
  sessionId: string
  scheduledAt: string
  durationMinutes: number
  // CALL-01: identities the client may trust for data-channel control events.
  // teacherIdentity is the ONLY legitimate sender of a session-end broadcast;
  // peerIdentities is the set of known participants (teacher / student /
  // placement conductor, excluding self) allowed to drive whiteboard + reactions.
  teacherIdentity: string | null
  peerIdentities: string[]
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
  teacherIdentity,
  peerIdentities,
  onComplete,
}: Props) {
  const tx = videoStrings(lang)
  const connectionState = useConnectionState()

  // CALL-01 gate: drop a control event only when its sender is IDENTIFIABLE and
  // NOT a known participant — that catches a forged event from an observer or
  // outsider. A reliable packet whose `msg.from` is momentarily unresolved (a
  // remoteParticipants map-lookup miss during a (re)connect race — LiveKit still
  // emits DataReceived with an undefined participant in that window) is given the
  // benefit of the doubt and honored, since the room itself is participant-bounded
  // by token. Used for the cosmetic channels (whiteboard/reactions); session-end
  // is gated more strictly below.
  const isUntrustedSender = useCallback(
    (identity: string | undefined) => !!identity && !peerIdentities.includes(identity),
    [peerIdentities],
  )

  // The live transcript + AI cuaderno are DESKTOP-ONLY. On phones the continuous
  // speech capture (a fresh MediaRecorder on the mic every few seconds) + the
  // ~30s AI calls compete with the WebRTC pipeline and can drop the call — the
  // room must stay rock-solid on mobile. At >=1024px the cuaderno shows as a right
  // rail and the engine runs; below that it's off entirely (the control-bar toggle
  // is hidden too). Default false so a phone never starts the heavy engine even
  // for a frame (the matchMedia initializer corrects to true on a real desktop).
  const isDesktopCuaderno = useMediaQuery('(min-width: 1024px)', false)

  // Warm-up gate: before the scheduled start the room is open (Zoom-style early
  // join) but the cuaderno hasn't started and NOTHING is saved yet (Carlos). The
  // transcript + vocab engines only run once the class is actually live, so early
  // small-talk isn't transcribed, doesn't spend Deepgram/Anthropic credit, and
  // never lands in the saved transcript/vocabulary. Flips to live automatically
  // at the scheduled time without a remount.
  const hasStarted = useHasStarted(scheduledAt)
  const cuadernoActive = isDesktopCuaderno && hasStarted
  const isWarmup = isDesktopCuaderno && !hasStarted

  // Recognizer language follows the UI locale; user can toggle ES/EN from the
  // cuaderno header (desktop) at any time.
  const [recognizerLang, setRecognizerLang] = useState<'es-ES' | 'en-US'>(
    lang === 'es' ? 'es-ES' : 'en-US'
  )
  const transcript = useLiveTranscript({ enabled: cuadernoActive, bookingId, lang: recognizerLang })

  // Live AI cuaderno — extracts teaching-worthy vocab from the running transcript
  // every ~30s via Claude haiku 4.5. Best-effort; desktop-only + only once the
  // class is live (gated with the transcript engine above).
  const liveVocab = useLiveVocab({
    bookingId,
    finals: transcript.finals,
    uiLang: lang,
    enabled: cuadernoActive,
  })

  const { isLeaving, leave } = useLeaveFlow({
    isTeacher, bookingId, sessionId, lang, onComplete,
    getTranscript: transcript.snapshot,
    getVocab: liveVocab.snapshot,
  })

  // When the teacher clicks End Class, only THEIR LiveKit client disconnects.
  // The student's client stays connected to an empty room (LiveKit auto-closes
  // after empty_timeout, but that leaves the student staring at a dead call).
  // Broadcast a 'session-ended' control event so the student auto-leaves and
  // transitions to the EndedScreen immediately.
  const { send: sendSessionControl } = useDataChannel('session-control', msg => {
    if (isTeacher) return
    // Only the teacher may end the session. Kept STRICT (exact teacher identity)
    // even though it means a teacher 'ended' whose sender is briefly unresolved
    // during a reconnect race is ignored — that case self-heals (LiveKit
    // empty_timeout → onDisconnected → EndedScreen), whereas honoring an
    // unidentified sender here would reopen the forged-kick vector CALL-01 closes.
    if (!teacherIdentity || msg.from?.identity !== teacherIdentity) return
    try {
      const text = new TextDecoder().decode(msg.payload)
      const evt = JSON.parse(text) as { type: 'ended' }
      if (evt.type === 'ended') void leave()
    } catch { /* ignore malformed */ }
  })
  // Surfaced when the teacher's End-class is REFUSED (e.g. the class hasn't
  // started yet) — completeSession returns an error, the room is NOT torn down,
  // and the teacher sees the reason instead of a misleading "ended" screen.
  const [endError, setEndError] = useState<string | null>(null)
  const handleLeave = useCallback(async () => {
    setEndError(null)
    // Tell the student to leave ONLY on the success path (passed into leave so it
    // fires after completion succeeds, before disconnect) — a refused end must not
    // kick the student out of a class that's still going.
    const broadcastEnded = async () => {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'ended' }))
      try {
        await sendSessionControl(payload, { topic: 'session-control', reliable: true })
      } catch { /* best-effort — don't block the teacher's own leave */ }
    }
    const res = await leave(isTeacher ? broadcastEnded : undefined)
    if (res && !res.ok) setEndError(res.error)
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

  // Whether an accompanying screen-share AUDIO track is live (local published or
  // remote subscribed). Drives the "🔊 Audio" badge on the presenter view and the
  // post-share "no sound was shared" reminder. onlySubscribed:false so the local
  // presenter sees their own audio publication too.
  const screenAudioTracks = useTracks(
    [{ source: Track.Source.ScreenShareAudio, withPlaceholder: false }],
    { onlySubscribed: false },
  )
  const shareHasAudio = screenAudioTracks.some(isTrackReference)

  const [showNotes, setShowNotes] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  // Cuaderno = the AI vocab + raw transcript notebook. HIDDEN by default (Carlos):
  // it only opens when the user clicks the control-bar toggle — never auto-shown.
  // (The transcript ENGINE accuracy/speaker fix is B3/Fase 1.)
  const [showCuaderno, setShowCuaderno] = useState(false)
  // Phone-width: the self-view PiP clamps to its small size and a full-width
  // panel hides it (rather than shoving it off-screen / over the panel input).
  const isCompact = useMediaQuery('(max-width: 639px)', false)
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
    // Drop only a forged board open/close from an identifiable outsider (CALL-01).
    if (isUntrustedSender(msg.from?.identity)) return
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
    // Drop only forged emoji spam / a fake remote hand from an identifiable
    // outsider (CALL-01); honor a legit peer even if briefly unresolved.
    if (isUntrustedSender(msg.from?.identity)) return
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
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant()
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

  // ── Screen share (Zoom-style) ──────────────────────────────────────────────
  // RoomShell owns the share lifecycle so it can build capture options at click
  // time and react to the published audio track. The control-bar button opens
  // ShareScreenMenu when idle, or stops the share when active.
  const [showShareMenu, setShowShareMenu] = useState(false)
  // Advisory ('info', polite) vs hard failure ('error', assertive) so the toast
  // maps to the right ARIA live-region role.
  const [shareNotice, setShareNotice] = useState<{ text: string; kind: 'info' | 'error' } | null>(null)
  // Handle for the post-share "did audio land?" check, so a fast stop (or unmount)
  // cancels it instead of firing a stale "no sound" toast for a share that ended.
  const shareAudioTimerRef = useRef<number | null>(null)
  // getDisplayMedia is unavailable on most mobile browsers — hide the whole
  // control rather than offer a button that throws. RoomShell only ever mounts on
  // the client (it's gated behind the async LiveKit connection, never in SSR
  // HTML), so a lazy initializer reads navigator safely and computes this once.
  const [shareSupported] = useState(() =>
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  )

  const startShare = useCallback(async ({ audio, motion }: ShareOptions) => {
    setShareNotice(null)
    if (shareAudioTimerRef.current != null) { window.clearTimeout(shareAudioTimerRef.current); shareAudioTimerRef.current = null }
    try {
      await localParticipant.setScreenShareEnabled(true, {
        audio,
        systemAudio: audio ? 'include' : 'exclude',
        contentHint: motion ? 'motion' : 'detail',
        surfaceSwitching: 'include',
        selfBrowserSurface: 'exclude',
      })
      // The presenter must tick the browser's own "share audio" box — we can't do
      // it for them. If they asked for audio but no audio track landed, nudge
      // them: this is the exact reason the sound "didn't work at all" before.
      // Re-check the VIDEO publication too, so a share that was stopped within the
      // grace window doesn't fire a stale "no sound" toast for a dead share.
      if (audio) {
        shareAudioTimerRef.current = window.setTimeout(() => {
          shareAudioTimerRef.current = null
          const stillSharing = !!localParticipant.getTrackPublication(Track.Source.ScreenShare)
          const hasAudio = !!localParticipant.getTrackPublication(Track.Source.ScreenShareAudio)
          if (stillSharing && !hasAudio) setShareNotice({ text: tx.shareNoAudioWarning, kind: 'info' })
        }, 1200)
      }
    } catch (err) {
      // Cancelling the picker rejects with NotAllowedError/AbortError — that's an
      // intentional "never mind", so stay silent. Anything else is a real failure.
      const name = (err as { name?: string } | null)?.name
      if (name !== 'NotAllowedError' && name !== 'AbortError') setShareNotice({ text: tx.shareError, kind: 'error' })
    }
  }, [localParticipant, tx])

  const handleShareClick = useCallback(() => {
    if (isScreenShareEnabled) {
      // Stopping cancels a pending audio check so it can't warn about a dead share.
      if (shareAudioTimerRef.current != null) { window.clearTimeout(shareAudioTimerRef.current); shareAudioTimerRef.current = null }
      void localParticipant.setScreenShareEnabled(false)
    } else {
      setShowShareMenu(true)
    }
  }, [isScreenShareEnabled, localParticipant])

  // Cancel any pending audio check on unmount (leave/disconnect mid-share).
  useEffect(() => () => {
    if (shareAudioTimerRef.current != null) window.clearTimeout(shareAudioTimerRef.current)
  }, [])

  // Auto-clear ONLY the transient error notice. The "no sound shared" advisory
  // (kind 'info') must PERSIST until the user closes it — it's the crucial signal
  // that the browser audio box wasn't ticked (Carlos). Both have an × close button.
  useEffect(() => {
    if (!shareNotice || shareNotice.kind === 'info') return
    const t = window.setTimeout(() => setShareNotice(null), 9000)
    return () => window.clearTimeout(t)
  }, [shareNotice])

  // ── Mobile back-gesture trap (stops a stray swipe from dropping the call) ──
  // While a full-bleed panel/overlay is open, an iOS Safari edge-swipe-back would
  // otherwise unmount the room → disconnect → "kicked out of the call." Keep one
  // trapped history entry for the room: a back press CLOSES the open panel (and
  // re-arms the trap) instead of navigating away. With nothing open, back is left
  // alone so a deliberate exit still works.
  const anyPanelOpen = showWhiteboard || showCuaderno || showChat || showNotes || showDevices || showReactions || showShareMenu
  const anyPanelOpenRef = useRef(anyPanelOpen)
  // Keep the ref in sync from an effect (not during render) so the popstate
  // handler always reads the latest value — a back-gesture is a user event, so it
  // can only fire after this effect has flushed.
  useEffect(() => { anyPanelOpenRef.current = anyPanelOpen }, [anyPanelOpen])
  const closeAllPanels = useCallback(() => {
    closeWhiteboard()
    setShowCuaderno(false); setShowChat(false); setShowNotes(false); setShowDevices(false); setShowReactions(false); setShowShareMenu(false)
  }, [closeWhiteboard])
  useEffect(() => {
    window.history.pushState({ eeSalaTrap: true }, '')
    const onPop = () => {
      if (anyPanelOpenRef.current) {
        closeAllPanels()
        window.history.pushState({ eeSalaTrap: true }, '') // re-arm so the trap persists
      }
      // else: nothing open → allow the back through (user leaves normally)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [closeAllPanels])

  // The cuaderno is desktop-only (no mobile toggle, no in-sheet close). If the
  // viewport narrows below the breakpoint while it was open (desktop resize /
  // rotation), force it closed so it can never become a stuck mobile sheet.
  useEffect(() => {
    if (!isDesktopCuaderno) setShowCuaderno(false)
  }, [isDesktopCuaderno])

  // Keep the PiP self-view clear of an open right-side panel (chat 360 / notes
  // 320) and of the control bar (CALL-01 / CALL-08). When both chat + notes are
  // open, use the wider inset.
  const selfViewRightInset = isCompact ? 0 : Math.max(showChat ? 360 : 0, showNotes ? 320 : 0)
  const selfViewBottomInset = controlBarHeight
  // On phones a full-width panel covers the stage — hide the PiP instead of
  // floating it over the panel's input. Clamp the PiP to small on phones too
  // (md/lg would eat a third of the screen) without overwriting the stored size.
  const panelCoversStage = isCompact && (showChat || showNotes)
  const effectiveSelfSize = isCompact ? 'sm' : selfView.size
  const effectiveRemoteSize = isCompact ? 'sm' : remoteView.size

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
      {endError && (
        <div
          role="alert"
          style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 100, maxWidth: 'min(92vw, 480px)', display: 'flex', alignItems: 'center', gap: 12,
            background: '#7f1d1d', color: '#fff', padding: '12px 16px', borderRadius: 10,
            fontSize: 13, lineHeight: 1.45, boxShadow: '0 12px 34px rgba(0,0,0,0.45)',
          }}
        >
          <span style={{ flex: 1 }}>{endError}</span>
          <button
            onClick={() => setEndError(null)}
            aria-label={tx.close}
            style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 18, lineHeight: 1, minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      )}
      {shareNotice && (
        <div
          role={shareNotice.kind === 'error' ? 'alert' : 'status'}
          style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 100, maxWidth: 'min(92vw, 520px)', display: 'flex', alignItems: 'center', gap: 12,
            background: shareNotice.kind === 'error' ? '#7f1d1d' : '#7c5807', color: '#fff', padding: '12px 16px', borderRadius: 10,
            fontSize: 13, lineHeight: 1.45, boxShadow: '0 12px 34px rgba(0,0,0,0.45)',
          }}
        >
          <span style={{ flex: 1 }}>{shareNotice.text}</span>
          <button
            onClick={() => setShareNotice(null)}
            aria-label={tx.close}
            style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 18, lineHeight: 1, minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      )}
      <TopBar
        lang={lang}
        otherName={otherName}
        scheduledAt={scheduledAt}
        durationMinutes={durationMinutes}
      />
      <div className="flex flex-1 min-h-0">
      <div ref={stageRef} className="flex-1 relative min-w-0">
        {activeShareTrack ? (
          <>
            <ScreenShareView lang={lang} shareTrack={activeShareTrack} hasAudio={shareHasAudio} />
            {!panelCoversStage && (!selfView.hidden ? (
              <LocalSelfView
                trackRef={localTrack}
                myName={myName}
                isCameraOff={isCameraOff}
                corner={selfView.corner}
                isDragging={selfView.isDragging}
                size={effectiveSelfSize}
                isCompact={isCompact}
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
            ))}
            {/* Remote face PiP — only while screen-sharing, so you keep seeing
                them over the shared screen. Hide-able + resizable independently. */}
            {!panelCoversStage && remoteTrack && (!remoteView.hidden ? (
              <LocalSelfView
                trackRef={remoteTrack}
                myName={otherName}
                isCameraOff={false}
                corner={remoteView.corner}
                isDragging={remoteView.isDragging}
                size={effectiveRemoteSize}
                isCompact={isCompact}
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
            <VideoTile lang={lang} trackRef={remoteTrack} fallbackName={otherName} bottomInset={selfViewBottomInset} />
            {!panelCoversStage && (!selfView.hidden ? (
              <LocalSelfView
                trackRef={localTrack}
                myName={myName}
                isCameraOff={isCameraOff}
                corner={selfView.corner}
                isDragging={selfView.isDragging}
                size={effectiveSelfSize}
                isCompact={isCompact}
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
            ))}
          </>
        ) : (
          <GridLayout
            lang={lang}
            remoteTrack={remoteTrack}
            localTrack={localTrack}
            myName={myName}
            otherName={otherName}
            isCameraOff={isCameraOff}
            bottomInset={selfViewBottomInset}
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
          isSharing={isScreenShareEnabled}
          shareSupported={shareSupported}
          shareMenuOpen={showShareMenu}
          onShareClick={handleShareClick}
          showTranscript={showCuaderno}
          onToggleTranscript={() => setShowCuaderno(p => !p)}
          transcriptEnabled={isDesktopCuaderno}
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
        <ShareScreenMenu
          lang={lang}
          show={showShareMenu}
          onClose={() => setShowShareMenu(false)}
          onStart={(opts) => { void startShare(opts) }}
        />
        <ErrorBoundary resetKey={`wb-${showWhiteboard}`} onError={closeWhiteboard}>
          <Whiteboard
            lang={lang}
            bookingId={bookingId}
            show={showWhiteboard}
            onClose={closeWhiteboard}
            peerIdentities={peerIdentities}
          />
        </ErrorBoundary>
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
      <ErrorBoundary resetKey={`cu-${showCuaderno}`} onError={() => setShowCuaderno(false)}>
        <CuadernoPanel
          lang={lang}
          show={showCuaderno}
          mode={isDesktopCuaderno ? 'rail' : 'sheet'}
          bottomInset={selfViewBottomInset}
          onClose={() => setShowCuaderno(false)}
          warmup={isWarmup}
          scheduledAt={scheduledAt}
          finals={transcript.finals}
          interims={transcript.interims}
          supported={transcript.supported}
          listening={transcript.listening}
          vocab={liveVocab.entries}
          isExtractingVocab={liveVocab.isExtracting}
          recognizerLang={recognizerLang}
          onChangeRecognizerLang={setRecognizerLang}
        />
      </ErrorBoundary>
      </div>
    </div>
  )
}
