'use client'

import { VideoTrack } from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { Avatar } from './Avatar'

interface Props {
  lang: Locale
  trackRef: TrackReference | undefined
  fallbackName: string
}

// Full-stage remote participant. Shows VideoTrack when published,
// otherwise a neutral avatar with a "waiting" hint.
export function VideoTile({ lang, trackRef, fallbackName }: Props) {
  const tx = videoStrings(lang)
  return (
    <div className="absolute inset-0" style={{ background: VIDEO_THEME.stage }}>
      {trackRef ? (
        <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="mb-3">
            <Avatar name={fallbackName} size="lg" />
          </div>
          <p className="text-sm" style={{ color: VIDEO_THEME.textSubtle }}>{tx.waitingOther}</p>
        </div>
      )}
    </div>
  )
}
