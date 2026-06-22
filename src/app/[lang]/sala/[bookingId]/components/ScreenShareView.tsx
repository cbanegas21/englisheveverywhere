'use client'

import { VideoTrack, useTrackToggle } from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { MonitorUp, MonitorX, Volume2 } from 'lucide-react'
import { Track } from 'livekit-client'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'

interface Props {
  lang: Locale
  shareTrack: TrackReference
  // True when a ScreenShareAudio track is also live — surfaces a "🔊 Audio" pill
  // so both sides can SEE that sound is being shared (the #1 "is it working?"
  // question). Computed in RoomShell from the audio publications.
  hasAudio: boolean
}

// Full-stage presenter view for an active screen share. object-contain keeps the
// shared screen's aspect ratio; a hairline frame mats the letterbox bars.
export function ScreenShareView({ lang, shareTrack, hasAudio }: Props) {
  const tx = videoStrings(lang)
  const presenter = shareTrack.participant.name || shareTrack.participant.identity
  const isLocal = shareTrack.participant.isLocal
  const screenShare = useTrackToggle({ source: Track.Source.ScreenShare })

  return (
    <div className="absolute inset-0" style={{ background: VIDEO_THEME.stage }}>
      <VideoTrack trackRef={shareTrack} className="h-full w-full object-contain" />
      {/* Inner hairline so the contained share reads as intentional matting. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: `inset 0 0 0 1px ${VIDEO_THEME.border}` }}
      />
      {/* Presenter badge — top-left glass (was a centered opaque pill), with a
          one-click stop for the local presenter. */}
      <div
        className="absolute left-4 top-4 flex items-center gap-2.5 rounded-lg px-3 py-2 backdrop-blur-md"
        style={{ background: 'rgba(10,12,15,0.55)', border: `1px solid ${VIDEO_THEME.border}` }}
      >
        <MonitorUp className="h-4 w-4 flex-shrink-0" style={{ color: VIDEO_THEME.brand }} />
        <span className="text-[13px] text-white">
          {isLocal ? (
            tx.youSharing
          ) : (
            <>
              {tx.sharingPrefix} <strong className="font-semibold">{presenter}</strong> {tx.sharingSuffix}
            </>
          )}
        </span>
        {hasAudio && (
          <span
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white"
            style={{ background: VIDEO_THEME.brandTint20, border: `1px solid ${VIDEO_THEME.brandTint30}` }}
            title={tx.shareAudioBadgeTitle}
          >
            <Volume2 className="h-3.5 w-3.5" style={{ color: VIDEO_THEME.brand }} />
            {tx.shareAudioBadge}
          </span>
        )}
        {isLocal && (
          <button
            onClick={() => { void screenShare.toggle() }}
            className="ml-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-white transition-colors"
            style={{ background: VIDEO_THEME.brand }}
            onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
            onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
          >
            <MonitorX className="h-3.5 w-3.5" />
            {tx.stopSharing}
          </button>
        )}
      </div>
    </div>
  )
}
