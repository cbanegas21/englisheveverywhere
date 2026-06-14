'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import type { SessionSummary } from '@/app/actions/video'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { EKMark } from '@/components/ui/EKMark'

interface Props {
  lang: Locale
  isTeacher: boolean
  summary: SessionSummary | null
  isGenerating: boolean
  dashboardPath: string
}

export function EndedScreen({ lang, isTeacher, summary, isGenerating, dashboardPath }: Props) {
  const tx = videoStrings(lang)
  const router = useRouter()

  return (
    <div className="flex min-h-[100dvh] items-center justify-center overflow-y-auto px-4 py-8" style={{ background: VIDEO_THEME.stage }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="max-w-lg w-full bg-white rounded-3xl p-8 shadow-2xl"
      >
        <div className="text-center mb-6">
          <div className="mx-auto mb-5 flex justify-center">
            <EKMark size={44} bg="#111111" arrowColor={VIDEO_THEME.brand} />
          </div>
          <h2
            className="mb-1"
            style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 30, color: '#111111', letterSpacing: '-0.015em' }}
          >
            {tx.sessionEnded}
          </h2>
          <p className="text-sm" style={{ color: '#4B5563' }}>
            {isTeacher ? tx.sessionEndedSub : tx.studentEndedSub}
          </p>
        </div>

        {isTeacher && (
          <div className="mb-6">
            <div
              className="mb-4"
              style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9CA3AF' }}
            >
              {tx.aiSummary}
            </div>

            {isGenerating && !summary ? (
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: '#F3F4F6' }}>
                <span
                  className="h-5 w-5 rounded-full border-2 flex-shrink-0 animate-spin"
                  style={{ borderColor: VIDEO_THEME.brandTint30, borderTopColor: VIDEO_THEME.brand }}
                />
                <p className="text-sm" style={{ color: '#4B5563' }}>{tx.generatingSummary}</p>
              </div>
            ) : summary ? (
              <div className="space-y-4">
                {summary.covered.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>
                      {tx.covered}
                    </p>
                    <ul className="space-y-1.5">
                      {summary.covered.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#111111' }}>
                          <span
                            className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                            style={{ background: VIDEO_THEME.brand }}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.nextTopics.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>
                      {tx.nextTopics}
                    </p>
                    <ul className="space-y-1.5">
                      {summary.nextTopics.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#111111' }}>
                          <ChevronRight
                            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                            style={{ color: VIDEO_THEME.brand }}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.progressNote && (
                  <div className="rounded-xl p-4" style={{ background: '#F3F4F6' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9CA3AF' }}>
                      {tx.progressNote}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>{summary.progressNote}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl p-4 text-center" style={{ background: '#F3F4F6' }}>
                <p className="text-sm" style={{ color: '#9CA3AF' }}>{tx.noSummary}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => router.push(dashboardPath)}
          className="w-full rounded-full py-3 text-white transition-colors"
          style={{ background: VIDEO_THEME.brand, fontWeight: 600, fontSize: 15 }}
          onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
          onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
        >
          {tx.returnDashboard}
        </button>
      </motion.div>
    </div>
  )
}
