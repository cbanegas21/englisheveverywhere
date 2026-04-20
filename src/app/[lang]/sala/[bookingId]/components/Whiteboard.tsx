'use client'

import { useCallback, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useDataChannel } from '@livekit/components-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import type { Editor, HistoryEntry, TLRecord } from 'tldraw'
import 'tldraw/tldraw.css'

// tldraw drags in ~1MB — keep it out of the initial room bundle.
const Tldraw = dynamic(() => import('tldraw').then(m => m.Tldraw), {
  ssr: false,
  loading: () => <BoardLoader />,
})

interface Props {
  lang: Locale
  bookingId: string
  show: boolean
  onClose: () => void
}

type WireChanges = {
  added: Record<string, TLRecord>
  updated: Record<string, [TLRecord, TLRecord]>
  removed: Record<string, TLRecord>
}

// Collaborative whiteboard. Covers the video stage as an overlay (like a
// screen share). Uses LiveKit data channel with topic 'whiteboard' to sync
// per-record changes between teacher and student.
//
// Sync model: listen for user-source changes locally → send the diff;
// on remote diff arrival, apply via mergeRemoteChanges so it doesn't echo
// back out. Late joiners see a blank board (MVP) — persisted locally via
// persistenceKey for recovery after a reload.
export function Whiteboard({ lang, bookingId, show, onClose }: Props) {
  const tx = videoStrings(lang)
  const editorRef = useRef<Editor | null>(null)
  const [ready, setReady] = useState(false)

  const { send } = useDataChannel('whiteboard', msg => {
    const editor = editorRef.current
    if (!editor) return
    try {
      const decoded = new TextDecoder().decode(msg.payload)
      const changes = JSON.parse(decoded) as WireChanges
      applyRemoteChanges(editor, changes)
    } catch { /* ignore malformed frames */ }
  })

  const onMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    setReady(true)
    editor.store.listen(
      (entry: HistoryEntry<TLRecord>) => {
        if (entry.source !== 'user') return
        const payload = new TextEncoder().encode(JSON.stringify(entry.changes))
        void send(payload, { topic: 'whiteboard', reliable: true })
      },
      { scope: 'document', source: 'user' },
    )
  }, [send])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 z-30"
          style={{ background: VIDEO_THEME.stage }}
        >
          <div className="absolute inset-0 pt-14">
            <Tldraw
              persistenceKey={`ee-sala-${bookingId}`}
              onMount={onMount}
              inferDarkMode
            />
          </div>
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2.5 z-10"
            style={{ background: 'rgba(0,0,0,0.75)', borderBottom: `1px solid ${VIDEO_THEME.border}` }}
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: VIDEO_THEME.brand }} />
              <h3 className="text-sm font-semibold text-white">{tx.whiteboardTitle}</h3>
              {!ready && (
                <span className="text-[11px]" style={{ color: VIDEO_THEME.textSubtle }}>{tx.whiteboardLoading}</span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label={tx.whiteboardClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function applyRemoteChanges(editor: Editor, changes: WireChanges) {
  editor.store.mergeRemoteChanges(() => {
    const toPut: TLRecord[] = []
    for (const rec of Object.values(changes.added)) toPut.push(rec)
    for (const pair of Object.values(changes.updated)) toPut.push(pair[1])
    if (toPut.length) editor.store.put(toPut)
    const toRemove = Object.keys(changes.removed)
    if (toRemove.length) editor.store.remove(toRemove as TLRecord['id'][])
  })
}

function BoardLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: VIDEO_THEME.stage }}>
      <span
        className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin"
        aria-hidden
      />
    </div>
  )
}
