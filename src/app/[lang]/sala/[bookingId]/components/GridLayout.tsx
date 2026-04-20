'use client'

import { VideoTrack } from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { VideoOff } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { Avatar } from './Avatar'

interface Props {
  lang: Locale
  remoteTrack: TrackReference | undefined
  localTrack: TrackReference | undefined
  myName: string
  otherName: string
  isCameraOff: boolean
}

// Two equal tiles side-by-side. Used when the user explicitly prefers the
// "side by side" layout (default remains speaker view).
export function GridLayout({
  lang,
  remoteTrack,
  localTrack,
  myName,
  otherName,
  isCameraOff,
}: Props) {
  return (
    <div
      className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 gap-2 p-2"
      style={{ background: VIDEO_THEME.stage }}
    >
      <Tile
        lang={lang}
        trackRef={remoteTrack}
        fallbackName={otherName}
      />
      <Tile
        lang={lang}
        trackRef={localTrack}
        fallbackName={myName}
        isLocal
        showCameraOffOverlay={isCameraOff}
      />
    </div>
  )
}

function Tile({
  lang,
  trackRef,
  fallbackName,
  isLocal,
  showCameraOffOverlay,
}: {
  lang: Locale
  trackRef: TrackReference | undefined
  fallbackName: string
  isLocal?: boolean
  showCameraOffOverlay?: boolean
}) {
  const tx = videoStrings(lang)
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{ background: VIDEO_THEME.surface }}
    >
      {trackRef ? (
        <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="mb-3">
            <Avatar name={fallbackName} size="lg" />
          </div>
          {!isLocal && (
            <p className="text-sm" style={{ color: VIDEO_THEME.textSubtle }}>{tx.waitingOther}</p>
          )}
        </div>
      )}
      {showCameraOffOverlay && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: VIDEO_THEME.stage }}
        >
          <VideoOff className="h-6 w-6" style={{ color: VIDEO_THEME.textSubtle }} />
        </div>
      )}
      <div
        className="absolute bottom-2 left-2 px-2 py-1 rounded text-[11px] font-medium text-white"
        style={{ background: 'rgba(0,0,0,0.55)' }}
      >
        {fallbackName}{isLocal ? ` · ${tx.you}` : ''}
      </div>
    </div>
  )
}
