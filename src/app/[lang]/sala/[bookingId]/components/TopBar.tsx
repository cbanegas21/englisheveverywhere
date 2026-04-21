'use client'

import { Clock, Users } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { useTimer } from '../hooks/useTimer'

interface Props {
  lang: Locale
  isTeacher: boolean
  myName: string
  otherName: string
  scheduledAt: string
  durationMinutes: number
}

export function TopBar({ lang, isTeacher, myName, otherName, scheduledAt, durationMinutes }: Props) {
  const tx = videoStrings(lang)
  const timeRemaining = useTimer(scheduledAt, durationMinutes)

  return (
    <div
      className="flex items-center justify-between px-6 py-3 backdrop-blur-sm z-10"
      style={{ background: 'rgba(0,0,0,0.30)', borderBottom: `1px solid ${VIDEO_THEME.border}` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg shadow-md"
          style={{ background: VIDEO_THEME.brand, boxShadow: `0 4px 16px ${VIDEO_THEME.brandTint30}` }}
        >
          <span className="text-[10px] font-black text-white">EK</span>
        </div>
        <div>
          <div className="text-xs font-bold text-white">
            {tx.sessionWith} {otherName}
          </div>
          <div className="text-[10px]" style={{ color: VIDEO_THEME.textSubtle }}>
            {isTeacher ? tx.teacher : tx.student}: {myName}
          </div>
        </div>
      </div>

      {timeRemaining && (
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ background: VIDEO_THEME.surface }}
        >
          <Clock className="h-3.5 w-3.5" style={{ color: VIDEO_THEME.brand }} />
          <span className="text-sm font-mono font-bold text-white">{timeRemaining}</span>
          <span className="text-[10px]" style={{ color: VIDEO_THEME.textSubtle }}>
            {tx.timeRemaining}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs" style={{ color: VIDEO_THEME.textSubtle }}>
        <Users className="h-3.5 w-3.5" />
        <span>2</span>
      </div>
    </div>
  )
}
