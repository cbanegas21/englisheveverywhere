'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Mic, Video, Volume2, Check } from 'lucide-react'
import { useMediaDeviceSelect } from '@livekit/components-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'

interface Props {
  lang: Locale
  show: boolean
  onClose: () => void
}

// Device picker popover. Lists mic / camera / speaker options via
// useMediaDeviceSelect. setActiveMediaDevice hot-swaps devices without a
// reconnect, mirroring Zoom's behavior.
export function DeviceMenu({ lang, show, onClose }: Props) {
  const tx = videoStrings(lang)
  const mic = useMediaDeviceSelect({ kind: 'audioinput' })
  const cam = useMediaDeviceSelect({ kind: 'videoinput' })
  const spk = useMediaDeviceSelect({ kind: 'audiooutput' })

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
            className="absolute inset-0 z-20"
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-label={tx.deviceSettings}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 w-[340px] max-h-[60vh] overflow-y-auto rounded-2xl shadow-2xl"
            style={{
              background: 'rgba(18,20,24,0.98)',
              border: `1px solid ${VIDEO_THEME.border}`,
              backdropFilter: 'blur(8px)',
            }}
          >
            <header className="px-4 py-3" style={{ borderBottom: `1px solid ${VIDEO_THEME.border}` }}>
              <h3 className="text-sm font-semibold text-white">{tx.deviceSettings}</h3>
            </header>

            <DeviceSection
              title={tx.microphone}
              icon={<Mic className="h-4 w-4" />}
              devices={mic.devices}
              activeId={mic.activeDeviceId}
              onPick={id => { void mic.setActiveMediaDevice(id) }}
              emptyLabel={tx.noDevices}
            />
            <DeviceSection
              title={tx.camera}
              icon={<Video className="h-4 w-4" />}
              devices={cam.devices}
              activeId={cam.activeDeviceId}
              onPick={id => { void cam.setActiveMediaDevice(id) }}
              emptyLabel={tx.noDevices}
            />
            {spk.devices.length > 0 && (
              <DeviceSection
                title={tx.speaker}
                icon={<Volume2 className="h-4 w-4" />}
                devices={spk.devices}
                activeId={spk.activeDeviceId}
                onPick={id => { void spk.setActiveMediaDevice(id) }}
                emptyLabel={tx.noDevices}
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function DeviceSection({
  title, icon, devices, activeId, onPick, emptyLabel,
}: {
  title: string
  icon: React.ReactNode
  devices: MediaDeviceInfo[]
  activeId: string
  onPick: (id: string) => void
  emptyLabel: string
}) {
  return (
    <section className="px-2 py-2">
      <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: VIDEO_THEME.textMuted }}>
        {icon}
        <span>{title}</span>
      </div>
      {devices.length === 0 ? (
        <p className="px-2 py-2 text-xs" style={{ color: VIDEO_THEME.textSubtle }}>{emptyLabel}</p>
      ) : (
        <ul className="space-y-0.5">
          {devices.map(d => {
            const active = d.deviceId === activeId
            return (
              <li key={d.deviceId}>
                <button
                  type="button"
                  onClick={() => onPick(d.deviceId)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-white transition-colors"
                  style={{
                    background: active ? VIDEO_THEME.brandTint20 : 'transparent',
                    border: active ? `1px solid ${VIDEO_THEME.brandTint30}` : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = VIDEO_THEME.surfaceHover }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span className="flex-1 truncate">{d.label || d.deviceId}</span>
                  {active && <Check className="h-4 w-4 shrink-0" style={{ color: VIDEO_THEME.brand }} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
