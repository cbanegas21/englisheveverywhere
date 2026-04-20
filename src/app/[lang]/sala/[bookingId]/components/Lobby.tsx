'use client'

import { motion } from 'framer-motion'
import { Video } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { useCountdown } from '../hooks/useCountdown'

interface Props {
  lang: Locale
  otherName: string
  scheduledAt: string
  onEnter: () => void
}

export function Lobby({ lang, otherName, scheduledAt, onEnter }: Props) {
  const tx = videoStrings(lang)
  const countdown = useCountdown(scheduledAt)

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-6"
      style={{ background: VIDEO_THEME.stage }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="text-center max-w-md w-full"
      >
        <div
          className="flex h-20 w-20 items-center justify-center rounded-3xl mx-auto mb-6 shadow-2xl"
          style={{ background: VIDEO_THEME.brand, boxShadow: `0 20px 60px ${VIDEO_THEME.brandTint30}` }}
        >
          <Video className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-2xl font-black text-white mb-1">
          {countdown.isLive ? tx.lobbyLive : tx.lobbyTitle}
        </h2>
        <p className="text-sm mb-6" style={{ color: VIDEO_THEME.textMuted }}>
          {tx.sessionWith} {otherName}
        </p>

        {!countdown.isLive && countdown.display && (
          <div className="mb-8">
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-2"
              style={{ color: VIDEO_THEME.textSubtle }}
            >
              {tx.lobbyStartsIn}
            </p>
            <div className="font-mono text-5xl font-black tabular-nums text-white">
              {countdown.display}
            </div>
          </div>
        )}

        <button
          onClick={onEnter}
          className="w-full py-3.5 rounded-xl text-white font-bold shadow-lg transition-all"
          style={{ background: VIDEO_THEME.brand, boxShadow: `0 12px 32px ${VIDEO_THEME.brandTint30}` }}
          onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
          onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
        >
          {tx.lobbyEnterNow}
        </button>
        <p className="text-[11px] mt-3" style={{ color: VIDEO_THEME.textSubtle }}>{tx.lobbyHint}</p>
      </motion.div>
    </div>
  )
}
