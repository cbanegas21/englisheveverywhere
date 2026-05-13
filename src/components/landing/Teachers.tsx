'use client'

import { motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    eyebrow: '● Teachers',
    titleLead: 'One teacher.',
    titleAccent: 'Yours.',
    body:
      "We're not a marketplace. You don't browse a hundred profiles. We hand-match you with a near-native Latin American teacher based on your level, your goals, and your schedule. You get to know them. They get to know you.",
    bodyContd:
      "If your teacher isn't free when you want to learn, another teacher who matches your hours covers that class — so 24/7 really means 24/7.",
    facts: [
      { k: 'Origin', v: 'Latin America' },
      { k: 'Level', v: 'Near-native' },
      { k: 'Framework', v: 'CEFR A0 → C2' },
      { k: 'Match', v: 'Hand-picked' },
    ],
    cardKicker: '↳ Your teacher card · preview',
    cardName: 'Your teacher · matched after signup',
    cardCityLabel: 'Lives in',
    cardCity: 'Latin America',
    cardHoursLabel: 'Available',
    cardHours: 'Across your time zone',
    cardFocusLabel: 'Specialty',
    cardFocus: 'Matched to your goals',
    cardYears: 'matched · personal · yours',
    networkLabel: '↳ Teachers across Latin America',
    cities: [
      'San José',
      'CDMX',
      'Bogotá',
      'Buenos Aires',
      'Lima',
      'Tegucigalpa',
      'Quito',
      'Santiago',
    ],
  },
  es: {
    eyebrow: '● Maestros',
    titleLead: 'Un maestro.',
    titleAccent: 'El tuyo.',
    body:
      'No somos un marketplace. No eliges entre cien perfiles. Te emparejamos a mano con un maestro latinoamericano según tu nivel, tus metas y tu horario. Lo conoces. Te conoce.',
    bodyContd:
      'Si tu maestro no está libre cuando quieres aprender, otro maestro con tu horario cubre esa clase — para que 24/7 siga siendo 24/7.',
    facts: [
      { k: 'Origen', v: 'Latinoamérica' },
      { k: 'Nivel', v: 'Casi nativo' },
      { k: 'Marco', v: 'CEFR A0 → C2' },
      { k: 'Asignación', v: 'A mano' },
    ],
    cardKicker: '↳ Tu maestro · vista previa',
    cardName: 'Tu maestro · asignado al registrarte',
    cardCityLabel: 'En',
    cardCity: 'Latinoamérica',
    cardHoursLabel: 'Disponible',
    cardHours: 'En tu zona horaria',
    cardFocusLabel: 'Especialidad',
    cardFocus: 'Según tus metas',
    cardYears: 'asignado · personal · tuyo',
    networkLabel: '↳ Maestros en Latinoamérica',
    cities: [
      'San José',
      'CDMX',
      'Bogotá',
      'Buenos Aires',
      'Lima',
      'Tegucigalpa',
      'Quito',
      'Santiago',
    ],
  },
}

export default function Teachers({ lang }: { lang: Locale }) {
  const tx = t[lang]

  return (
    <section
      id="teachers"
      style={{
        background: 'var(--ek-paper)',
        padding: '96px clamp(24px, 6vw, 80px)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div
          className="grid items-start"
          style={{
            gridTemplateColumns: '1fr 1fr',
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
            <p
              style={{
                marginTop: 28,
                fontSize: 17,
                lineHeight: 1.55,
                color: 'var(--ek-text-soft)',
              }}
            >
              {tx.body}
            </p>
            <p
              style={{
                marginTop: 16,
                fontSize: 15,
                lineHeight: 1.55,
                color: 'var(--ek-text-soft)',
              }}
            >
              {tx.bodyContd}
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

          {/* Right: single illustrative card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="min-w-0"
            style={{
              background: '#fff',
              border: '1px solid var(--ek-border)',
              padding: 28,
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              alignSelf: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 10,
                color: 'var(--ek-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              {tx.cardKicker}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--ek-ink)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                ?
              </div>
              <span
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 10,
                  color: 'var(--ek-text-muted)',
                  letterSpacing: '0.08em',
                }}
              >
                #—
              </span>
            </div>

            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--ek-text)',
                }}
              >
                {tx.cardName}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 9,
                    color: 'var(--ek-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {tx.cardCityLabel}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 14,
                    marginTop: 3,
                    color: 'var(--ek-text)',
                  }}
                >
                  {tx.cardCity}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 9,
                    color: 'var(--ek-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {tx.cardHoursLabel}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 14,
                    marginTop: 3,
                    color: 'var(--ek-text)',
                  }}
                >
                  {tx.cardHours}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 9,
                    color: 'var(--ek-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {tx.cardFocusLabel}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    marginTop: 3,
                    color: 'var(--ek-text)',
                    fontFamily: 'var(--ek-font-serif)',
                    fontStyle: 'italic',
                  }}
                >
                  {tx.cardFocus}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 16,
                borderTop: '1px solid var(--ek-border)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 11,
                  color: 'var(--ek-text-muted)',
                }}
              >
                {tx.cardYears}
              </span>
              <span
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 10,
                  color: 'var(--ek-red)',
                  letterSpacing: '0.06em',
                }}
              >
                EK · MAESTRO
              </span>
            </div>
          </motion.div>
        </div>

        {/* Network strip — full width */}
        <div
          style={{
            marginTop: 'clamp(48px, 6vw, 80px)',
            paddingTop: 32,
            borderTop: '1px solid var(--ek-border)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 11,
              color: 'var(--ek-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 16,
            }}
          >
            {tx.networkLabel}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {tx.cities.map((c) => (
              <span
                key={c}
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 13,
                  letterSpacing: '0.04em',
                  padding: '8px 14px',
                  border: '1px solid var(--ek-border)',
                  borderRadius: 999,
                  color: 'var(--ek-text-soft)',
                  background: 'var(--ek-paper-warm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--ek-red)',
                    display: 'inline-block',
                  }}
                />
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
