'use client'

import { VideoTrack } from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { VideoOff, X, Video, Minus, Plus } from 'lucide-react'
import { VIDEO_THEME } from '../theme'
import { Z } from '../zLayers'
import { Avatar } from './Avatar'
import type { Corner, SelfViewSize } from '../hooks/useSelfViewPosition'

interface Props {
  trackRef: TrackReference | undefined
  myName: string
  isCameraOff: boolean
  corner: Corner
  isDragging: boolean
  size: SelfViewSize
  // On phones there's no hover and the tile is clamped small, so the resize +/-
  // controls are dropped and the close button is enlarged + always visible.
  isCompact?: boolean
  // px to inset from the right edge when a side panel (chat/notes) is open, so
  // the PiP rests left of the panel instead of behind it (CALL-01).
  rightInset: number
  // px to inset from the bottom edge (control-bar height) so a bottom corner
  // always clears the controls (CALL-08).
  bottomInset: number
  hideLabel: string
  shrinkLabel: string
  enlargeLabel: string
  onHide: () => void
  onShrink: () => void
  onEnlarge: () => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
}

const MARGIN = 16

// Self-view dimensions per size step (CALL-09). Keeps the ~11:7 tile ratio.
const SIZES: Record<SelfViewSize, { w: number; h: number }> = {
  sm: { w: 128, h: 82 },
  md: { w: 176, h: 112 },
  lg: { w: 232, h: 148 },
}

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

const ctrlClass =
  'flex h-6 w-6 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40'
const ctrlStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.55)' }

// Floating picture-in-picture self-view. Draggable between the four stage
// corners; position, hidden state, and size persist per-user in localStorage
// via useSelfViewPosition.
export function LocalSelfView({
  trackRef,
  myName,
  isCameraOff,
  corner,
  isDragging,
  size,
  isCompact = false,
  rightInset,
  bottomInset,
  hideLabel,
  shrinkLabel,
  enlargeLabel,
  onHide,
  onShrink,
  onEnlarge,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  const dims = SIZES[size]
  return (
    <div
      className={`group absolute rounded-xl overflow-hidden shadow-xl ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        ...cornerStyle(corner, rightInset, bottomInset),
        width: dims.w,
        height: dims.h,
        zIndex: Z.selfView,
        border: `2px solid ${VIDEO_THEME.border}`,
        touchAction: 'none',
        transition: isDragging
          ? 'none'
          : 'top 0.2s ease, bottom 0.2s ease, left 0.2s ease, right 0.2s ease, width 0.15s ease, height 0.15s ease, box-shadow 0.15s',
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
      {/* Resize controls — hover-revealed on desktop; dropped on phones where the
          tile is clamped to its small size and there is no hover. */}
      {!isCompact && (
        <div
          data-selfview-action
          className="absolute top-1 left-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <button
            data-selfview-action
            onClick={onShrink}
            disabled={size === 'sm'}
            aria-label={shrinkLabel}
            className={ctrlClass}
            style={ctrlStyle}
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            data-selfview-action
            onClick={onEnlarge}
            disabled={size === 'lg'}
            aria-label={enlargeLabel}
            className={ctrlClass}
            style={ctrlStyle}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      )}
      <button
        data-selfview-action
        onClick={onHide}
        aria-label={hideLabel}
        className={`absolute right-1 top-1 flex items-center justify-center rounded-full text-white transition-opacity ${isCompact ? 'h-7 w-7' : 'h-6 w-6'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
      >
        <X className={isCompact ? 'h-4 w-4' : 'h-3 w-3'} />
      </button>
    </div>
  )
}

interface PillProps {
  label: string
  rightInset: number
  bottomInset: number
  /** Which bottom corner to dock in — lets a second (remote) pill sit clear of
   *  the local one (CALL-10). Defaults to right. */
  side?: 'left' | 'right'
  onShow: () => void
}

// Collapsed pill shown when a camera is hidden. Click to restore. Docks in a
// bottom corner, clear of an open side panel + the control bar.
export function SelfViewPill({ label, rightInset, bottomInset, side = 'right', onShow }: PillProps) {
  const horizontal = side === 'left' ? { left: MARGIN } : { right: MARGIN + rightInset }
  return (
    <button
      onClick={onShow}
      aria-label={label}
      className="absolute flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-white shadow-lg transition-colors"
      style={{
        ...horizontal,
        bottom: MARGIN + bottomInset,
        zIndex: Z.selfView,
        background: VIDEO_THEME.brand,
        transition: 'right 0.2s ease, left 0.2s ease, bottom 0.2s ease, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
      onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
    >
      <Video className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}
