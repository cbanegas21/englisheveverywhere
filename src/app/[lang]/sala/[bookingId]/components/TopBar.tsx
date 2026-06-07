'use client'

import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { useTimer } from '../hooks/useTimer'
import { EKMark } from '@/components/ui/EKMark'

interface Props {
  lang: Locale
  otherName: string
  scheduledAt: string
  durationMinutes: number
}

export function TopBar({ lang, otherName, scheduledAt, durationMinutes }: Props) {
  const tx = videoStrings(lang)
  const timeRemaining = useTimer(scheduledAt, durationMinutes)

  return (
    <div
      className="flex items-center justify-between px-6 py-3 backdrop-blur-sm z-10"
      style={{ background: 'rgba(0,0,0,0.30)', borderBottom: `1px solid ${VIDEO_THEME.border}` }}
    >
      <div className="flex items-center gap-3">
        <EKMark size={26} bg="#000" barColor="#F4EFE6" />
        <div className="leading-tight">
          <div
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: VIDEO_THEME.textSubtle,
            }}
          >
            {tx.sessionWith}
          </div>
          <div
            className="text-white"
            style={{ fontFamily: 'var(--ek-font-sans)', fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}
          >
            {otherName}
          </div>
        </div>
      </div>

      {timeRemaining && (
        <div className="flex items-baseline gap-2">
          <span
            className="text-white"
            style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          >
            {timeRemaining}
          </span>
          <span
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: VIDEO_THEME.textSubtle,
            }}
          >
            {tx.timeRemaining}
          </span>
        </div>
      )}
    </div>
  )
}
