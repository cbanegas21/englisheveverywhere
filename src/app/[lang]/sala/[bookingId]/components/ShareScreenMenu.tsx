'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MonitorUp, Volume2, Info } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { Z } from '../zLayers'

export interface ShareOptions {
  // Request system/tab audio with the screen (the Zoom-style "share sound" toggle).
  audio: boolean
  // contentHint: false → 'detail' (crisp slides/text), true → 'motion' (smooth video).
  motion: boolean
}

interface Props {
  lang: Locale
  show: boolean
  onClose: () => void
  onStart: (opts: ShareOptions) => void
}

// Pre-share menu, opened by the control bar's "Share screen" button. Mirrors the
// options Zoom surfaces before sharing — a Share-audio toggle and an
// optimize-for-content choice — then hands the chosen capture options up to
// RoomShell, which opens the browser's native picker. The native picker is the
// ONLY way to choose which screen/window/tab (browser security); this menu sets
// what we request around it and reminds the presenter to tick the audio box.
export function ShareScreenMenu({ lang, show, onClose, onStart }: Props) {
  const tx = videoStrings(lang)
  const [audio, setAudio] = useState(true)
  const [motion_, setMotion] = useState(false)
  const startRef = useRef<HTMLButtonElement>(null)

  // Escape closes; focus the primary action on open (keyboard / screen-reader).
  useEffect(() => {
    if (!show) return
    startRef.current?.focus()
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
            aria-label={tx.shareScreenTitle}
            className="absolute bottom-24 left-2 right-2 mx-auto w-auto max-w-[360px] max-h-[70vh] overflow-y-auto rounded-2xl shadow-2xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[360px]"
            style={{
              zIndex: Z.deviceMenu,
              background: 'rgba(18,20,24,0.98)',
              border: `1px solid ${VIDEO_THEME.border}`,
              backdropFilter: 'blur(8px)',
            }}
          >
            <header className="px-4 py-3" style={{ borderBottom: `1px solid ${VIDEO_THEME.border}` }}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <MonitorUp className="h-4 w-4" style={{ color: VIDEO_THEME.brand }} />
                {tx.shareScreenTitle}
              </h3>
            </header>

            <div className="px-3 py-3 space-y-3">
              {/* Share-audio toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={audio}
                onClick={() => setAudio(a => !a)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                style={{
                  background: audio ? VIDEO_THEME.brandTint20 : VIDEO_THEME.surface,
                  border: `1px solid ${audio ? VIDEO_THEME.brandTint30 : VIDEO_THEME.border}`,
                }}
              >
                <Volume2 className="h-5 w-5 flex-shrink-0" style={{ color: audio ? VIDEO_THEME.brand : VIDEO_THEME.textMuted }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-white">{tx.shareAudioLabel}</span>
                  <span className="block text-[11px] leading-snug" style={{ color: VIDEO_THEME.textMuted }}>{tx.shareAudioDesc}</span>
                </span>
                <Switch on={audio} />
              </button>

              {/* Optimize-for segmented control */}
              <div>
                <span id="ek-share-optimize-label" className="mb-1.5 block px-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: VIDEO_THEME.textMuted }}>
                  {tx.shareOptimize}
                </span>
                <div role="group" aria-labelledby="ek-share-optimize-label" className="grid grid-cols-2 gap-1.5">
                  <SegButton label={tx.shareOptimizeSlides} active={!motion_} onClick={() => setMotion(false)} />
                  <SegButton label={tx.shareOptimizeMotion} active={motion_} onClick={() => setMotion(true)} />
                </div>
              </div>

              {/* Picker tip — the audio checkbox is browser-enforced, we can't auto-tick it. */}
              <div
                className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                style={{ background: VIDEO_THEME.surface, border: `1px solid ${VIDEO_THEME.border}` }}
              >
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: VIDEO_THEME.textMuted }} />
                <p className="text-[11px] leading-snug" style={{ color: VIDEO_THEME.textMuted }}>{tx.sharePickerTip}</p>
              </div>
            </div>

            <footer className="flex gap-2 px-3 pb-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-medium text-white transition-colors"
                style={{ background: VIDEO_THEME.surface, border: `1px solid ${VIDEO_THEME.border}` }}
                onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.surfaceHover }}
                onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.surface }}
              >
                {tx.shareCancel}
              </button>
              <button
                ref={startRef}
                type="button"
                onClick={() => { onStart({ audio, motion: motion_ }); onClose() }}
                className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-colors"
                style={{ background: VIDEO_THEME.brand }}
                onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
                onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
              >
                <MonitorUp className="h-4 w-4" />
                {tx.shareStart}
              </button>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Pill-style on/off indicator for the audio toggle row (decorative — the whole
// row is the switch's hit target, so this stays aria-hidden).
function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors"
      style={{ background: on ? VIDEO_THEME.brand : 'rgba(255,255,255,0.18)' }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </span>
  )
}

function SegButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="rounded-lg px-2 py-2 text-[12px] font-medium text-white transition-colors"
      style={{
        background: active ? VIDEO_THEME.brandTint20 : VIDEO_THEME.surface,
        border: `1px solid ${active ? VIDEO_THEME.brandTint30 : VIDEO_THEME.border}`,
      }}
    >
      {label}
    </button>
  )
}
