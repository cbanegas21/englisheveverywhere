import type { ReactNode } from 'react'

type DashTopBarProps = {
  /**
   * The main title. Plain text rendered bold. For an italic Instrument Serif
   * flourish (e.g. "Hola, Camila — buenos días"), pass an element via `title`
   * instead of a string and use the `<TitleFlourish>` helper.
   */
  title: ReactNode
  /** Subtitle row under the title (e.g. "Bogotá · Martes 12 de mayo · 6:42 AM"). */
  sub?: ReactNode
  /** Right-side slot: badges, currency selector, primary action, etc. */
  right?: ReactNode
}

/**
 * Italic Instrument Serif flourish used inline in the title.
 * Usage: <DashTopBar title={<>Hola, Camila — <TitleFlourish>buenos días</TitleFlourish></>} />
 */
export function TitleFlourish({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--ek-font-serif)',
        fontStyle: 'italic',
        fontWeight: 400,
        color: 'var(--ek-text-muted)',
      }}
    >
      {children}
    </span>
  )
}

/**
 * Shared dashboard top bar. White surface, bottom-aligned content,
 * border-bottom in warm border tone. Matches dashboard-shell.jsx DashTopBar.
 */
export function DashTopBar({ title, sub, right }: DashTopBarProps) {
  return (
    <div
      style={{
        padding: '18px clamp(16px, 4vw, 36px)',
        background: 'var(--ek-card)',
        borderBottom: '1px solid var(--ek-border)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0, flex: '0 1 auto' }}>
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(20px, 5vw, 24px)',
            fontWeight: 900,
            letterSpacing: '-0.025em',
            color: 'var(--ek-text)',
            lineHeight: 1.15,
            fontFamily: 'var(--ek-font-sans)',
          }}
        >
          {title}
        </h1>
        {sub && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              color: 'var(--ek-text-muted)',
              fontFamily: 'var(--ek-font-sans)',
            }}
          >
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  )
}
