import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: '06:14 · Tuesday',
    title: 'A class',
    accent: 'before coffee.',
    body: "By the time the sun's up, you've added 30 new words — a live class before the day even starts.",
  },
  es: {
    eyebrow: '06:14 · martes',
    title: 'Antes del café,',
    accent: 'una clase.',
    body: 'Mientras el sol sale, tú ya tienes 30 palabras nuevas — una clase en vivo antes de que arranque el día.',
  },
}

export default function MorningBanner({ lang }: { lang: Locale }) {
  const tx = t[lang]
  return (
    <section
      className="lk-morning"
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
          .lk-morning { height: 360px; }
          .lk-morning .lk-morning-photo { background-position: center 42% !important; }
          .lk-morning .lk-morning-scrim {
            background: linear-gradient(
              180deg,
              rgba(251,248,243,0.97) 0%,
              rgba(251,248,243,0.9) 46%,
              rgba(251,248,243,0.74) 72%,
              rgba(251,248,243,0.5) 100%
            ) !important;
          }
          .lk-morning .lk-morning-text { max-width: 100% !important; }
          .lk-morning .lk-morning-body { max-width: 100% !important; }
        }
      `}</style>
      <div
        className="lk-morning-photo"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/landing/morning.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 60%',
          filter: 'saturate(0.95)',
        }}
      />
      <div
        className="lk-morning-scrim"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(251,248,243,0.92) 0%, rgba(251,248,243,0.55) 38%, rgba(251,248,243,0) 65%)',
        }}
      />
      <div
        className="lk-shell"
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          zIndex: 2,
        }}
      >
        <div className="lk-morning-text" style={{ maxWidth: 520 }}>
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
            className="lk-morning-body"
            style={{
              marginTop: 16,
              fontSize: 16,
              lineHeight: 1.55,
              color: 'var(--ek-text-soft)',
              maxWidth: 420,
            }}
          >
            {tx.body}
          </p>
        </div>
      </div>
    </section>
  )
}
