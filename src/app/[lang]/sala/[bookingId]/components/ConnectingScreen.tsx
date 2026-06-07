import { VIDEO_THEME } from '../theme'
import { EKMark } from '@/components/ui/EKMark'

interface Props {
  message: string
}

export function ConnectingScreen({ message }: Props) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6"
      style={{ background: VIDEO_THEME.stage }}
    >
      <div className="mb-6">
        <EKMark size={40} bg="#F4EFE6" arrowColor={VIDEO_THEME.brand} />
      </div>
      <p
        className="mb-5 text-center text-white"
        style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 20 }}
      >
        {message}
      </p>
      <span
        className="h-5 w-5 animate-spin rounded-full border-2"
        style={{ borderColor: VIDEO_THEME.border, borderTopColor: VIDEO_THEME.brand }}
      />
    </div>
  )
}
