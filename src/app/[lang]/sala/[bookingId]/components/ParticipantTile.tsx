'use client'

import { VideoTrack, useIsSpeaking, useIsMuted } from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { MicOff } from 'lucide-react'
import { VIDEO_THEME } from '../theme'

// A live participant's camera with the three Meet-class tile signals: an
// active-speaker ring, a persistent mute badge, and a premium name label.
// Only mounted when a camera TrackReference exists, so the LiveKit hooks always
// receive a real participant (no conditional-hook hazard).
export function ParticipantVideo({
  trackRef,
  name,
  youLabel,
  rounded = false,
  ring = true,
  bottomInset = 0,
}: {
  trackRef: TrackReference
  name: string
  youLabel?: string
  rounded?: boolean
  /** Show the active-speaker ring. Off for the full-stage speaker tile (a
   *  whole-screen ring reads oddly); on for side-by-side grid tiles. */
  ring?: boolean
  /** Lift the name label above the control bar (px). */
  bottomInset?: number
}) {
  const participant = trackRef.participant
  const isSpeaking = useIsSpeaking(participant)
  const isMicMuted = useIsMuted({ participant, source: Track.Source.Microphone })

  return (
    <div className={`relative h-full w-full overflow-hidden ${rounded ? 'rounded-xl' : ''}`}>
      <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
      {ring && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-150"
          style={{
            borderRadius: rounded ? 12 : 0,
            // Soft white — crimson is reserved for the "muted" badge, so the
            // speaking cue stays a distinct, non-conflicting neutral.
            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.92), inset 0 0 18px rgba(255,255,255,0.20)',
            opacity: isSpeaking && !isMicMuted ? 1 : 0,
          }}
        />
      )}
      <TileLabel name={name} muted={isMicMuted} youLabel={youLabel} bottomInset={bottomInset} />
    </div>
  )
}

// Shared name plate — premium glass over the old flat black pill. One source of
// truth for VideoTile, GridLayout, and the avatar/waiting fallbacks.
export function TileLabel({
  name,
  muted,
  youLabel,
  bottomInset = 0,
}: {
  name: string
  muted?: boolean
  youLabel?: string
  bottomInset?: number
}) {
  return (
    <div
      className="absolute left-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1 backdrop-blur-md"
      style={{ bottom: 8 + bottomInset, background: 'rgba(10,12,15,0.55)', border: `1px solid ${VIDEO_THEME.border}` }}
    >
      {muted && <MicOff className="h-3.5 w-3.5 flex-shrink-0" style={{ color: VIDEO_THEME.brand }} />}
      <span className="text-[13px] font-medium leading-none text-white">
        {name}{youLabel ? ` · ${youLabel}` : ''}
      </span>
    </div>
  )
}
