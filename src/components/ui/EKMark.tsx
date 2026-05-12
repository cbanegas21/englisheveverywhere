type EKMarkProps = {
  size?: number
  /** Background color of the rounded square. Default: ink (#111111). Pass "#fff" for dark-bg contexts. */
  bg?: string
  /** Color of the three E bars. Default: opposite of bg. */
  barColor?: string
  /** Color of the K-arrow. Default: red (#C41E3A). */
  arrowColor?: string
  className?: string
}

/**
 * EnglishKolab mark — 3 bars + red K-arrow on rounded square.
 * Mockup source: englishkolab changes/shared.jsx → EKMark.
 */
export function EKMark({
  size = 40,
  bg = '#111111',
  barColor,
  arrowColor = '#C41E3A',
  className,
}: EKMarkProps) {
  const bars = barColor ?? (bg === '#111111' || bg === '#000' || bg === '#000000' ? '#fff' : '#111111')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="100" height="100" rx="14" fill={bg} />
      {/* E bars */}
      <path d="M 22 28 L 60 28 L 65 36 L 22 36 Z" fill={bars} />
      <path d="M 22 46 L 52 46 L 56 54 L 22 54 Z" fill={bars} />
      <path d="M 22 64 L 60 64 L 65 72 L 22 72 Z" fill={bars} />
      {/* K arrow */}
      <path d="M 62 22 L 70 22 L 84 50 L 70 78 L 62 78 L 76 50 Z" fill={arrowColor} />
    </svg>
  )
}
