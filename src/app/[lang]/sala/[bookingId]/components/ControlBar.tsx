'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Video, VideoOff, PhoneOff, FileText, LogOut, LayoutGrid, Maximize2 } from 'lucide-react'
import { useLocalParticipant } from '@livekit/components-react'
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
}: Props) {
  const tx = videoStrings(lang)
  const { localParticipant } = useLocalParticipant()
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)

  function toggleMute() {
    localParticipant.setMicrophoneEnabled(isMuted)
    setIsMuted(p => !p)
  }

  function toggleCamera() {
    const next = !isCameraOff
    localParticipant.setCameraEnabled(!next)
    setIsCameraOff(next)
    onCameraOffChange?.(next)
  }

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 py-5 backdrop-blur-sm z-20"
      style={{ background: 'rgba(0,0,0,0.60)', borderTop: `1px solid ${VIDEO_THEME.border}` }}
    >
      <CircleButton
        active={!isMuted}
        onClick={toggleMute}
        label={isMuted ? tx.unmute : tx.mute}
        icon={isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        variant={isMuted ? 'alert' : 'neutral'}
      />
      <CircleButton
        active={!isCameraOff}
        onClick={toggleCamera}
        label={isCameraOff ? tx.startVideo : tx.stopVideo}
        icon={isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        variant={isCameraOff ? 'alert' : 'neutral'}
      />
      <CircleButton
        active={layoutMode === 'grid'}
        onClick={onToggleLayout}
        label={layoutMode === 'grid' ? tx.layoutSpeaker : tx.layoutGrid}
        icon={layoutMode === 'grid' ? <Maximize2 className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
        variant="neutral"
      />
      {isTeacher && (
        <CircleButton
          active={showNotes}
          onClick={onToggleNotes}
          label={tx.notes}
          icon={<FileText className="h-5 w-5" />}
          variant={showNotes ? 'brand' : 'neutral'}
        />
      )}
      {isTeacher ? (
        <LeaveButton
          onClick={onLeave}
          disabled={isLeaving}
          label={isLeaving ? tx.endingSession : tx.endClass}
          loading={isLeaving}
          icon={<PhoneOff className="h-5 w-5" />}
        />
      ) : (
        <CircleButton
          active
          onClick={onLeave}
          label={tx.leave}
          icon={<LogOut className="h-5 w-5" />}
          variant="neutral"
        />
      )}
    </div>
  )
}

type Variant = 'neutral' | 'brand' | 'alert'

function CircleButton({
  active, onClick, label, icon, variant,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
  variant: Variant
}) {
  const styles =
    variant === 'brand'
      ? {
          background: VIDEO_THEME.brandTint20,
          color: VIDEO_THEME.brand,
          border: `1px solid ${VIDEO_THEME.brandTint30}`,
        }
      : variant === 'alert'
        ? {
            background: VIDEO_THEME.brandTint20,
            color: VIDEO_THEME.brand,
            border: `1px solid ${VIDEO_THEME.brandTint30}`,
          }
        : {
            background: VIDEO_THEME.surface,
            color: '#fff',
            border: 'none',
          }
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
      style={styles}
      aria-pressed={active}
      aria-label={label}
    >
      {icon}
      <span className="text-[9px] font-medium">{label}</span>
    </motion.button>
  )
}

function LeaveButton({
  onClick, disabled, label, loading, icon,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  loading: boolean
  icon: React.ReactNode
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl text-white transition-colors disabled:opacity-60"
      style={{ background: VIDEO_THEME.brand }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = VIDEO_THEME.brandHover }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = VIDEO_THEME.brand }}
      aria-label={label}
    >
      {loading ? (
        <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      ) : (
        icon
      )}
      <span className="text-[9px] font-medium">{label}</span>
    </motion.button>
  )
}
