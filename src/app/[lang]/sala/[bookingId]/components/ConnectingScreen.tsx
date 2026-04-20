import { VIDEO_THEME } from '../theme'

interface Props {
  message: string
}

export function ConnectingScreen({ message }: Props) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-20"
      style={{ background: VIDEO_THEME.stage }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4 shadow-xl"
        style={{ background: VIDEO_THEME.brand, boxShadow: `0 12px 40px ${VIDEO_THEME.brandTint30}` }}
      >
        <span className="h-8 w-8 rounded-full border-4 border-white/30 border-t-white animate-spin" />
      </div>
      <p className="text-sm" style={{ color: VIDEO_THEME.textMuted }}>{message}</p>
    </div>
  )
}
