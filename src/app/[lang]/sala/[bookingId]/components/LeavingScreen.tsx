import { PhoneOff } from 'lucide-react'
import { VIDEO_THEME } from '../theme'

interface Props {
  message: string
}

// Rendered while room.disconnect() + completeSession() are in flight.
// Distinct from ConnectingScreen so users never see "Joining..." on exit.
export function LeavingScreen({ message }: Props) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-30"
      style={{ background: VIDEO_THEME.stage }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4 shadow-xl"
        style={{ background: VIDEO_THEME.brand, boxShadow: `0 12px 40px ${VIDEO_THEME.brandTint30}` }}
      >
        <PhoneOff className="h-7 w-7 text-white" />
      </div>
      <p className="text-sm" style={{ color: VIDEO_THEME.textMuted }}>{message}</p>
    </div>
  )
}
