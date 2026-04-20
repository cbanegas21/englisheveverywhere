'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle, Video, Mic, MicOff, VideoOff, PhoneOff, LogOut,
} from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { Avatar } from './Avatar'

interface Props {
  lang: Locale
  isTeacher: boolean
  myName: string
  otherName: string
  isLeaving: boolean
  onLeave: () => void
}

// Stub rendered when LiveKit credentials are missing. Matches the live-room
// visual language; controls are inert (no real tracks to toggle).
export function DevRoom({ lang, isTeacher, myName, otherName, isLeaving, onLeave }: Props) {
  const tx = videoStrings(lang)
  const [devIsMuted, setDevIsMuted] = useState(false)
  const [devIsCameraOff, setDevIsCameraOff] = useState(false)

  return (
    <div className="flex flex-col h-full" style={{ background: VIDEO_THEME.stage }}>
      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md px-6"
        >
          <div
            className="flex h-20 w-20 items-center justify-center rounded-3xl mx-auto mb-6 shadow-xl"
            style={{ background: VIDEO_THEME.brand, boxShadow: `0 20px 60px ${VIDEO_THEME.brandTint30}` }}
          >
            <Video className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">
            {tx.sessionWith} {otherName}
          </h2>
          <p className="text-sm mb-2" style={{ color: VIDEO_THEME.textMuted }}>{tx.waitingOther}</p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <AlertCircle className="h-4 w-4" style={{ color: VIDEO_THEME.brand }} />
            <p className="text-xs font-medium" style={{ color: VIDEO_THEME.brand }}>{tx.devMode}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
            <div
              className="aspect-video rounded-xl flex flex-col items-center justify-center"
              style={{ background: VIDEO_THEME.surface, border: `1px solid ${VIDEO_THEME.border}` }}
            >
              <div className="mb-1"><Avatar name={myName} size="sm" /></div>
              <span className="text-[10px]" style={{ color: VIDEO_THEME.textSubtle }}>{tx.you}</span>
            </div>
            <div
              className="aspect-video rounded-xl flex flex-col items-center justify-center"
              style={{ background: VIDEO_THEME.surface, border: `1px solid ${VIDEO_THEME.border}` }}
            >
              <div className="mb-1"><Avatar name={otherName} size="sm" /></div>
              <span className="text-[10px]" style={{ color: VIDEO_THEME.textSubtle }}>{otherName}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div
        className="flex items-center justify-center gap-4 py-5 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.40)', borderTop: `1px solid ${VIDEO_THEME.border}` }}
      >
        <DevButton
          onClick={() => setDevIsMuted(p => !p)}
          active={!devIsMuted}
          icon={devIsMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          label={devIsMuted ? tx.unmute : tx.mute}
          alert={devIsMuted}
        />
        <DevButton
          onClick={() => setDevIsCameraOff(p => !p)}
          active={!devIsCameraOff}
          icon={devIsCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          label={devIsCameraOff ? tx.startVideo : tx.stopVideo}
          alert={devIsCameraOff}
        />
        <motion.button
          whileHover={{ scale: isLeaving ? 1 : 1.05 }}
          whileTap={{ scale: isLeaving ? 1 : 0.95 }}
          onClick={onLeave}
          disabled={isLeaving}
          className="flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl text-white transition-colors disabled:opacity-60"
          style={{ background: VIDEO_THEME.brand }}
        >
          {isLeaving ? (
            <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : isTeacher ? (
            <PhoneOff className="h-5 w-5" />
          ) : (
            <LogOut className="h-5 w-5" />
          )}
          <span className="text-[9px] font-medium">
            {isLeaving ? tx.endingSession : isTeacher ? tx.endClass : tx.leave}
          </span>
        </motion.button>
      </div>
    </div>
  )
}

function DevButton({
  onClick, active, icon, label, alert,
}: {
  onClick: () => void
  active: boolean
  icon: React.ReactNode
  label: string
  alert: boolean
}) {
  const styles = alert
    ? {
        background: VIDEO_THEME.brandTint20,
        color: VIDEO_THEME.brand,
        border: `1px solid ${VIDEO_THEME.brandTint30}`,
      }
    : { background: VIDEO_THEME.surface, color: '#fff', border: 'none' }
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
      style={styles}
      aria-pressed={active}
    >
      {icon}
      <span className="text-[9px] font-medium">{label}</span>
    </motion.button>
  )
}
