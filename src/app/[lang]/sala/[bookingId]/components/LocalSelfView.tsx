'use client'

import { VideoTrack } from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { VideoOff, X, Video } from 'lucide-react'
import { VIDEO_THEME } from '../theme'
import { Avatar } from './Avatar'
import type { Corner } from '../hooks/useSelfViewPosition'

interface Props {
  trackRef: TrackReference | undefined
  myName: string
  isCameraOff: boolean
  corner: Corner
  isDragging: boolean
  hideLabel: string
  onHide: () => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
}

const CORNER_POSITIONS: Record<Corner, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
}

// Floating picture-in-picture self-view. Draggable between the four stage
// corners; position + hidden state persist per-user in localStorage via
// useSelfViewPosition.
export function LocalSelfView({
  trackRef,
  myName,
  isCameraOff,
  corner,
  isDragging,
  hideLabel,
  onHide,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  return (
    <div
      className={`absolute w-44 h-28 rounded-xl overflow-hidden shadow-xl z-10 ${CORNER_POSITIONS[corner]} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        border: `2px solid ${VIDEO_THEME.border}`,
        touchAction: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.15s',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.35)' : '0 4px 12px rgba(0,0,0,0.2)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {trackRef ? (
        <VideoTrack trackRef={trackRef} className="w-full h-full object-cover pointer-events-none" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: VIDEO_THEME.stage }}
        >
          <Avatar name={myName} size="sm" />
        </div>
      )}
      {isCameraOff && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: VIDEO_THEME.stage }}
        >
          <VideoOff className="h-5 w-5" style={{ color: VIDEO_THEME.textSubtle }} />
        </div>
      )}
      <button
        data-selfview-action
        onClick={onHide}
        aria-label={hideLabel}
        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full text-white transition-opacity"
        style={{ background: 'rgba(0,0,0,0.55)' }}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

interface PillProps {
  label: string
  onShow: () => void
}

// Collapsed pill shown when self-view is hidden. Click to restore.
export function SelfViewPill({ label, onShow }: PillProps) {
  return (
    <button
      onClick={onShow}
      aria-label={label}
      className="absolute bottom-24 right-4 z-10 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-white shadow-lg transition-colors"
      style={{ background: VIDEO_THEME.brand }}
      onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
      onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
    >
      <Video className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}
