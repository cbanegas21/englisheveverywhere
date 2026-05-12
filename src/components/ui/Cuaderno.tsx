import type { ReactNode } from 'react'

type CuadernoProps = {
  children: ReactNode
  /** Number of binding holes. Default 5. */
  bindingHoles?: number
  /** Optional className for outer container. */
  className?: string
}

/**
 * Cuaderno (notebook) surface — paper-cream background, binding holes on the
 * left, red margin line. Used for vocabulary lists, AI session notes, and
 * the dashboard home "tu cuaderno" preview.
 *
 * Motif source: dashboard-home.jsx the cuaderno block at bottom of home,
 * dashboard-sala.jsx right sidebar.
 *
 * Content should be wrapped — typical pattern is a header row + dashed
 * divider + grid of entries. Use Cuaderno.Word and Cuaderno.Header helpers
 * for the canonical layout, or place any children directly.
 */
export function Cuaderno({ children, bindingHoles = 5, className }: CuadernoProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        background: 'var(--ek-notebook-bg)',
        borderRadius: 4,
        border: '1px solid #E8DDC2',
        boxShadow:
          '0 12px 30px rgba(80,60,30,0.08), 0 2px 6px rgba(80,60,30,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* binding holes */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 18,
          top: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        {Array.from({ length: bindingHoles }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'rgba(80,60,30,0.08)',
              border: '1px solid rgba(80,60,30,0.12)',
            }}
          />
        ))}
      </div>
      {/* red margin line */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 58,
          top: 0,
          bottom: 0,
          width: 1,
          background: 'rgba(196,30,58,0.25)',
        }}
      />
      <div style={{ padding: '26px 32px 30px 80px', position: 'relative' }}>{children}</div>
    </div>
  )
}

type CuadernoHeaderProps = {
  kicker?: ReactNode
  title: ReactNode
  stamp?: ReactNode
}

Cuaderno.Header = function CuadernoHeader({ kicker, title, stamp }: CuadernoHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 22,
        borderBottom: '1px dashed var(--ek-notebook-line)',
        paddingBottom: 14,
      }}
    >
      <div>
        {kicker && (
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ek-notebook-muted)',
              fontWeight: 700,
              marginBottom: 4,
              fontFamily: 'var(--ek-font-sans)',
            }}
          >
            {kicker}
          </div>
        )}
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--ek-font-serif)',
            fontWeight: 400,
            fontSize: 32,
            color: 'var(--ek-notebook-ink)',
            letterSpacing: '-0.015em',
            lineHeight: 1,
          }}
        >
          {title}
        </h3>
      </div>
      {stamp}
    </div>
  )
}

type CuadernoStampProps = {
  children: ReactNode
}

Cuaderno.Stamp = function CuadernoStamp({ children }: CuadernoStampProps) {
  return (
    <span
      style={{
        fontFamily: 'var(--ek-font-mono)',
        fontSize: 11,
        color: 'var(--ek-red)',
        fontWeight: 700,
        letterSpacing: 0.06,
        border: '1.5px dashed var(--ek-red)',
        padding: '5px 10px',
        borderRadius: 4,
        transform: 'rotate(-3deg)',
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  )
}

type CuadernoWordProps = {
  word: ReactNode
  translation: ReactNode
  example?: ReactNode
  /** Date tag like "10·V". */
  date?: ReactNode
}

Cuaderno.Word = function CuadernoWord({ word, translation, example, date }: CuadernoWordProps) {
  return (
    <div
      style={{
        paddingBottom: 12,
        borderBottom: '1px dashed var(--ek-notebook-dash)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontFamily: 'var(--ek-font-serif)',
            fontSize: 22,
            fontWeight: 400,
            color: 'var(--ek-notebook-ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {word}
        </span>
        {date && (
          <span
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 9.5,
              color: 'var(--ek-notebook-faint)',
            }}
          >
            {date}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--ek-notebook-soft)',
          marginTop: 4,
          fontFamily: 'var(--ek-font-sans)',
        }}
      >
        {translation}
      </div>
      {example && (
        <div
          style={{
            fontFamily: 'var(--ek-font-serif)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--ek-notebook-muted)',
            marginTop: 6,
            lineHeight: 1.4,
          }}
        >
          &ldquo;{example}&rdquo;
        </div>
      )}
    </div>
  )
}
