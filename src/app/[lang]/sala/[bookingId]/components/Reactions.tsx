'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Hand } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { Z } from '../zLayers'

// Emoji set offered in the reactions popover (CALL-12).
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '👏', '🎉', '😮'] as const

export interface FloatingReaction {
  id: number
  emoji: string
}

export interface RemoteHand {
  raised: boolean
  name: string
}

// Popover above the control bar: a raise-hand toggle (CALL-11) + an emoji row
// (CALL-12), Google-Meet style. Reuses the device-menu layering.
export function ReactionsPopover({
  lang, show, onClose, handRaised, onToggleHand, onReact,
}: {
  lang: Locale
  show: boolean
  onClose: () => void
  handRaised: boolean
  onToggleHand: () => void
  onReact: (emoji: string) => void
}) {
  const tx = videoStrings(lang)

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, onClose])

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ zIndex: Z.deviceMenu }}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-label={tx.reactions}
            className="absolute left-1/2 -translate-x-1/2 rounded-2xl shadow-2xl px-3 py-3"
            style={{
              bottom: 'calc(7rem + env(safe-area-inset-bottom))',
              zIndex: Z.deviceMenu,
              background: 'rgba(18,20,24,0.98)',
              border: `1px solid ${VIDEO_THEME.border}`,
              backdropFilter: 'blur(8px)',
            }}
          >
            <button
              onClick={onToggleHand}
              aria-pressed={handRaised}
              aria-label={handRaised ? tx.lowerHand : tx.raiseHand}
              className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors"
              style={handRaised
                ? { background: VIDEO_THEME.brandTint20, color: VIDEO_THEME.brand, border: `1px solid ${VIDEO_THEME.brandTint30}` }
                : { background: VIDEO_THEME.surface, color: '#fff', border: '1px solid transparent' }}
            >
              <Hand className="h-4 w-4" />
              {handRaised ? tx.lowerHand : tx.raiseHand}
            </button>
            <div className="flex items-center gap-1">
              {REACTION_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => onReact(e)}
                  aria-label={e}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-transform hover:scale-110"
                  style={{ background: VIDEO_THEME.surface }}
                >
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Over-the-stage layer: a top-center hand-raise pill + floating emoji reactions
// that rise and fade. Shown to both peers.
export function ReactionsLayer({
  lang, floating, localHandRaised, remoteHand,
}: {
  lang: Locale
  floating: FloatingReaction[]
  localHandRaised: boolean
  remoteHand: RemoteHand
}) {
  const tx = videoStrings(lang)
  const hands: string[] = []
  if (remoteHand.raised) hands.push(remoteHand.name)
  if (localHandRaised) hands.push(tx.you)

  return (
    <>
      <AnimatePresence>
        {hands.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-white shadow-lg"
            style={{ zIndex: Z.selfView, background: VIDEO_THEME.brand }}
          >
            <Hand className="h-4 w-4" />
            <span>{hands.join(', ')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute bottom-32 left-1/2 -translate-x-1/2" style={{ zIndex: Z.selfView }}>
        <AnimatePresence>
          {floating.map(f => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: 1, y: -150, scale: 1.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2, ease: 'easeOut' }}
              className="absolute text-4xl"
              // Spread concurrent reactions horizontally so they don't stack.
              style={{ left: ((f.id % 5) - 2) * 26 }}
            >
              {f.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
