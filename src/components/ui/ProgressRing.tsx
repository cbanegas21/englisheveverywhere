import type { ReactNode } from 'react'

// Editorial progress ring — a hairline track with an accent arc, big tnum number
// in the middle, mono kicker below. Gentle by design: no streaks, no "you failed",
// just how much of something is done. SVG-only (no client JS), reduced-motion safe
// (the arc is static, not animated). Matches the --ek-* token system + StatLedger
// look so The Lab's "Tu progreso" doesn't read as a generic AI card.
export interface ProgressRingProps {
  /** Filled amount. */
  value: number
  /** Total. When 0 the ring renders empty (no division). */
  max: number
  /** Mono kicker under the number. */
  label: string
  /** Optional small caption under the label. */
  caption?: string
  /** Center content override (defaults to `value`). */
  center?: ReactNode
  /** Diameter in px. */
  size?: number
  /** Use the red accent arc (default) or the ink tone. */
  accent?: boolean
}

export function ProgressRing({ value, max, label, caption, center, size = 104, accent = true }: ProgressRingProps) {
  const stroke = Math.max(6, Math.round(size * 0.075))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const arc = c * pct
  const ringColor = accent ? 'var(--ek-red)' : 'var(--ek-ink, var(--ek-text))'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={max > 0 ? `${label}: ${value} / ${max}` : `${label}: ${value}`}
        >
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ek-border)" strokeWidth={stroke} />
          {pct > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arc} ${c - arc}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(size * 0.3),
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--ek-text)',
            fontFeatureSettings: "'tnum' 1",
          }}
        >
          {center ?? value}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ek-text-muted)' }}>{label}</span>
        {caption && <span style={{ fontSize: 12, color: 'var(--ek-text-muted)' }}>{caption}</span>}
      </div>
    </div>
  )
}
