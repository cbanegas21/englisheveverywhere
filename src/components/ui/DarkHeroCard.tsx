import type { ReactNode, CSSProperties } from 'react'

type DarkHeroCardProps = {
  children: ReactNode
  /**
   * Big ghost watermark — large Instrument Serif italic numeral/word rendered
   * faintly behind the content (e.g. "21h", "14", "impulso", "B1").
   * Lives in the top-right by default.
   */
  ghost?: ReactNode
  /** Ghost positioning. Default: { top: -40, right: -30 }. */
  ghostStyle?: CSSProperties
  /** Override the ghost font size. Default 280. */
  ghostSize?: number
  /** Override padding. Default '28px 32px'. */
  padding?: string
  /** Override the overall border-radius. Default 16. */
  radius?: number
  /** Optional className for outer card. */
  className?: string
  /** Optional inline style override on the outer card. */
  style?: CSSProperties
}

/**
 * Dark hero card — the recurring #111 card that anchors every dashboard
 * screen (next class, plan saldo, level, balance). Ghost Instrument Serif
 * italic numeral sits behind the content as visual signature.
 *
 * Motif source: dashboard-home.jsx HomeNextClassHero, dashboard-plan.jsx
 * current plan hero, dashboard-agendar.jsx saldo card, dashboard-progreso.jsx
 * level hero.
 */
export function DarkHeroCard({
  children,
  ghost,
  ghostStyle,
  ghostSize = 280,
  padding = '28px 32px',
  radius = 16,
  className,
  style,
}: DarkHeroCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--ek-ink)',
        color: 'var(--ek-on-dark)',
        borderRadius: radius,
        padding,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {ghost !== undefined && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -40,
            right: -30,
            fontFamily: 'var(--ek-font-serif)',
            fontStyle: 'italic',
            fontSize: ghostSize,
            color: 'rgba(244,239,230,0.04)',
            lineHeight: 0.8,
            pointerEvents: 'none',
            userSelect: 'none',
            ...ghostStyle,
          }}
        >
          {ghost}
        </div>
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}
