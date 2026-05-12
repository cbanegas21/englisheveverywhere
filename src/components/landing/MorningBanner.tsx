import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: '● 06:14 · Tuesday',
    title: 'Before coffee,',
    accent: 'a class.',
    body: 'While the sun rises, you already have 30 new words. Your teacher is awake in San José, in Bogotá, in CDMX.',
  },
  es: {
    eyebrow: '● 06:14 · martes',
    title: 'Antes del café,',
    accent: 'una clase.',
    body: 'Mientras el sol sale, tú ya tienes 30 palabras nuevas. Tu maestro está despierto en San José, en Bogotá, en CDMX.',
  },
}

export default function MorningBanner({ lang }: { lang: Locale }) {
  const tx = t[lang]
  return (
    <section
      style={{
        position: 'relative',
        height: 360,
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
          backgroundImage: 'url(/landing/morning.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 60%',
          filter: 'saturate(0.95)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(251,248,243,0.92) 0%, rgba(251,248,243,0.55) 38%, rgba(251,248,243,0) 65%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 clamp(24px, 6vw, 80px)',
          zIndex: 2,
        }}
      >
        <div style={{ maxWidth: 520 }}>
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
            }}
          >
            {tx.body}
          </p>
        </div>
      </div>
    </section>
  )
}
