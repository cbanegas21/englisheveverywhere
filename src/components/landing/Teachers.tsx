'use client'

import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: 'Teachers',
    titleLead: 'One teacher.',
    titleAccent: 'Yours.',
    body: [
      "We're not a ", { b: 'marketplace' }, ". You don't browse a hundred profiles. We ",
      { b: 'match you' }, ' with a teacher based on ', { b: 'your level, your goals, and your schedule' },
      '. You get to know them. They get to know you.',
    ],
    bodyContd: [
      "If your teacher isn't free at a time you pick, ", { b: 'another available teacher covers that class' },
      " — so you're never stuck waiting.",
    ],
    facts: [
      { k: 'Format', v: '1-to-1, live' },
      { k: 'Sessions', v: '60 minutes' },
      { k: 'Framework', v: 'CEFR A0 → C2' },
      { k: 'Match', v: 'Hand-picked' },
    ],
    cardKicker: 'Your match',
    cardBadge: 'Reserved for you',
    cardName: 'Your teacher',
    cardNameAccent: 'one, not a hundred.',
    cardLead: 'After you book, we hand-pick one teacher and keep them yours — not a queue, not a group, not a wall of profiles to scroll.',
    cardRows: [
      { k: 'Matched on', v: 'Your level, goals & schedule' },
      { k: 'Class format', v: '1-to-1, live on video' },
      { k: 'They learn', v: 'How you speak — and what trips you up' },
    ],
    cardYears: 'matched · personal · yours',
    cardSeal: 'EK · MAESTRO',
  },
  es: {
    eyebrow: 'Maestros',
    titleLead: 'Un maestro.',
    titleAccent: 'El tuyo.',
    body: [
      'No somos un ', { b: 'marketplace' }, '. No eliges entre cien perfiles. Te ',
      { b: 'emparejamos' }, ' con un maestro según ', { b: 'tu nivel, tus metas y tu horario' },
      '. Lo conoces. Te conoce.',
    ],
    bodyContd: [
      'Si tu maestro no está libre a una hora que elegiste, ', { b: 'otro maestro disponible cubre esa clase' },
      ' — para que nunca te quedes esperando.',
    ],
    facts: [
      { k: 'Formato', v: '1 a 1, en vivo' },
      { k: 'Sesiones', v: '60 minutos' },
      { k: 'Marco', v: 'CEFR A0 → C2' },
      { k: 'Asignación', v: 'A mano' },
    ],
    cardKicker: 'Tu match',
    cardBadge: 'Reservado para ti',
    cardName: 'Tu maestro',
    cardNameAccent: 'uno, no cien.',
    cardLead: 'Cuando reservas, elegimos a mano un maestro y lo mantenemos tuyo — no una fila, ni un grupo, ni un muro de perfiles para scrollear.',
    cardRows: [
      { k: 'Emparejado por', v: 'Tu nivel, metas y horario' },
      { k: 'Formato', v: '1 a 1, en vivo por video' },
      { k: 'Te conoce', v: 'Cómo hablas — y qué se te traba' },
    ],
    cardYears: 'asignado · personal · tuyo',
    cardSeal: 'EK · MAESTRO',
  },
}

type RichPart = string | { b: string }
function renderRich(parts: RichPart[]) {
  return parts.map((p, i) =>
    typeof p === 'string' ? (
      <span key={i}>{p}</span>
    ) : (
      <strong key={i} style={{ color: 'var(--ek-text)', fontWeight: 700 }}>
        {p.b}
      </strong>
    ),
  )
}

export default function Teachers({ lang }: { lang: Locale }) {
  const tx = t[lang]

  return (
    <section
      id="teachers"
      className="lk-section-y"
      style={{
        background: 'var(--ek-paper)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <style>{`
        @media (max-width: 420px) {
          .lk-teach-row { flex-direction: column; gap: 4px !important; }
          .lk-teach-row > span:first-child { width: auto !important; }
        }
      `}</style>
      <div className="lk-shell">
        <div
          className="grid items-start grid-cols-1 lg:grid-cols-2"
          style={{
            gap: 'clamp(40px, 6vw, 80px)',
          }}
        >
          {/* Left narrative */}
          <div className="min-w-0">
            <span className="ek-kicker ek-kicker--red">{tx.eyebrow}</span>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{
                fontFamily: 'var(--ek-font-sans)',
                fontWeight: 800,
                fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
                letterSpacing: '-0.03em',
                lineHeight: 1.0,
                marginTop: 16,
                color: 'var(--ek-text)',
              }}
            >
              {tx.titleLead}
              <br />
              <span
                style={{
                  fontFamily: 'var(--ek-font-serif)',
                  fontStyle: 'italic',
                  fontWeight: 400,
                }}
              >
                {tx.titleAccent}
              </span>
            </motion.h2>
            <p className="ek-body-large" style={{ marginTop: 28 }}>
              {renderRich(tx.body)}
            </p>
            <p className="ek-body" style={{ marginTop: 16 }}>
              {renderRich(tx.bodyContd)}
            </p>

            <div
              style={{
                marginTop: 40,
                paddingTop: 32,
                borderTop: '1px solid var(--ek-border)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 24,
              }}
            >
              {tx.facts.map((f) => (
                <div key={f.k}>
                  <div
                    style={{
                      fontFamily: 'var(--ek-font-mono)',
                      color: 'var(--ek-text-muted)',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {f.k}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontWeight: 600,
                      fontSize: 14,
                      color: 'var(--ek-text)',
                    }}
                  >
                    {f.v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: matched-teacher card — dark ink, ghost serif "1" */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lk-teach-card min-w-0"
            style={{
              position: 'relative',
              overflow: 'hidden',
              background: 'var(--ek-ink)',
              border: '1px solid var(--ek-on-dark-faint)',
              borderRadius: 'var(--ek-radius-lg)',
              boxShadow: '0 32px 64px -36px rgba(0,0,0,0.45)',
              alignSelf: 'start',
              color: 'var(--ek-on-dark)',
            }}
          >
            {/* Ghost serif numeral — the single, one-of-one teacher.
                Committed as a deliberate mark: fully on-canvas, upright,
                anchored top-right so the whole glyph reads clearly as a "1". */}
            <span
              aria-hidden
              className="lk-teach-ghost"
              style={{
                position: 'absolute',
                top: 'clamp(8px, 1.5vw, 20px)',
                right: 'clamp(20px, 3vw, 40px)',
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'normal',
                lineHeight: 0.74,
                fontSize: 'clamp(150px, 18vw, 230px)',
                color: 'var(--ek-on-dark)',
                opacity: 0.09,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              1
            </span>

            <div
              className="lk-teach-inner"
              style={{
                position: 'relative',
                zIndex: 1,
                padding: 'clamp(24px, 3.5vw, 36px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 22,
              }}
            >
              {/* Header: kicker + reserved badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 10,
                    color: 'var(--ek-on-dark-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                  }}
                >
                  {tx.cardKicker}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '5px 11px',
                    borderRadius: 999,
                    background: 'var(--ek-red-tint-3)',
                    border: '1px solid rgba(232,82,106,0.35)',
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--ek-red-light)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--ek-red-light)',
                      boxShadow: '0 0 0 3px rgba(232,82,106,0.18)',
                    }}
                  />
                  {tx.cardBadge}
                </span>
              </div>

              {/* Focal lockup — typographic, replaces the abstract avatar.
                  Serif "Tu maestro / uno, no cien." reads as the card's mark,
                  anchored above by a hairline rule. */}
              <div
                style={{
                  paddingTop: 'clamp(4px, 1.5vw, 12px)',
                  borderTop: '1px solid var(--ek-on-dark-faint)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--ek-font-sans)',
                    fontSize: 'clamp(1.6rem, 4.2vw, 2.1rem)',
                    fontWeight: 800,
                    letterSpacing: '-0.025em',
                    lineHeight: 1.04,
                    color: 'var(--ek-on-dark)',
                  }}
                >
                  {tx.cardName}
                  <br />
                  <span
                    style={{
                      fontFamily: 'var(--ek-font-serif)',
                      fontStyle: 'italic',
                      fontWeight: 400,
                      letterSpacing: '-0.01em',
                      color: 'var(--ek-red-light)',
                    }}
                  >
                    {tx.cardNameAccent}
                  </span>
                </div>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--ek-on-dark-soft)',
                }}
              >
                {tx.cardLead}
              </p>

              {/* Reassurance rows — plain hairline-ruled, no faux-table fill */}
              <div>
                {tx.cardRows.map((row) => (
                  <div
                    key={row.k}
                    className="lk-teach-row"
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 14,
                      padding: '14px 0',
                      borderTop: '1px solid var(--ek-on-dark-faint)',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 96,
                        fontFamily: 'var(--ek-font-mono)',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color: 'var(--ek-on-dark-muted)',
                      }}
                    >
                      {row.k}
                    </span>
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        lineHeight: 1.4,
                        color: 'var(--ek-on-dark)',
                      }}
                    >
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer seal */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  paddingTop: 16,
                  borderTop: '1px solid var(--ek-on-dark-faint)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 11,
                    color: 'var(--ek-on-dark-muted)',
                  }}
                >
                  {tx.cardYears}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 10,
                    color: 'var(--ek-red-light)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {tx.cardSeal}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
