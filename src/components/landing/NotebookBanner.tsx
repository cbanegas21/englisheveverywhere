import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: '● Class after class',
    title: 'Your notebook fills up.',
    accent: 'So does your English.',
    body: 'Every class leaves a mark — new vocabulary, a phrase that sticks, an accent that sharpens. Your teacher remembers where you left off.',
  },
  es: {
    eyebrow: '● Clase tras clase',
    title: 'Tu cuaderno se llena.',
    accent: 'Tu inglés también.',
    body: 'Cada clase deja huella. Vocabulario nuevo, una expresión que se queda, un acento que se afina. Tu maestro recuerda dónde quedaron.',
  },
}

export default function NotebookBanner({ lang }: { lang: Locale }) {
  const tx = t[lang]
  return (
    <section
      style={{
        position: 'relative',
        height: 320,
        overflow: 'hidden',
        borderTop: '1px solid var(--ek-border)',
        borderBottom: '1px solid var(--ek-border)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/landing/notebook.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 55%',
          filter: 'saturate(0.9) brightness(0.95)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(270deg, rgba(251,248,243,0.92) 0%, rgba(251,248,243,0.55) 40%, rgba(251,248,243,0) 70%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 clamp(24px, 6vw, 80px)',
          zIndex: 2,
        }}
      >
        <div style={{ maxWidth: 460, textAlign: 'right' }}>
          <span
            className="ek-kicker ek-kicker--red ek-kicker--no-dot"
            style={{ color: 'var(--ek-red)' }}
          >
            {tx.eyebrow}
          </span>
          <h3
            style={{
              fontFamily: 'var(--ek-font-sans)',
              fontWeight: 800,
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              letterSpacing: '-0.03em',
              lineHeight: 1.0,
              marginTop: 16,
              color: 'var(--ek-text)',
            }}
          >
            {tx.title}
            <br />
            <span
              style={{
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'italic',
                fontWeight: 400,
              }}
            >
              {tx.accent}
            </span>
          </h3>
          <p
            style={{
              marginTop: 16,
              fontSize: 16,
              lineHeight: 1.55,
              color: 'var(--ek-text-soft)',
              maxWidth: 420,
              marginLeft: 'auto',
            }}
          >
            {tx.body}
          </p>
        </div>
      </div>
    </section>
  )
}
