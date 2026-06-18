'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Video, VideoOff, PhoneOff, FileText, LogOut, LayoutGrid, Maximize2, MessageSquare, MonitorUp, MonitorX, Settings2, PenSquare, Captions, Smile, Hand, MoreHorizontal } from 'lucide-react'
import { useTrackToggle } from '@livekit/components-react'
import { Track } from 'livekit-client'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'

interface Props {
  lang: Locale
  isTeacher: boolean
  showNotes: boolean
  onToggleNotes: () => void
  onLeave: () => void
  isLeaving: boolean
  onCameraOffChange?: (off: boolean) => void
  layoutMode: 'speaker' | 'grid'
  onToggleLayout: () => void
  showChat: boolean
  onToggleChat: () => void
  unreadCount: number
  showReactions: boolean
  onToggleReactions: () => void
  handRaised: boolean
  showDevices: boolean
  onToggleDevices: () => void
  showWhiteboard: boolean
  onToggleWhiteboard: () => void
  showTranscript: boolean
  onToggleTranscript: () => void
  // Desktop-only: the live transcript engine is too heavy for phones, so the
  // toggle is hidden when this is false (see RoomShell). Defaults to true.
  transcriptEnabled?: boolean
  // Reports the bar's rendered height so the parent can keep the self-view PiP
  // clear of it (CALL-08). With the single-row layout this stays stable, but
  // the ResizeObserver keeps it honest across breakpoints.
  onHeightChange?: (height: number) => void
}

// A single control descriptor. The bar renders the same descriptor either inline
// (a round icon button) or inside the "More" sheet (an icon + label row), so a
// tool can move between the bar and the overflow menu by breakpoint with no
// duplicated wiring.
type Tool = {
  key: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  active: boolean
  variant?: Variant
  badge?: number
}

export function ControlBar({
  lang,
  isTeacher,
  showNotes,
  onToggleNotes,
  onLeave,
  isLeaving,
  onCameraOffChange,
  layoutMode,
  onToggleLayout,
  showChat,
  onToggleChat,
  unreadCount,
  showReactions,
  onToggleReactions,
  handRaised,
  showDevices,
  onToggleDevices,
  showWhiteboard,
  onToggleWhiteboard,
  showTranscript,
  onToggleTranscript,
  transcriptEnabled = true,
  onHeightChange,
}: Props) {
  const tx = videoStrings(lang)
  const rootRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const [showMore, setShowMore] = useState(false)
  // Compact = phone-width. On compact only the essentials stay on the bar; the
  // rest fold into the "More" sheet so the row never wraps (the old 3-row pile).
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setIsCompact(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Close the "More" sheet on Escape; move keyboard focus into the menu on open
  // so keyboard / screen-reader users land on the first item (a11y).
  useEffect(() => {
    if (!showMore) return
    moreMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMore(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showMore])

  // Report height changes (defensive — keeps the PiP self-view above the bar).
  useEffect(() => {
    const el = rootRef.current
    if (!el || !onHeightChange) return
    const report = () => onHeightChange(el.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onHeightChange])

  // Derive mic/camera state from LiveKit (not local useState) so an external
  // mute — network blip, permission change, future admin mute — stays in sync
  // with the button labels. Audit EK-020.
  const mic = useTrackToggle({ source: Track.Source.Microphone })
  const cam = useTrackToggle({ source: Track.Source.Camera })
  const screenShare = useTrackToggle({ source: Track.Source.ScreenShare })
  const isMuted = !mic.enabled
  const isCameraOff = !cam.enabled

  // Mirror camera state up to the parent (avatar placeholder) when it changes.
  useEffect(() => {
    onCameraOffChange?.(isCameraOff)
  }, [isCameraOff, onCameraOffChange])

  // Media controls — always on the bar (mic + camera). Muted/off read as a solid
  // crimson alert so the state is unmistakable (audit EK-071).
  const media: Tool[] = [
    {
      key: 'mic',
      label: isMuted ? tx.unmute : tx.mute,
      icon: isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />,
      onClick: () => mic.toggle(),
      active: !isMuted,
      variant: isMuted ? 'alert' : 'neutral',
    },
    {
      key: 'cam',
      label: isCameraOff ? tx.startVideo : tx.stopVideo,
      icon: isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />,
      onClick: () => cam.toggle(),
      active: !isCameraOff,
      variant: isCameraOff ? 'alert' : 'neutral',
    },
  ]

  // Collaboration tools. The order is the priority order for what stays on the
  // bar as width shrinks; the tail folds into "More".
  const tools: Tool[] = [
    {
      key: 'chat',
      label: tx.chat,
      icon: <MessageSquare className="h-5 w-5" />,
      onClick: onToggleChat,
      active: showChat,
      variant: showChat ? 'brand' : 'neutral',
      badge: unreadCount,
    },
    {
      key: 'share',
      label: screenShare.enabled ? tx.stopSharing : tx.shareScreen,
      icon: screenShare.enabled ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />,
      onClick: () => { void screenShare.toggle() },
      active: screenShare.enabled,
      variant: screenShare.enabled ? 'brand' : 'neutral',
    },
    {
      key: 'reactions',
      label: tx.reactions,
      icon: handRaised ? <Hand className="h-5 w-5" /> : <Smile className="h-5 w-5" />,
      onClick: onToggleReactions,
      active: showReactions || handRaised,
      variant: showReactions || handRaised ? 'brand' : 'neutral',
    },
    ...(transcriptEnabled
      ? [{
          key: 'transcript',
          label: tx.transcript,
          icon: <Captions className="h-5 w-5" />,
          onClick: onToggleTranscript,
          active: showTranscript,
          variant: (showTranscript ? 'brand' : 'neutral') as Variant,
        }]
      : []),
    {
      key: 'whiteboard',
      label: tx.whiteboard,
      icon: <PenSquare className="h-5 w-5" />,
      onClick: onToggleWhiteboard,
      active: showWhiteboard,
      variant: showWhiteboard ? 'brand' : 'neutral',
    },
    {
      key: 'layout',
      label: layoutMode === 'grid' ? tx.layoutSpeaker : tx.layoutGrid,
      icon: layoutMode === 'grid' ? <Maximize2 className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />,
      onClick: onToggleLayout,
      active: false,
      variant: 'neutral',
    },
    {
      key: 'devices',
      label: tx.deviceSettings,
      icon: <Settings2 className="h-5 w-5" />,
      onClick: onToggleDevices,
      active: showDevices,
      variant: showDevices ? 'brand' : 'neutral',
    },
    ...(isTeacher
      ? [{
          key: 'notes',
          label: tx.notes,
          icon: <FileText className="h-5 w-5" />,
          onClick: onToggleNotes,
          active: showNotes,
          variant: (showNotes ? 'brand' : 'neutral') as Variant,
        }]
      : []),
  ]

  // How many tools stay on the bar before folding into "More".
  // Compact (phone): just Chat. Wide: the first four (chat, share, reactions,
  // transcript) — the rest live in More so the row never crowds even when both
  // side panels are open and the stage is narrow.
  const inlineCount = isCompact ? 1 : 4
  const inlineTools = tools.slice(0, inlineCount)
  const moreTools = tools.slice(inlineCount)

  return (
    <div
      ref={rootRef}
      className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-1.5 px-3 py-4 backdrop-blur-md sm:gap-2"
      style={{
        background: 'rgba(10,12,15,0.72)',
        borderTop: `1px solid ${VIDEO_THEME.border}`,
        // Clear the iOS home-indicator gesture bar on phones.
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
      }}
    >
      {/* Media group */}
      {media.map((t) => (
        <RoundButton key={t.key} tool={t} />
      ))}

      <Divider />

      {/* Tools that fit on the bar */}
      {inlineTools.map((t) => (
        <RoundButton key={t.key} tool={t} />
      ))}

      {/* Overflow */}
      {moreTools.length > 0 && (
        <div className="relative">
          <RoundButton
            tool={{
              key: 'more',
              label: tx.more,
              icon: <MoreHorizontal className="h-5 w-5" />,
              onClick: () => setShowMore((p) => !p),
              active: showMore,
              variant: showMore ? 'brand' : 'neutral',
            }}
          />
          {showMore && (
            <>
              <button
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setShowMore(false)}
                className="fixed inset-0 z-40 cursor-default"
                style={{ background: 'transparent' }}
              />
              <div
                ref={moreMenuRef}
                role="menu"
                className="absolute bottom-full right-0 z-50 mb-3 w-60 overflow-hidden rounded-2xl p-1.5 shadow-2xl"
                style={{
                  background: 'rgba(16,18,22,0.97)',
                  border: `1px solid ${VIDEO_THEME.border}`,
                  backdropFilter: 'blur(12px)',
                }}
              >
                {moreTools.map((t) => (
                  <MoreRow
                    key={t.key}
                    tool={t}
                    onPick={() => { t.onClick(); setShowMore(false) }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <Divider />

      {/* Leave / End — the one shape that breaks the circle pattern, so it always
          reads as the exit. */}
      {isTeacher ? (
        <LeaveButton
          onClick={onLeave}
          disabled={isLeaving}
          label={isLeaving ? tx.endingSession : tx.endClass}
          loading={isLeaving}
          compact={isCompact}
          confirmTitle={tx.leaveConfirmTitle}
          confirmYes={tx.leaveConfirmYes}
          confirmNo={tx.leaveConfirmNo}
        />
      ) : (
        <LeaveButton
          onClick={onLeave}
          disabled={false}
          label={tx.leave}
          loading={false}
          compact={isCompact}
          icon={<LogOut className="h-5 w-5" />}
          confirmTitle={tx.leaveConfirmTitle}
          confirmYes={tx.leaveConfirmYes}
          confirmNo={tx.leaveConfirmNo}
        />
      )}
    </div>
  )
}

type Variant = 'neutral' | 'brand' | 'alert'

function variantStyle(variant: Variant) {
  if (variant === 'brand') {
    return {
      background: VIDEO_THEME.brandTint20,
      color: VIDEO_THEME.brand,
      border: `1px solid ${VIDEO_THEME.brandTint30}`,
    }
  }
  if (variant === 'alert') {
    return {
      background: VIDEO_THEME.brand,
      color: '#fff',
      border: `1px solid ${VIDEO_THEME.brand}`,
    }
  }
  return {
    background: VIDEO_THEME.surface,
    color: '#fff',
    border: `1px solid ${VIDEO_THEME.border}`,
  }
}

function RoundButton({ tool }: { tool: Tool }) {
  const variant = tool.variant ?? 'neutral'
  return (
    <div className="group relative">
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={tool.onClick}
        className="relative flex h-11 w-11 items-center justify-center rounded-full transition-colors sm:h-12 sm:w-12"
        style={variantStyle(variant)}
        aria-pressed={tool.active}
        aria-label={tool.label}
      >
        {tool.icon}
        {tool.badge != null && tool.badge > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={{ background: VIDEO_THEME.brand, border: '2px solid rgba(10,12,15,1)' }}
          >
            {tool.badge > 9 ? '9+' : tool.badge}
          </span>
        )}
      </motion.button>
      {/* Hover tooltip — Meet-style, replaces the old permanent micro-labels. */}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:block"
        style={{ background: 'rgba(0,0,0,0.85)' }}
      >
        {tool.label}
      </span>
    </div>
  )
}

function MoreRow({ tool, onPick }: { tool: Tool; onPick: () => void }) {
  const isBrand = (tool.variant ?? 'neutral') === 'brand'
  return (
    <button
      role="menuitem"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.08]"
      style={{ color: isBrand ? VIDEO_THEME.brand : '#fff' }}
    >
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">{tool.icon}</span>
      <span className="text-[13px] font-medium">{tool.label}</span>
      {isBrand && (
        <span
          className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: VIDEO_THEME.brand }}
        />
      )}
    </button>
  )
}

function LeaveButton({
  onClick, disabled, label, loading, compact, icon, confirmTitle, confirmYes, confirmNo,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  loading: boolean
  compact: boolean
  icon?: React.ReactNode
  confirmTitle: string
  confirmYes: string
  confirmNo: string
}) {
  const [confirming, setConfirming] = useState(false)
  const hangup = icon ?? <PhoneOff className="h-5 w-5" />
  // On phones a single tap is too easy to hit by accident at the crowded bottom
  // bar (it would instantly disconnect → "kicked out"), so gate the leave behind
  // a quick confirm. Desktop keeps the deliberate one-tap leave.
  const handleClick = () => {
    if (compact && !confirming) { setConfirming(true); return }
    setConfirming(false)
    onClick()
  }
  return (
    <div className="group relative">
      {confirming && compact && (
        <>
          <button
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setConfirming(false)}
            className="fixed inset-0 z-40 cursor-default"
            style={{ background: 'transparent' }}
          />
          <div
            role="dialog"
            className="absolute bottom-full right-0 z-50 mb-3 w-52 rounded-2xl p-3 shadow-2xl"
            style={{ background: 'rgba(16,18,22,0.97)', border: `1px solid ${VIDEO_THEME.border}`, backdropFilter: 'blur(12px)' }}
          >
            <p className="mb-2.5 text-[13px] font-semibold text-white">{confirmTitle}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-medium text-white"
                style={{ background: VIDEO_THEME.surface, border: `1px solid ${VIDEO_THEME.border}` }}
              >
                {confirmNo}
              </button>
              <button
                onClick={() => { setConfirming(false); onClick() }}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white"
                style={{ background: VIDEO_THEME.brand }}
              >
                {confirmYes}
              </button>
            </div>
          </div>
        </>
      )}
      <motion.button
        whileHover={{ scale: disabled ? 1 : 1.04 }}
        whileTap={{ scale: disabled ? 1 : 0.96 }}
        onClick={handleClick}
        disabled={disabled}
        className={
          compact
            ? 'flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors disabled:opacity-60'
            : 'flex h-12 items-center gap-2 rounded-full px-5 text-white transition-colors disabled:opacity-60'
        }
        style={{ background: VIDEO_THEME.brand }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = VIDEO_THEME.brandHover }}
        onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = VIDEO_THEME.brand }}
        aria-label={label}
      >
        {loading ? (
          <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        ) : (
          hangup
        )}
        {!compact && <span className="text-[13px] font-semibold">{label}</span>}
      </motion.button>
      {compact && (
        <span
          className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:block"
          style={{ background: 'rgba(0,0,0,0.85)' }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

function Divider() {
  return <span className="mx-1 h-7 w-px flex-shrink-0" style={{ background: VIDEO_THEME.border }} />
}
