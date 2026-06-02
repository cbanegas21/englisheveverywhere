'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'
import { useCurrency } from '@/lib/useCurrency'
import { PRICING_PLANS } from '@/lib/pricing'

const t = {
  en: {
    eyebrow: '● Plans',
    titleLead: 'Pick your pack.',
    titleAccent: 'Classes never expire.',
    sub: 'One payment per month. No auto-renewal.',
    popular: '★ most chosen',
    perClass: 'per class',
    classes: 'classes',
    perMonth: 'a month',
    includedKicker: '↳ Same in every plan',
    includedTitle: 'What you get, regardless of pack:',
    features: [
      { label: '60-minute classes', sub: '1 to 1, live on video' },
      { label: 'Certified teacher', sub: 'Hand-matched to your level and goals' },
      { label: 'Classes never expire', sub: "Use them at your pace, no deadlines" },
      { label: 'No auto-renewal', sub: 'Pay once, then pay again only if you want' },
    ],
    cta: 'Choose',
    note: '* Classes cancelled with less than 24 hours notice are forfeited.',
    fxNote: (cur: string) =>
      `* Prices shown in ${cur} ≈ USD. Exchange rate updated daily. Charges are always processed in USD.`,
    tags: {
      spark: 'Start the habit',
      drive: 'A month of consistency',
      ascent: 'Real progress',
      peak: 'Maximum exposure',
    } as Record<string, string>,
  },
  es: {
    eyebrow: '● Paquetes',
    titleLead: 'Elige tu paquete.',
    titleAccent: 'Las clases nunca caducan.',
    sub: 'Un solo pago al mes. Sin renovación automática.',
    popular: '★ más elegido',
    perClass: 'por clase',
    classes: 'clases',
    perMonth: 'al mes',
    includedKicker: '↳ Lo mismo en cada paquete',
    includedTitle: 'Lo que recibes, sin importar el paquete:',
    features: [
      { label: 'Clases de 60 minutos', sub: '1 a 1, en vivo por video' },
      { label: 'Maestro certificado', sub: 'Asignado a tu nivel y metas' },
      { label: 'Las clases nunca caducan', sub: 'Úsalas a tu ritmo, sin fechas límite' },
      { label: 'Sin renovación automática', sub: 'Pagas una vez y vuelves a pagar solo si quieres' },
    ],
    cta: 'Elegir',
    note: '* Las clases canceladas con menos de 24h de aviso se pierden.',
    fxNote: (cur: string) =>
      `* Precios mostrados en ${cur} ≈ USD. Tasa de cambio actualizada diariamente. El cobro siempre se realiza en USD.`,
    tags: {
      spark: 'Empieza el hábito',
      drive: 'Un mes de constancia',
      ascent: 'Progreso real',
      peak: 'Máxima exposición',
    } as Record<string, string>,
  },
}

export default function Pricing({ lang }: { lang: Locale }) {
  const tx = t[lang]
  const { convert, currency } = useCurrency()
  const isUsd = currency === 'USD'

  return (
    <section
      id="pricing"
      style={{
        background: 'var(--ek-paper-warm)',
        padding: '96px clamp(24px, 6vw, 80px)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="ek-kicker ek-kicker--red" style={{ justifyContent: 'center' }}>
            {tx.eyebrow}
          </span>
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
            {tx.titleLead}{' '}
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
              marginTop: 16,
              fontSize: 16,
              lineHeight: 1.55,
              color: 'var(--ek-text-soft)',
            }}
          >
            {tx.sub}
          </p>
        </div>

        {!isUsd && (
          <p
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--ek-text-muted)',
              marginBottom: 24,
            }}
          >
            {tx.fxNote(currency)}
          </p>
        )}

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {PRICING_PLANS.map((pack, i) => {
            const hl = pack.highlight
            const name = lang === 'es' ? pack.nameEs : pack.nameEn
            const desc = tx.tags[pack.key]
            const perClass = pack.priceUsd / pack.classes
            const perClassDisplay = isUsd ? `$${perClass.toFixed(2)}` : convert(perClass)
            return (
              <motion.div
                key={pack.key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                style={{
                  padding: 28,
                  background: hl ? 'var(--ek-ink)' : '#fff',
                  color: hl ? '#fff' : 'var(--ek-text)',
                  border: hl ? 'none' : '1px solid var(--ek-border)',
                  borderRadius: 4,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {hl && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: 24,
                      background: 'var(--ek-red)',
                      color: '#fff',
                      padding: '4px 10px',
                      fontSize: 10,
                      fontFamily: 'var(--ek-font-mono)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {tx.popular}
                  </div>
                )}

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: hl ? 'rgba(255,255,255,0.55)' : 'var(--ek-text-muted)',
                    marginTop: 4,
                  }}
                >
                  {desc}
                </div>

                <div
                  style={{
                    marginTop: 32,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 56,
                      fontWeight: 800,
                      letterSpacing: '-0.03em',
                      lineHeight: 1,
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {pack.classes}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: hl ? 'rgba(255,255,255,0.55)' : 'var(--ek-text-muted)',
                      lineHeight: 1.2,
                    }}
                  >
                    {tx.classes}
                    <br />
                    {tx.perMonth}
                  </span>
                </div>

                <div
                  style={{
                    height: 1,
                    background: hl ? 'rgba(255,255,255,0.16)' : 'var(--ek-border)',
                    margin: '28px 0',
                  }}
                />

                <div
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: hl ? '#fff' : 'var(--ek-text)',
                    fontFeatureSettings: '"tnum"',
                  }}
                >
                  {convert(pack.priceUsd)}
                  <span
                    style={{
                      fontSize: 12,
                      color: hl ? 'rgba(255,255,255,0.55)' : 'var(--ek-text-muted)',
                      marginLeft: 6,
                      fontFamily: 'var(--ek-font-sans)',
                    }}
                  >
                    / {lang === 'es' ? 'mes' : 'month'}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 11,
                    color: hl ? 'rgba(255,255,255,0.55)' : 'var(--ek-text-muted)',
                    marginTop: 4,
                  }}
                >
                  ≈ {perClassDisplay} {tx.perClass}
                </div>

                <Link
                  href={`/${lang}/registro`}
                  style={{
                    marginTop: 'auto',
                    paddingTop: 28,
                    width: '100%',
                    textDecoration: 'none',
                    fontFamily: 'var(--ek-font-sans)',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '14px 0',
                      background: hl ? 'var(--ek-red)' : 'transparent',
                      color: hl ? '#fff' : 'var(--ek-text)',
                      border: hl ? 'none' : '1px solid var(--ek-ink)',
                      fontWeight: 600,
                      fontSize: 14,
                      borderRadius: 999,
                      textAlign: 'center',
                    }}
                  >
                    {tx.cta} {name}
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Shared "Included in every plan" panel — replaces the per-card
            feature lists that were identical across all 4 cards (just
            noisy repetition with no differentiation). The four bullets
            are real, the plans are otherwise identical except for the
            class count + price. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{
            marginTop: 32,
            padding: '28px 32px',
            background: 'var(--ek-card)',
            border: '1px solid var(--ek-border)',
            borderRadius: 14,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ek-red)',
              marginBottom: 6,
            }}
          >
            {tx.includedKicker}
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '-0.015em',
              color: 'var(--ek-text)',
              marginBottom: 20,
            }}
          >
            {tx.includedTitle}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 18,
            }}
          >
            {tx.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: 'var(--ek-red-tint-2)',
                    color: 'var(--ek-red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--ek-font-mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    marginTop: 2,
                  }}
                >
                  ✓
                </span>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--ek-text)',
                      lineHeight: 1.3,
                    }}
                  >
                    {f.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--ek-text-muted)',
                      marginTop: 3,
                      lineHeight: 1.45,
                      fontFamily: 'var(--ek-font-serif)',
                      fontStyle: 'italic',
                    }}
                  >
                    {f.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <p
          style={{
            fontSize: 11,
            marginTop: 32,
            textAlign: 'center',
            color: 'var(--ek-text-muted)',
          }}
        >
          {tx.note}
        </p>
      </div>
    </section>
  )
}
