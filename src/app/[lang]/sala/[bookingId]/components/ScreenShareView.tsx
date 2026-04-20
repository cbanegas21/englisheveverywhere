'use client'

import { VideoTrack } from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { MonitorUp } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'

interface Props {
  lang: Locale
  shareTrack: TrackReference
}

// Full-stage presenter view for an active screen share. Uses object-contain
// because shared screens rarely match the viewport aspect ratio.
export function ScreenShareView({ lang, shareTrack }: Props) {
  const tx = videoStrings(lang)
  const presenter = shareTrack.participant.name || shareTrack.participant.identity

  return (
    <div className="absolute inset-0" style={{ background: VIDEO_THEME.stage }}>
      <VideoTrack trackRef={shareTrack} className="w-full h-full object-contain" />
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white shadow-lg"
        style={{ background: 'rgba(0,0,0,0.65)' }}
      >
        <MonitorUp className="h-4 w-4" style={{ color: VIDEO_THEME.brand }} />
        <span>{tx.sharingPrefix} <strong>{presenter}</strong> {tx.sharingSuffix}</span>
      </div>
    </div>
  )
}
