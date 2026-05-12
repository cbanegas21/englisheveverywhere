import type { ReactNode } from 'react'

type KickerStatProps = {
  /** Tiny uppercase mono label shown above the value. */
  kicker: ReactNode
  /** The headline number/word. Use string or ReactNode. */
  value: ReactNode
  /** Optional small description below the value. */
  sub?: ReactNode
  /** Render on a dark background (inverts colors). Default false. */
  onDark?: boolean
  /** Bigger value variant (44px instead of 36px). */
  big?: boolean
  /** Card surface or transparent? Default 'card'. */
  surface?: 'card' | 'paper' | 'transparent'
  className?: string
}

/**
 * Kicker + giant numeric value + sub. The dashboard's primary "stat block".
 * Motif source: dashboard-home.jsx HomeStatBlock, dashboard-progreso.jsx
 * stats row, dashboard-tareas.jsx stats, dashboard-biblioteca.jsx stats.
 */
export function KickerStat({
  kicker,
  value,
  sub,
  onDark = false,
  big = false,
  surface = 'card',
  className,
}: KickerStatProps) {
  const bg =
    surface === 'transparent'
      ? 'transparent'
      : surface === 'paper'
        ? 'var(--ek-paper)'
        : onDark
          ? 'transparent'
          : 'var(--ek-card)'
  const border = surface === 'transparent' ? 'none' : `1px solid ${onDark ? 'var(--ek-border-dark)' : 'var(--ek-border)'}`
  const labelColor = onDark ? 'var(--ek-on-dark-muted)' : 'var(--ek-text-muted)'
  const valueColor = onDark ? 'var(--ek-on-dark)' : 'var(--ek-text)'
  const subColor = onDark ? 'var(--ek-on-dark-muted)' : 'var(--ek-text-muted)'

  return (
    <div
      className={className}
      style={{
        background: bg,
        borderRadius: 14,
        padding: '20px 22px',
        border,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: labelColor,
          marginBottom: 12,
          fontFamily: 'var(--ek-font-sans)',
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontSize: big ? 44 : 36,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          lineHeight: 1,
          color: valueColor,
          fontFeatureSettings: '"tnum"',
          fontFamily: 'var(--ek-font-sans)',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 12,
            color: subColor,
            marginTop: 8,
            fontFamily: 'var(--ek-font-sans)',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}
