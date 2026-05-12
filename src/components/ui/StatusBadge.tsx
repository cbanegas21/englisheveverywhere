import type { ReactNode } from 'react'

type StatusVariant = 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'neutral'

type StatusBadgeProps = {
  variant: StatusVariant
  children: ReactNode
}

const VARIANTS: Record<StatusVariant, { bg: string; color: string; border: string }> = {
  confirmed: {
    bg: 'var(--ek-success-bg)',
    color: 'var(--ek-success-text)',
    border: 'var(--ek-success-border)',
  },
  pending: {
    bg: 'var(--ek-warn-bg)',
    color: 'var(--ek-warn-text)',
    border: 'var(--ek-warn-border)',
  },
  completed: {
    bg: 'var(--ek-paper)',
    color: 'var(--ek-text-soft)',
    border: 'var(--ek-border)',
  },
  cancelled: {
    bg: 'rgba(196,30,58,0.06)',
    color: 'var(--ek-red)',
    border: 'rgba(196,30,58,0.20)',
  },
  neutral: {
    bg: 'var(--ek-paper)',
    color: 'var(--ek-text-soft)',
    border: 'var(--ek-border)',
  },
}

/**
 * Status pill used across class lists, plan card, tareas, etc.
 * Tone: tiny mono-ish uppercase label, square corners, warm-tinted border.
 */
export function StatusBadge({ variant, children }: StatusBadgeProps) {
  const v = VARIANTS[variant]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: '5px 10px',
        borderRadius: 4,
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      {children}
    </span>
  )
}
