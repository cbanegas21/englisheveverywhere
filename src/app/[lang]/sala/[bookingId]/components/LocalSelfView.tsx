'use client'

import { VideoTrack } from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { VideoOff, X, Video } from 'lucide-react'
import { VIDEO_THEME } from '../theme'
import { Z } from '../zLayers'
import { Avatar } from './Avatar'
import type { Corner } from '../hooks/useSelfViewPosition'

interface Props {
  trackRef: TrackReference | undefined
  myName: string
  isCameraOff: boolean
  corner: Corner
  isDragging: boolean
  // px to inset from the right edge when a side panel (chat/notes) is open, so
  // the PiP rests left of the panel instead of behind it (CALL-01).
  rightInset: number
  // px to inset from the bottom edge (control-bar height) so a bottom corner
  // always clears the controls (CALL-08).
  bottomInset: number
  hideLabel: string
  onHide: () => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
}

const MARGIN = 16

// Resting position resolved from the corner, offset by any open right-side
// panel + the control-bar height. Lives in the React style prop; drag is a
// transform translate (see useSelfViewPosition) so the two never collide.
function cornerStyle(corner: Corner, rightInset: number, bottomInset: number): React.CSSProperties {
  const top = corner.startsWith('top')
  const left = corner.endsWith('left')
  return {
    top: top ? MARGIN : undefined,
    bottom: top ? undefined : MARGIN + bottomInset,
    left: left ? MARGIN : undefined,
    right: left ? undefined : MARGIN + rightInset,
  }
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
  rightInset,
  bottomInset,
  hideLabel,
  onHide,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  return (
    <div
      className={`absolute w-44 h-28 rounded-xl overflow-hidden shadow-xl ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        ...cornerStyle(corner, rightInset, bottomInset),
        zIndex: Z.selfView,
        border: `2px solid ${VIDEO_THEME.border}`,
        touchAction: 'none',
        transition: isDragging
          ? 'none'
          : 'top 0.2s ease, bottom 0.2s ease, left 0.2s ease, right 0.2s ease, box-shadow 0.15s',
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
  rightInset: number
  bottomInset: number
  onShow: () => void
}

// Collapsed pill shown when self-view is hidden. Click to restore. Sits in the
// bottom-right, clear of an open side panel + the control bar.
export function SelfViewPill({ label, rightInset, bottomInset, onShow }: PillProps) {
  return (
    <button
      onClick={onShow}
      aria-label={label}
      className="absolute flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-white shadow-lg transition-colors"
      style={{
        right: MARGIN + rightInset,
        bottom: MARGIN + bottomInset,
        zIndex: Z.selfView,
        background: VIDEO_THEME.brand,
        transition: 'right 0.2s ease, bottom 0.2s ease, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
      onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
    >
      <Video className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}
