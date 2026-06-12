'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'
import { saveSessionNotes } from '@/app/actions/video'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { PanelHeader } from './PanelHeader'

interface Props {
  lang: Locale
  sessionId: string | null
  show: boolean
  onClose: () => void
  // px to leave clear at the bottom (control-bar height) so the panel never
  // covers the Leave / settings controls (CALL-01).
  bottomInset: number
}

export function NotesPanel({ lang, sessionId, show, onClose, bottomInset }: Props) {
  const tx = videoStrings(lang)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(true)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Track the latest value + dirty state in refs so the unmount cleanup can flush
  // unsaved edits — clicking "End Class" unmounts this panel before the 1.5s
  // debounce fires, which otherwise silently drops the last-typed notes (shared
  // with the student after class).
  const latestRef = useRef('')
  const dirtyRef = useRef(false)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  useEffect(() => {
    return () => {
      clearTimeout(saveTimeoutRef.current)
      if (dirtyRef.current && sessionIdRef.current) {
        // Best-effort final save — the request is sent even as the panel unmounts.
        void saveSessionNotes(sessionIdRef.current, latestRef.current).catch(() => {})
      }
    }
  }, [])

  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesSaved(false)
    latestRef.current = value
    dirtyRef.current = true
    clearTimeout(saveTimeoutRef.current)
    if (!sessionId) return
    saveTimeoutRef.current = setTimeout(async () => {
      await saveSessionNotes(sessionId, value)
      dirtyRef.current = false
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
          className="fixed right-0 top-0 w-80 z-30 flex flex-col"
          style={{
            bottom: bottomInset,
            background: VIDEO_THEME.panelGlass,
            backdropFilter: 'blur(12px)',
            borderLeft: `1px solid ${VIDEO_THEME.border}`,
          }}
        >
          <PanelHeader
            title={tx.notes}
            onClose={onClose}
            closeLabel={tx.close}
            right={
              <span
                className="text-[10px]"
                style={{ color: notesSaved ? VIDEO_THEME.brand : VIDEO_THEME.textSubtle }}
              >
                {notesSaved ? tx.saved : tx.saving}
              </span>
            }
          />
          <textarea
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder={tx.notesPlaceholder}
            className="flex-1 resize-none bg-transparent px-4 py-4 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none leading-relaxed"
          />
          <div className="px-4 py-3" style={{ borderTop: `1px solid ${VIDEO_THEME.border}` }}>
            <p className="text-[10px] leading-relaxed" style={{ color: VIDEO_THEME.textSubtle }}>
              {tx.notesHint}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
