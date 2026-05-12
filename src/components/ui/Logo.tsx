import Link from 'next/link'
import { EKMark } from './EKMark'

type LogoProps = {
  /** Pass `true` when the logo sits on a dark background — inverts mark + wordmark to white. */
  onDark?: boolean
  /** Mark size in px. Wordmark scales proportionally. Default 36. */
  size?: number
  /** When set, wraps the logo in a Next Link to that href. */
  href?: string
  className?: string
}

export function Logo({ onDark = false, size = 36, href, className }: LogoProps) {
  const markBg = onDark ? '#fff' : '#111111'
  const wordColor = onDark ? '#fff' : '#111111'
  const wordSize = Math.round(size * 0.5)

  const inner = (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        lineHeight: 1,
      }}
    >
      <EKMark size={size} bg={markBg} />
      <span
        style={{
          fontFamily: 'var(--ek-font-sans)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: wordColor,
          fontSize: wordSize,
        }}
      >
        EnglishKolab
      </span>
    </span>
  )

  if (!href) return inner
  return (
    <Link href={href} aria-label="EnglishKolab" style={{ textDecoration: 'none' }}>
      {inner}
    </Link>
  )
}
