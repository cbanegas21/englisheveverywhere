import { VIDEO_THEME } from '../theme'

interface Props {
  name: string
  size: 'sm' | 'md' | 'lg'
}

// Warm, restrained monogram (notebook-adjacent fill + cream serif initial).
// Brand crimson stays reserved for CTAs; every participant gets the same calm
// color (no per-user rainbow — the room is intentionally 1-on-1).
export function Avatar({ name, size }: Props) {
  // Array.from → first GRAPHEME by code point, not UTF-16 unit; `name[0]` would
  // split an emoji/astral first char into a lone surrogate and render '�'.
  const letter = (Array.from(name)[0] ?? '?').toUpperCase()
  const cls = size === 'sm' ? 'h-10 w-10 text-base' : size === 'md' ? 'h-14 w-14 text-xl' : 'h-20 w-20 text-3xl'
  return (
    <div
      className={`flex items-center justify-center rounded-full ${cls}`}
      style={{
        background: VIDEO_THEME.avatarBg,
        color: VIDEO_THEME.avatarText,
        border: `1px solid ${VIDEO_THEME.avatarRing}`,
        fontFamily: 'var(--ek-font-serif)',
      }}
    >
      {letter}
    </div>
  )
}
