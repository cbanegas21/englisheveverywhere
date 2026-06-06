import type { ReactNode } from 'react'

type StatusVariant = 'live' | 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'neutral'

type StatusBadgeProps = {
  variant: StatusVariant
  children: ReactNode
  /** Leading dot — used for the live/active pulsing indicator. */
  dot?: boolean
}

/**
 * Status pill — crimson/ink ONLY (brand directive 2026-06-06: no green/amber/blue).
 * Status is carried by the label + weight + linework (solid vs dashed border),
 * NOT by stoplight color. Crimson is reserved for the live/active state.
 * Square corners, warm-tinted borders, tiny uppercase label.
 */
const VARIANTS: Record<StatusVariant, { bg: string; color: string; border: string; dashed?: boolean }> = {
  live: {
    bg: 'var(--ek-red-tint)',
    color: 'var(--ek-red)',
    border: 'var(--ek-red-tint-3)',
  },
  confirmed: {
    bg: 'transparent',
    color: 'var(--ek-text)',
    border: 'var(--ek-border-mid)',
  },
  pending: {
    bg: 'transparent',
    color: 'var(--ek-text-muted)',
    border: 'var(--ek-border-mid)',
    dashed: true,
  },
  completed: {
    bg: 'var(--ek-paper)',
    color: 'var(--ek-text-soft)',
    border: 'var(--ek-border)',
  },
  cancelled: {
    bg: 'transparent',
    color: 'var(--ek-text-faint)',
    border: 'var(--ek-border-soft)',
  },
  neutral: {
    bg: 'var(--ek-paper)',
    color: 'var(--ek-text-soft)',
    border: 'var(--ek-border)',
  },
}

export function StatusBadge({ variant, children, dot }: StatusBadgeProps) {
  const v = VARIANTS[variant]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: '5px 10px',
        borderRadius: 4,
        background: v.bg,
        color: v.color,
        border: `1px ${v.dashed ? 'dashed' : 'solid'} ${v.border}`,
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
            animation: variant === 'live' ? 'pulse-dot 1.4s ease-in-out infinite' : undefined,
          }}
        />
      )}
      {children}
    </span>
  )
}
