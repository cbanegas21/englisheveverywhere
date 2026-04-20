'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Sparkles, ChevronRight } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import type { SessionSummary } from '@/app/actions/video'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'

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
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: VIDEO_THEME.stage }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="max-w-lg w-full bg-white rounded-3xl p-8 shadow-2xl"
      >
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
            className="flex h-20 w-20 items-center justify-center rounded-3xl mx-auto mb-5 shadow-xl"
            style={{ background: VIDEO_THEME.brand, boxShadow: `0 20px 50px ${VIDEO_THEME.brandTint30}` }}
          >
            <CheckCircle2 className="h-10 w-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-black mb-1" style={{ color: '#111111' }}>{tx.sessionEnded}</h2>
          <p className="text-sm" style={{ color: '#4B5563' }}>
            {isTeacher ? tx.sessionEndedSub : tx.studentEndedSub}
          </p>
        </div>

        {isTeacher && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4" style={{ color: VIDEO_THEME.brand }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                {tx.aiSummary}
              </span>
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
          className="w-full py-3 rounded-xl text-white font-bold shadow-lg transition-all"
          style={{ background: VIDEO_THEME.brand, boxShadow: `0 12px 32px ${VIDEO_THEME.brandTint30}` }}
          onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
          onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
        >
          {tx.returnDashboard}
        </button>
      </motion.div>
    </div>
  )
}
