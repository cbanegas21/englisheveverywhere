import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: 'Class after class',
    title: 'Your notebook fills up.',
    accent: 'So does your English.',
    body: 'Every class leaves a mark — new vocabulary, a phrase that sticks, an accent that sharpens. The platform saves an AI summary and the vocabulary from each class, and your teacher remembers where you left off.',
  },
  es: {
    eyebrow: 'Clase tras clase',
    title: 'Tu cuaderno se llena.',
    accent: 'Tu inglés también.',
    body: 'Cada clase deja huella. Vocabulario nuevo, una expresión que se queda, un acento que se afina. La plataforma guarda un resumen con IA y el vocabulario de cada clase, y tu maestro recuerda dónde te quedaste.',
  },
}

export default function NotebookBanner({ lang }: { lang: Locale }) {
  const tx = t[lang]
  return (
    <section
      className="lk-notebook"
      style={{
        position: 'relative',
        height: 340,
        overflow: 'hidden',
        borderTop: '1px solid var(--ek-border)',
        borderBottom: '1px solid var(--ek-border)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <style>{`
        @media (max-width: 600px) {
          .lk-notebook { height: 360px; }
          .lk-notebook .lk-notebook-photo { background-position: center 50% !important; }
          .lk-notebook .lk-notebook-scrim {
            background: linear-gradient(
              180deg,
              rgba(251,248,243,0.5) 0%,
              rgba(251,248,243,0.74) 28%,
              rgba(251,248,243,0.9) 54%,
              rgba(251,248,243,0.97) 100%
            ) !important;
          }
          .lk-notebook .lk-notebook-flex { align-items: flex-end !important; padding-bottom: 28px; }
          .lk-notebook .lk-notebook-text { max-width: 100% !important; }
          .lk-notebook .lk-notebook-body { max-width: 100% !important; }
        }
      `}</style>
      <div
        className="lk-notebook-photo"
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
        className="lk-notebook-scrim"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(270deg, rgba(251,248,243,0.92) 0%, rgba(251,248,243,0.55) 40%, rgba(251,248,243,0) 70%)',
        }}
      />
      <div
        className="lk-notebook-flex lk-shell"
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          zIndex: 2,
        }}
      >
        <div className="lk-notebook-text" style={{ maxWidth: 460, textAlign: 'right' }}>
          <span
            className="ek-kicker ek-kicker--red"
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
            className="lk-notebook-body"
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
