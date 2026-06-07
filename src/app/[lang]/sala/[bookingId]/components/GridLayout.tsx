'use client'

import type { TrackReference } from '@livekit/components-react'
import { VideoOff } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { Avatar } from './Avatar'
import { ParticipantVideo, TileLabel } from './ParticipantTile'

interface Props {
  lang: Locale
  remoteTrack: TrackReference | undefined
  localTrack: TrackReference | undefined
  myName: string
  otherName: string
  isCameraOff: boolean
  /** Control-bar height, so tile labels clear the overlaid controls. */
  bottomInset?: number
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
  bottomInset = 0,
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
        bottomInset={bottomInset}
      />
      <Tile
        lang={lang}
        trackRef={localTrack}
        fallbackName={myName}
        isLocal
        showCameraOffOverlay={isCameraOff}
        bottomInset={bottomInset}
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
  bottomInset = 0,
}: {
  lang: Locale
  trackRef: TrackReference | undefined
  fallbackName: string
  isLocal?: boolean
  showCameraOffOverlay?: boolean
  bottomInset?: number
}) {
  const tx = videoStrings(lang)
  const youLabel = isLocal ? tx.you : undefined
  const showVideo = trackRef && !showCameraOffOverlay
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{ background: VIDEO_THEME.surface }}
    >
      {showVideo ? (
        <ParticipantVideo trackRef={trackRef} name={fallbackName} youLabel={youLabel} rounded bottomInset={bottomInset} />
      ) : (
        <>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="mb-3">
              <Avatar name={fallbackName} size="lg" />
            </div>
            {showCameraOffOverlay ? (
              <VideoOff className="h-6 w-6" style={{ color: VIDEO_THEME.textSubtle }} />
            ) : !isLocal ? (
              <p className="text-sm" style={{ color: VIDEO_THEME.textSubtle }}>{tx.waitingOther}</p>
            ) : null}
          </div>
          <TileLabel name={fallbackName} youLabel={youLabel} bottomInset={bottomInset} />
        </>
      )}
    </div>
  )
}
