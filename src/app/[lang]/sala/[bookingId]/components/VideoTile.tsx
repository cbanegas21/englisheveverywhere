'use client'

import type { TrackReference } from '@livekit/components-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { Avatar } from './Avatar'
import { ParticipantVideo } from './ParticipantTile'

interface Props {
  lang: Locale
  trackRef: TrackReference | undefined
  fallbackName: string
  /** Control-bar height, so the name label clears the overlaid controls. */
  bottomInset?: number
}

// Full-stage remote participant. Shows the video (with name + mute badge) when
// published, otherwise a warm avatar with a "waiting" hint.
export function VideoTile({ lang, trackRef, fallbackName, bottomInset = 0 }: Props) {
  const tx = videoStrings(lang)
  return (
    <div className="absolute inset-0" style={{ background: VIDEO_THEME.stage }}>
      {trackRef ? (
        <ParticipantVideo trackRef={trackRef} name={fallbackName} ring={false} bottomInset={bottomInset} />
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
