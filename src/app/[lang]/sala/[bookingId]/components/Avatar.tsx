import { VIDEO_THEME } from '../theme'

interface Props {
  name: string
  size: 'sm' | 'md' | 'lg'
}

// Neutral avatar (dark slate + white initials). Reserved brand crimson for
// CTAs/accents — avatars use a calm neutral across all participants.
export function Avatar({ name, size }: Props) {
  const letter = (name[0] ?? '?').toUpperCase()
  const cls = size === 'sm' ? 'h-10 w-10 text-sm' : size === 'md' ? 'h-14 w-14 text-lg' : 'h-20 w-20 text-2xl'
  return (
    <div
      className={`flex items-center justify-center rounded-full font-black ${cls}`}
      style={{ background: VIDEO_THEME.avatarBg, color: VIDEO_THEME.avatarText }}
    >
      {letter}
    </div>
  )
}
