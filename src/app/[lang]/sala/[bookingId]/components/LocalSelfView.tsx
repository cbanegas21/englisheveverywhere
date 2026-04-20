'use client'

import { VideoTrack } from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { VideoOff } from 'lucide-react'
import { VIDEO_THEME } from '../theme'
import { Avatar } from './Avatar'

interface Props {
  trackRef: TrackReference | undefined
  myName: string
  isCameraOff: boolean
}

// Bottom-right picture-in-picture self-view. Phase B will make this
// draggable + persistable; for now it's fixed bottom-right.
export function LocalSelfView({ trackRef, myName, isCameraOff }: Props) {
  return (
    <div
      className="absolute bottom-4 right-4 w-44 h-28 rounded-xl overflow-hidden shadow-xl z-10"
      style={{ border: `2px solid ${VIDEO_THEME.border}` }}
    >
      {trackRef ? (
        <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
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
    </div>
  )
}
