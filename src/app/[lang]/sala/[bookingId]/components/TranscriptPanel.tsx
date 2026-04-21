'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Radio } from 'lucide-react'
import { useLocalParticipant } from '@livekit/components-react'
import type { Locale } from '@/lib/i18n/translations'
import type { TranscriptLine } from '../hooks/useLiveTranscript'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'

interface Props {
  lang: Locale
  show: boolean
  onClose: () => void
  finals: TranscriptLine[]
  interims: Record<string, TranscriptLine>
  supported: boolean
  listening: boolean
}

export function TranscriptPanel({
  lang, show, onClose, finals, interims, supported, listening,
}: Props) {
  const tx = videoStrings(lang)
  const { localParticipant } = useLocalParticipant()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const interimLines = Object.values(interims)
  const totalCount = finals.length + interimLines.length

  useEffect(() => {
    if (!show) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [show, finals.length, interimLines.length])

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
          className="absolute top-0 bottom-0 right-0 z-30 w-[360px] flex flex-col"
          style={{ background: VIDEO_THEME.surface, borderLeft: `1px solid ${VIDEO_THEME.border}` }}
        >
          <header
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: `1px solid ${VIDEO_THEME.border}` }}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{tx.transcriptTitle}</h3>
              {supported && listening && (
                <span
                  className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: VIDEO_THEME.brandTint20, color: VIDEO_THEME.brand }}
                >
                  <Radio className="h-3 w-3 animate-pulse" />
                  {tx.transcriptListening}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label={tx.transcriptClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {!supported ? (
              <p className="text-xs text-center mt-8 px-4" style={{ color: VIDEO_THEME.textSubtle }}>
                {tx.transcriptUnsupported}
              </p>
            ) : totalCount === 0 ? (
              <p className="text-xs text-center mt-8 px-4" style={{ color: VIDEO_THEME.textSubtle }}>
                {tx.transcriptEmpty}
              </p>
            ) : (
              <>
                {finals.map(line => (
                  <TranscriptRow
                    key={line.id}
                    line={line}
                    isMine={line.identity === localParticipant.identity}
                    isFinal
                    lang={lang}
                  />
                ))}
                {interimLines.map(line => (
                  <TranscriptRow
                    key={`interim-${line.identity}`}
                    line={line}
                    isMine={line.identity === localParticipant.identity}
                    isFinal={false}
                    lang={lang}
                  />
                ))}
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function TranscriptRow({
  line, isMine, isFinal, lang,
}: {
  line: TranscriptLine
  isMine: boolean
  isFinal: boolean
  lang: Locale
}) {
  const timeLabel = new Date(line.timestamp).toLocaleTimeString(
    lang === 'es' ? 'es-HN' : 'en-US',
    { hour: '2-digit', minute: '2-digit' },
  )
  return (
    <div className="flex flex-col" style={{ opacity: isFinal ? 1 : 0.6 }}>
      <div className="flex items-baseline gap-2">
        <span
          className="text-[11px] font-semibold"
          style={{ color: isMine ? VIDEO_THEME.brand : '#fff' }}
        >
          {line.name}
        </span>
        <span className="text-[10px]" style={{ color: VIDEO_THEME.textSubtle }}>
          {timeLabel}
        </span>
      </div>
      <p
        className="text-[13px] leading-snug whitespace-pre-wrap break-words"
        style={{ color: isFinal ? '#fff' : VIDEO_THEME.textMuted, fontStyle: isFinal ? 'normal' : 'italic' }}
      >
        {line.text}
      </p>
    </div>
  )
}
