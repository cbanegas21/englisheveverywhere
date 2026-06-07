'use client'

import { X } from 'lucide-react'
import { VIDEO_THEME } from '../theme'

// Shared header for the dark glass side panels (chat + notes) so they read as
// one family: same padding/rule, same title weight, one standardized close
// button. The cuaderno keeps its own editorial header (it's the cream
// counterpoint).
export function PanelHeader({
  title,
  onClose,
  closeLabel,
  right,
}: {
  title: string
  onClose: () => void
  closeLabel: string
  /** Optional trailing slot (e.g. the notes "saved" status). */
  right?: React.ReactNode
}) {
  return (
    <header
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: `1px solid ${VIDEO_THEME.border}` }}
    >
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="flex items-center gap-3">
        {right}
        <button
          onClick={onClose}
          aria-label={closeLabel}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
