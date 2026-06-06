import type { ReactNode } from 'react'

/**
 * Editorial section header — mono kicker + bold title + hairline rule.
 * Replaces the "icon-in-a-rounded-square" section markers across the dashboard
 * with a typography-first treatment. Optional right slot for a count / action.
 */
export function SectionHeader({
  kicker,
  title,
  right,
}: {
  kicker?: string
  title: ReactNode
  right?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        paddingBottom: 12,
        borderBottom: '1px solid var(--ek-border)',
        marginBottom: 18,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {kicker && (
          <div className="ek-microlabel" style={{ marginBottom: 6 }}>
            {kicker}
          </div>
        )}
        <h2
          style={{
            margin: 0,
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: '-0.015em',
            color: 'var(--ek-text)',
            fontFamily: 'var(--ek-font-sans)',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}
