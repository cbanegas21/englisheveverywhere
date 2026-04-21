'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Video } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'

// Zoom-style entry: the room itself renders a lobby with a countdown for
// anyone who arrives early, so we expose the Join link up to 24h before
// scheduled_at. Server-side `getRoomAccess` only enforces the LATE cap
// (scheduled + duration + 90m) — we mirror that bound here.
const OPEN_BEFORE_MS = 24 * 60 * 60 * 1000
const CLOSE_AFTER_MS = 90 * 60 * 1000

const T = {
  en: {
    join: 'Join class',
    startsIn: (s: string) => `Starts in ${s}`,
    ended: 'Session ended',
    day: (n: number) => (n === 1 ? '1 day' : `${n} days`),
  },
  es: {
    join: 'Entrar a clase',
    startsIn: (s: string) => `Empieza en ${s}`,
    ended: 'Sesión terminada',
    day: (n: number) => (n === 1 ? '1 día' : `${n} días`),
  },
}

function formatCountdown(ms: number, lang: Locale): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000))
  if (totalMinutes < 60) {
    return lang === 'es' ? `${totalMinutes} min` : `${totalMinutes}m`
  }
  const totalHours = Math.floor(totalMinutes / 60)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const mins = totalMinutes % 60
  const tx = T[lang]
  if (days >= 1) {
    return hours > 0 ? `${tx.day(days)} ${hours}h` : tx.day(days)
  }
  return mins ? `${hours}h ${mins}m` : `${hours}h`
}

interface Props {
  lang: Locale
  bookingId: string
  scheduledAt: string
  /** Visual style: primary (filled brand), secondary (outline), compact (tight inline). */
  variant?: 'primary' | 'secondary' | 'compact'
  className?: string
}

export default function JoinSessionButton({
  lang,
  bookingId,
  scheduledAt,
  variant = 'primary',
  className,
}: Props) {
  const scheduledMs = useMemo(() => new Date(scheduledAt).getTime(), [scheduledAt])
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    // Tick every 30s — fine-grained enough for a minute-precision countdown
    // without causing excess re-renders.
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const openAt = scheduledMs - OPEN_BEFORE_MS
  const closeAt = scheduledMs + CLOSE_AFTER_MS
  const tx = T[lang]

  const href = `/${lang}/sala/${bookingId}`

  if (now < openAt) {
    const label = tx.startsIn(formatCountdown(openAt - now, lang))
    return renderDisabled(label, variant, className)
  }

  if (now > closeAt) {
    return renderDisabled(tx.ended, variant, className)
  }

  return renderLink(href, tx.join, variant, className)
}

function renderLink(href: string, label: string, variant: Props['variant'], className?: string) {
  const style = baseStyle(variant, false)
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onMouseEnter={(e) => {
        if (variant !== 'secondary') {
          (e.currentTarget as HTMLAnchorElement).style.background = '#9E1830'
        } else {
          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(196,30,58,0.05)'
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = baseStyle(variant, false).background as string
      }}
    >
      <Video className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Link>
  )
}

function renderDisabled(label: string, variant: Props['variant'], className?: string) {
  const style = baseStyle(variant, true)
  return (
    <span className={className} style={style}>
      <Video className="h-3.5 w-3.5" />
      <span>{label}</span>
    </span>
  )
}

function baseStyle(variant: Props['variant'], disabled: boolean): React.CSSProperties {
  const gap = '6px'
  const common: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap,
    fontWeight: 600,
    fontSize: variant === 'compact' ? '12px' : '13px',
    borderRadius: '6px',
    textDecoration: 'none',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
  }

  if (disabled) {
    return {
      ...common,
      padding: variant === 'compact' ? '6px 10px' : '8px 14px',
      background: '#F3F4F6',
      color: '#9CA3AF',
      cursor: 'not-allowed',
      border: '1px solid #E5E7EB',
    }
  }

  if (variant === 'secondary') {
    return {
      ...common,
      padding: '8px 14px',
      background: '#fff',
      color: '#C41E3A',
      border: '1px solid #C41E3A',
      cursor: 'pointer',
    }
  }

  // primary + compact
  return {
    ...common,
    padding: variant === 'compact' ? '6px 10px' : '8px 14px',
    background: '#C41E3A',
    color: '#fff',
    border: '1px solid #C41E3A',
    cursor: 'pointer',
  }
}
