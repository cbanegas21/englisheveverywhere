'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Send } from 'lucide-react'
import { useLocalParticipant } from '@livekit/components-react'
import type { ReceivedChatMessage } from '@livekit/components-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'

interface Props {
  lang: Locale
  show: boolean
  onClose: () => void
  chatMessages: ReceivedChatMessage[]
  send: (message: string) => Promise<ReceivedChatMessage>
  isSending: boolean
}

export function ChatPanel({ lang, show, onClose, chatMessages, send, isSending }: Props) {
  const tx = videoStrings(lang)
  const { localParticipant } = useLocalParticipant()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!show) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [show, chatMessages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || isSending) return
    try {
      await send(trimmed)
      setDraft('')
    } catch { /* silent — a failed send shouldn't crash the room */ }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e as unknown as React.FormEvent)
    }
  }

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
            <h3 className="text-sm font-semibold text-white">{tx.chatTitle}</h3>
            <button
              onClick={onClose}
              aria-label={tx.chatClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 ? (
              <p className="text-xs text-center mt-8" style={{ color: VIDEO_THEME.textSubtle }}>
                {tx.chatEmpty}
              </p>
            ) : (
              chatMessages.map(msg => {
                const mine = msg.from?.identity === localParticipant.identity
                const fromName = msg.from?.name || msg.from?.identity || '—'
                return (
                  <div key={`${msg.timestamp}-${msg.from?.identity ?? 'x'}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 ${mine ? 'text-white' : ''}`}
                      style={{
                        background: mine ? VIDEO_THEME.brand : '#F3F4F6',
                        color: mine ? '#fff' : '#111',
                      }}
                    >
                      {!mine && (
                        <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#6B7280' }}>{fromName}</p>
                      )}
                      <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">{msg.message}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">
                        {new Date(msg.timestamp).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <form
            onSubmit={handleSend}
            className="flex items-end gap-2 px-3 py-3"
            style={{ borderTop: `1px solid ${VIDEO_THEME.border}` }}
          >
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={tx.chatPlaceholder}
              rows={1}
              className="flex-1 resize-none rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/40 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${VIDEO_THEME.border}`, maxHeight: 120 }}
            />
            <button
              type="submit"
              disabled={!draft.trim() || isSending}
              aria-label={tx.chatSend}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-50"
              style={{ background: VIDEO_THEME.brand }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
