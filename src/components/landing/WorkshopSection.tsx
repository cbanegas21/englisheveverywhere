import type { Locale } from '@/lib/i18n/translations'

// Landing section advertising "El Taller / The Workshop" — the student practice
// space. Only BUILT features are claimed (teacher quizzes, saved class vocabulary,
// shared materials) — no games/SRS/book (unbuilt). Gentle / anti-IA, matches the
// editorial house style (lk-shell, ek-kicker, serif accent, ledger cards).
const t = {
  en: {
    eyebrow: 'Between your classes',
    titleLead: 'Your English workshop.',
    titleAccent: 'Practice at your pace.',
    side: 'Everything from your classes lives in one place — and there is always something to do between them. No grades, no streaks, no pressure.',
    cards: [
      { n: '01', title: 'Quizzes from your teacher', body: 'Practice built around what you are actually learning — multiple choice, matching, short answers. Retake them as often as you like; nothing is graded against you.', tag: 'Retake anytime' },
      { n: '02', title: 'Your class vocabulary', body: 'The new words from every class, saved to review with examples in context — so they actually stick.', tag: 'Saved for you' },
      { n: '03', title: "Your teacher's materials", body: 'The files and resources your teacher shares with you, in one place, ready whenever you need them.', tag: 'Shared with you' },
    ],
    foot: 'It is yours to practice at your pace — and if you answer with AI, you only fool yourself.',
  },
  es: {
    eyebrow: 'Entre tus clases',
    titleLead: 'Tu taller de inglés.',
    titleAccent: 'Practica a tu ritmo.',
    side: 'Todo lo de tus clases vive en un solo lugar — y entre clase y clase siempre hay algo que hacer. Sin calificaciones, sin rachas, sin presión.',
    cards: [
      { n: '01', title: 'Quizzes de tu maestro', body: 'Práctica hecha con lo que de verdad estás aprendiendo — opción múltiple, emparejar, respuestas cortas. Repítelos las veces que quieras; aquí nada se califica en tu contra.', tag: 'Repite cuando quieras' },
      { n: '02', title: 'El vocabulario de tus clases', body: 'Las palabras nuevas de cada clase, guardadas para repasar con ejemplos en contexto — para que de verdad se queden.', tag: 'Guardado para ti' },
      { n: '03', title: 'Los materiales de tu maestro', body: 'Los archivos y recursos que tu maestro comparte contigo, en un solo lugar, listos cuando los necesites.', tag: 'Compartido contigo' },
    ],
    foot: 'Es tuyo para practicar a tu ritmo — y si respondes con IA, solo te engañas a ti mismo.',
  },
}

export default function WorkshopSection({ lang }: { lang: Locale }) {
  const tx = t[lang]
  return (
    <section className="lk-section-y" style={{ background: 'var(--ek-paper)', fontFamily: 'var(--ek-font-sans)', borderTop: '1px solid var(--ek-border)' }}>
      <style>{`
        .lk-ws-grid { display: grid; grid-template-columns: 1fr; gap: 0; border-top: 1px solid var(--ek-border-mid); }
        .lk-ws-card { padding: 28px 0 30px; border-bottom: 1px solid var(--ek-border); }
        @media (min-width: 600px) {
          .lk-ws-grid { grid-template-columns: repeat(3, 1fr); column-gap: 44px; border-bottom: 1px solid var(--ek-border-mid); }
          .lk-ws-card { padding: 32px 0 34px; border-bottom: none; }
        }
        .lk-ws-numeral { font-family: var(--ek-font-serif); font-style: italic; font-weight: 400; font-size: clamp(2.4rem, 5vw, 3.2rem); line-height: 0.9; letter-spacing: -0.02em; color: var(--ek-red); }
      `}</style>

      <div className="lk-shell">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end" style={{ marginBottom: 44, gap: 24 }}>
          <div>
            <span className="ek-kicker ek-kicker--red">{tx.eyebrow}</span>
            <h2 style={{ fontFamily: 'var(--ek-font-sans)', fontWeight: 800, fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', letterSpacing: '-0.03em', lineHeight: 1.0, marginTop: 16, color: 'var(--ek-text)' }}>
              {tx.titleLead}
              <br />
              <span style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontWeight: 400 }}>{tx.titleAccent}</span>
            </h2>
          </div>
          <p className="ek-body" style={{ maxWidth: 360 }}>{tx.side}</p>
        </div>

        <div className="lk-ws-grid">
          {tx.cards.map((c) => (
            <div key={c.n} className="lk-ws-card">
              <div className="lk-ws-numeral">{c.n}</div>
              <div style={{ fontSize: 19, fontWeight: 700, marginTop: 16, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--ek-text)' }}>{c.title}</div>
              <p className="ek-body" style={{ marginTop: 10 }}>{c.body}</p>
              <span style={{ display: 'block', marginTop: 16, fontFamily: 'var(--ek-font-mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ek-red)', fontWeight: 600 }}>{c.tag}</span>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 28, fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.55, color: 'var(--ek-text-muted)', maxWidth: '60ch' }}>
          {tx.foot}
        </p>
      </div>
    </section>
  )
}
