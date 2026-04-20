'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, X } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { saveSessionNotes } from '@/app/actions/video'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'

interface Props {
  lang: Locale
  sessionId: string | null
  show: boolean
  onClose: () => void
}

export function NotesPanel({ lang, sessionId, show, onClose }: Props) {
  const tx = videoStrings(lang)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(true)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => clearTimeout(saveTimeoutRef.current)
  }, [])

  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesSaved(false)
    clearTimeout(saveTimeoutRef.current)
    if (!sessionId) return
    saveTimeoutRef.current = setTimeout(async () => {
      await saveSessionNotes(sessionId, value)
      setNotesSaved(true)
    }, 1500)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          className="fixed right-0 top-0 h-full w-80 z-30 flex flex-col"
          style={{
            background: VIDEO_THEME.stageOverlay,
            backdropFilter: 'blur(12px)',
            borderLeft: `1px solid ${VIDEO_THEME.border}`,
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: `1px solid ${VIDEO_THEME.border}` }}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: VIDEO_THEME.brand }} />
              <span className="text-[13px] font-bold text-white">{tx.notes}</span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-[10px]"
                style={{ color: notesSaved ? VIDEO_THEME.brand : VIDEO_THEME.textSubtle }}
              >
                {notesSaved ? tx.saved : tx.saving}
              </span>
              <button
                onClick={onClose}
                className="transition-colors hover:text-white"
                style={{ color: VIDEO_THEME.textSubtle }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <textarea
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder={tx.notesPlaceholder}
            className="flex-1 resize-none bg-transparent px-5 py-4 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none leading-relaxed"
          />
          <div className="px-5 py-3" style={{ borderTop: `1px solid ${VIDEO_THEME.border}` }}>
            <p className="text-[10px] leading-relaxed" style={{ color: VIDEO_THEME.textSubtle }}>
              {tx.notesHint}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
