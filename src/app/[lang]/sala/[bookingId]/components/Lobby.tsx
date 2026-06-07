'use client'

import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { useCountdown } from '../hooks/useCountdown'
import { EKMark } from '@/components/ui/EKMark'

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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mb-6 flex justify-center">
          <EKMark size={44} bg="#F4EFE6" arrowColor={VIDEO_THEME.brand} />
        </div>

        <h2
          className="mb-2 text-white"
          style={{
            fontFamily: 'var(--ek-font-serif)',
            fontStyle: 'italic',
            fontSize: 34,
            lineHeight: 1.1,
            letterSpacing: '-0.015em',
          }}
        >
          {countdown.isLive ? tx.lobbyLive : tx.lobbyTitle}
        </h2>
        <p className="text-sm" style={{ color: VIDEO_THEME.textMuted }}>
          {tx.sessionWith} {otherName}
        </p>

        {!countdown.isLive && countdown.display && (
          <div className="mt-8">
            <div
              className="mb-2"
              style={{
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: VIDEO_THEME.textSubtle,
              }}
            >
              {tx.lobbyStartsIn}
            </div>
            <div
              className="text-white"
              style={{
                fontFamily: 'var(--ek-font-serif)',
                fontSize: 56,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.01em',
              }}
            >
              {countdown.display}
            </div>
          </div>
        )}

        <div className="mx-auto my-8 h-px w-10" style={{ background: VIDEO_THEME.border }} />

        <button
          onClick={onEnter}
          className="w-full rounded-full py-3.5 text-white transition-colors"
          style={{ background: VIDEO_THEME.brand, fontFamily: 'var(--ek-font-sans)', fontWeight: 600, fontSize: 15 }}
          onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
          onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
        >
          {tx.lobbyEnterNow}
        </button>
        <p className="mt-3 text-[11px]" style={{ color: VIDEO_THEME.textSubtle }}>{tx.lobbyHint}</p>
      </motion.div>
    </div>
  )
}
