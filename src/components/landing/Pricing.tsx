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
    sub: 'Pay once per pack — buy as many as you like. Your classes stack and never expire. No subscription, no auto-renewal.',
    popular: '★ most chosen',
    perClass: 'per class',
    classes: 'classes',
    perPack: 'one-time',
    priceCaption: 'one payment',
    includedKicker: '↳ In every pack',
    includedTitle: 'Every pack includes',
    includedLead: 'The class count is the only difference. Everything that makes the learning work is the same in all four.',
    reassure: {
      lead: 'If the price feels like a lot, remember what it buys:',
      body: 'your own teacher who actually knows you and answers your questions — not a crowded group class, and not a marketplace where you are one of ten students.',
    },
    features: [
      { icon: '◷', label: '60-minute classes', sub: 'One to one, live on video — the full hour is yours.' },
      { icon: '✶', label: 'Your own certified teacher', sub: 'Hand-matched to your level and goals, so every minute is about you.' },
      { icon: '∞', label: 'Classes never expire', sub: 'Use them at your pace — no deadlines, no pressure.' },
      { icon: '⟳', label: 'Packs stack, never renew', sub: 'Pay once. Buy another pack only when you want more.' },
    ],
    cta: 'Choose',
    note: '* Classes cancelled with less than 24 hours notice are forfeited.',
    fxNote: (cur: string) =>
      `* Prices shown in ${cur} ≈ USD. Exchange rate updated daily. Charges are always processed in USD.`,
    tags: {
      spark: 'Start the habit',
      drive: 'Build consistency',
      ascent: 'Real progress',
      peak: 'Maximum exposure',
    } as Record<string, string>,
  },
  es: {
    eyebrow: '● Paquetes',
    titleLead: 'Elige tu paquete.',
    titleAccent: 'Las clases nunca caducan.',
    sub: 'Paga una vez por paquete — compra los que quieras. Tus clases se acumulan y nunca caducan. Sin suscripción, sin renovación automática.',
    popular: '★ más elegido',
    perClass: 'por clase',
    classes: 'clases',
    perPack: 'pago único',
    priceCaption: 'un solo pago',
    includedKicker: '↳ En cada paquete',
    includedTitle: 'Todo paquete incluye',
    includedLead: 'Lo único que cambia es el número de clases. Todo lo que hace que aprendas es igual en los cuatro.',
    reassure: {
      lead: 'Si el precio te parece alto, recuerda lo que incluye:',
      body: 'tu propio maestro que de verdad te conoce y responde tus preguntas — no una clase grupal llena, ni un marketplace donde eres uno de diez estudiantes.',
    },
    features: [
      { icon: '◷', label: 'Clases de 60 minutos', sub: '1 a 1, en vivo por video — la hora completa es tuya.' },
      { icon: '✶', label: 'Tu propio maestro certificado', sub: 'Asignado según tu nivel y metas, para que cada minuto sea sobre ti.' },
      { icon: '∞', label: 'Las clases nunca caducan', sub: 'Úsalas a tu ritmo — sin fechas límite, sin presión.' },
      { icon: '⟳', label: 'Los paquetes se acumulan, no se renuevan', sub: 'Pagas una vez. Compras otro paquete solo cuando quieras más.' },
    ],
    cta: 'Elegir',
    note: '* Las clases canceladas con menos de 24h de aviso se pierden.',
    fxNote: (cur: string) =>
      `* Precios mostrados en ${cur} ≈ USD. Tasa de cambio actualizada diariamente. El cobro siempre se realiza en USD.`,
    tags: {
      spark: 'Empieza el hábito',
      drive: 'Gana constancia',
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
              maxWidth: 560,
              marginLeft: 'auto',
              marginRight: 'auto',
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
                    {tx.perPack}
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
                    {tx.priceCaption}
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

        {/* Shared "Every pack includes" panel — replaces the per-card
            feature lists that were identical across all 4 cards (just
            noisy repetition with no differentiation). The four bullets
            are real, the plans are otherwise identical except for the
            class count + price. Elevated (LK-11): stronger header
            hierarchy, real iconography, and a 1-to-1 value reassurance
            line that justifies the price without bashing competitors. */}
        <style>{`
          .lk-pricing-panel {
            margin-top: 32px;
            padding: clamp(28px, 4vw, 44px);
            background:
              radial-gradient(120% 140% at 0% 0%, var(--ek-red-tint) 0%, transparent 46%),
              var(--ek-card);
            border: 1px solid var(--ek-border);
            border-radius: var(--ek-radius-lg);
            box-shadow: 0 1px 2px rgba(17,17,17,0.03), 0 18px 48px -36px rgba(17,17,17,0.28);
          }
          .lk-pricing-head {
            display: grid;
            grid-template-columns: 1.05fr 1fr;
            gap: clamp(16px, 4vw, 56px);
            align-items: end;
            padding-bottom: clamp(22px, 3vw, 30px);
            margin-bottom: clamp(22px, 3vw, 30px);
            border-bottom: 1px solid var(--ek-border);
          }
          .lk-pricing-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: clamp(16px, 2.4vw, 26px) clamp(20px, 3vw, 40px);
          }
          .lk-pricing-feature { display: flex; gap: 14px; align-items: flex-start; }
          .lk-pricing-icon {
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            border-radius: var(--ek-radius-md);
            background: var(--ek-red-tint-2);
            color: var(--ek-red);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 19px;
            line-height: 1;
            border: 1px solid var(--ek-red-tint-3);
            transition: background 0.2s ease, transform 0.2s ease;
          }
          .lk-pricing-feature:hover .lk-pricing-icon {
            background: var(--ek-red);
            color: #fff;
            transform: translateY(-1px);
          }
          .lk-pricing-reassure {
            display: flex;
            gap: 14px;
            align-items: flex-start;
            margin-top: clamp(24px, 3vw, 32px);
            padding-top: clamp(22px, 3vw, 28px);
            border-top: 1px solid var(--ek-border);
          }
          .lk-pricing-reassure-rule {
            flex-shrink: 0;
            width: 3px;
            align-self: stretch;
            min-height: 38px;
            border-radius: 999px;
            background: var(--ek-red);
          }
          @media (max-width: 760px) {
            .lk-pricing-head { grid-template-columns: 1fr; align-items: start; gap: 12px; }
            .lk-pricing-grid { grid-template-columns: 1fr; }
          }
        `}</style>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="lk-pricing-panel"
        >
          <div className="lk-pricing-head">
            <div>
              <div
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-red)',
                  marginBottom: 10,
                }}
              >
                {tx.includedKicker}
              </div>
              <div
                style={{
                  fontFamily: 'var(--ek-font-sans)',
                  fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.05,
                  color: 'var(--ek-text)',
                }}
              >
                {tx.includedTitle}
              </div>
            </div>
            <p
              style={{
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(1rem, 1.5vw, 1.15rem)',
                lineHeight: 1.45,
                color: 'var(--ek-text-soft)',
                margin: 0,
              }}
            >
              {tx.includedLead}
            </p>
          </div>

          <div className="lk-pricing-grid">
            {tx.features.map((f, i) => (
              <div key={i} className="lk-pricing-feature">
                <span aria-hidden="true" className="lk-pricing-icon">
                  {f.icon}
                </span>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--ek-text)',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.3,
                    }}
                  >
                    {f.label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--ek-text-soft)',
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    {f.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lk-pricing-reassure">
            <span aria-hidden="true" className="lk-pricing-reassure-rule" />
            <p
              style={{
                margin: 0,
                fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
                lineHeight: 1.55,
                color: 'var(--ek-text-soft)',
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--ek-text)' }}>{tx.reassure.lead}</span>{' '}
              {tx.reassure.body}
            </p>
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
