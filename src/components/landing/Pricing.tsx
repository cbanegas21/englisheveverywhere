'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'
import { useCurrency } from '@/lib/useCurrency'

// Price-free plan shape passed in from the SERVER page. The full PRICING_PLANS
// (which carries priceUsd per pack) is NEVER imported here — importing it into a
// 'use client' component ships the pack prices into the public JS bundle, defeating
// the gated-pricing funnel (anyone could read margin + pack structure from devtools).
// Only names + class counts + the single precomputed soft anchor are public.
type PublicPlan = { key: string; nameEn: string; nameEs: string; classes: number; highlight: boolean }

const t = {
  en: {
    eyebrow: 'Plans',
    titleLead: 'Find the plan',
    titleAccent: 'for your schedule.',
    sub: 'Four sizes, one promise: a teacher who’s only yours and classes that never expire. Pick the one that fits how many classes you can take each month.',
    anchorPrefix: '1-on-1 classes from',
    findCta: 'Get started',
    findSub: 'Create your account and see your exact price.',
    riskFree: 'Your first diagnostic call is free.',
    popular: 'most chosen',
    perClass: 'per class',
    classes: 'classes',
    perPack: 'one-time',
    priceCaption: 'one payment',
    includedKicker: 'In every pack',
    includedTitle: 'Every pack includes',
    includedLead: 'The class count is the only difference. Everything that makes the learning work is the same in all four.',
    reassure: {
      lead: "You're not paying for a class.",
      body: "You're paying for a teacher who's only yours — who knows you, remembers your progress and answers every question. A ten-student group can't do that.",
    },
    consistency: {
      lead: 'Classes never expire — but your consistency is what moves you forward.',
      body: 'Learning English is a habit: the more regularly you take your classes, the faster you progress. Your classes wait as long as you need — your best progress just comes when you keep the rhythm.',
    },
    features: [
      { label: '60-minute classes', sub: 'One to one, live on video — the full hour is yours.' },
      { label: 'Your own certified teacher', sub: 'Hand-matched to your level and goals, so every minute is about you.' },
      { label: 'An AI notebook for your classes', sub: 'A summary of your class, the new vocabulary and a note on your progress — saved so you can review anytime.' },
      { label: 'Pay securely by card, in the app', sub: 'Checkout right here — no transfers, no extra apps. Your classes are ready the moment you pay.' },
      { label: 'Classes never expire', sub: 'Use them at your pace — no deadlines, no pressure.' },
      { label: 'Packs stack, never renew', sub: 'Pay once. Buy another pack only when you want more.' },
    ],
    cta: 'Start',
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
    eyebrow: 'Paquetes',
    titleLead: 'Encuentra el plan',
    titleAccent: 'según tu disponibilidad.',
    sub: 'Cuatro tamaños, una promesa: un maestro que es solo tuyo y clases que nunca caducan. Elige según cuántas clases puedas tomar al mes.',
    anchorPrefix: 'Clases 1-a-1 desde',
    findCta: 'Empieza ahora',
    findSub: 'Crea tu cuenta y verás tu precio exacto.',
    riskFree: 'Tu primera llamada de diagnóstico es gratis.',
    popular: 'más elegido',
    perClass: 'por clase',
    classes: 'clases',
    perPack: 'pago único',
    priceCaption: 'un solo pago',
    includedKicker: 'En cada paquete',
    includedTitle: 'Todo paquete incluye',
    includedLead: 'Lo único que cambia es el número de clases. Todo lo que hace que aprendas es igual en los cuatro.',
    reassure: {
      lead: 'No pagas por una clase.',
      body: 'Pagas por un maestro que es solo tuyo — te conoce, recuerda tu progreso y responde cada pregunta. Eso una clase de diez no lo da.',
    },
    consistency: {
      lead: 'Las clases no caducan, pero tu constancia sí cuenta.',
      body: 'Aprender inglés es un hábito: mientras más seguido tomas tus clases, más rápido avanzas. Tus clases te esperan el tiempo que necesites — tu mejor progreso llega cuando mantienes el ritmo.',
    },
    features: [
      { label: 'Clases de 60 minutos', sub: '1 a 1, en vivo por video — la hora completa es tuya.' },
      { label: 'Tu propio maestro certificado', sub: 'Asignado según tu nivel y metas, para que cada minuto sea sobre ti.' },
      { label: 'Cuaderno IA de tus clases', sub: 'Un resumen de tu clase, el vocabulario nuevo y una nota de tu progreso — guardados para repasar cuando quieras.' },
      { label: 'Paga con tarjeta, seguro y en la app', sub: 'Pagas aquí mismo — sin transferencias ni apps extra. Tus clases quedan listas al instante.' },
      { label: 'Las clases nunca caducan', sub: 'Úsalas a tu ritmo — sin fechas límite, sin presión.' },
      { label: 'Los paquetes se acumulan, no se renuevan', sub: 'Pagas una vez. Compras otro paquete solo cuando quieras más.' },
    ],
    cta: 'Empieza',
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

export default function Pricing({ lang, plans, minPerClass }: { lang: Locale; plans: PublicPlan[]; minPerClass: number }) {
  const tx = t[lang]
  const { convert, currency, loading } = useCurrency()
  const isUsd = currency === 'USD'
  // Until FX rates load, convert() falls back to a 1:1 rate, which would render a
  // non-USD currency at the USD magnitude (e.g. "L 129" instead of ~"L 3,200") —
  // understating the price ~20x. Show the real USD price (what's actually charged)
  // until the rate arrives, then enrich to the local-currency approximation.
  const fxPending = !isUsd && loading
  // Soft anchor — show ONLY the lowest per-class equivalent (no pack prices, no
  // structure, no margin). The best-evidenced lever for converting without a
  // public price; the real plan prices are revealed after signup. `minPerClass`
  // is precomputed on the SERVER (from priceUsd) and passed in, so the priced
  // PRICING_PLANS never reaches the public client bundle.
  const anchorDisplay = (isUsd || fxPending) ? `$${minPerClass}` : convert(minPerClass)

  return (
    <section
      id="pricing"
      className="lk-section-y"
      style={{
        background: 'var(--ek-paper-warm)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div className="lk-shell">
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
            className="ek-body"
            style={{
              marginTop: 16,
              maxWidth: 560,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {tx.sub}
          </p>
        </div>

        {/* Gate on !fxPending too: on a returning non-USD visitor's first client
            render FX is still loading (fxPending true) and SSR defaulted to USD, so
            without this the note appears only on the client → React #418 hydration
            mismatch. Once rates load it renders normally. */}
        {!isUsd && !fxPending && (
          <p
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--ek-text-muted)',
              marginBottom: 24,
            }}
          >
            {tx.fxNote(currency)}
          </p>
        )}

        <style>{`
          .lk-plangrid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
          }
          @media (min-width: 600px) {
            .lk-plangrid { grid-template-columns: repeat(2, 1fr); }
          }
          @media (min-width: 1040px) {
            .lk-plangrid { grid-template-columns: repeat(4, 1fr); }
          }
        `}</style>
        <div className="lk-plangrid">
          {plans.map((pack, i) => {
            const hl = pack.highlight
            const name = lang === 'es' ? pack.nameEs : pack.nameEn
            const desc = tx.tags[pack.key]
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
                  borderRadius: 'var(--ek-radius-lg)',
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
                    {tx.cta}
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Soft anchor + the single primary CTA → sign-up (the goal quiz was
            removed — we convince on the page). Only the lowest per-class number is
            public; full plan prices are revealed after signup (gated funnel). */}
        <div style={{ marginTop: 'clamp(36px, 5vw, 56px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 13, color: 'var(--ek-text-muted)', letterSpacing: '0.02em' }}>
            {tx.anchorPrefix} <span style={{ color: 'var(--ek-text)', fontWeight: 700 }}>{anchorDisplay}</span> {tx.perClass}
          </div>
          <Link href={`/${lang}/registro`} style={{ textDecoration: 'none' }}>
            <span style={{ display: 'inline-block', padding: '15px 34px', background: 'var(--ek-red)', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 999, fontFamily: 'var(--ek-font-sans)' }}>
              {tx.findCta} →
            </span>
          </Link>
          <div style={{ fontSize: 13.5, color: 'var(--ek-text-muted)', lineHeight: 1.55, maxWidth: 400 }}>
            {tx.findSub}<br /><span style={{ color: 'var(--ek-red)', fontWeight: 600 }}>{tx.riskFree}</span>
          </div>
        </div>

        {/* Shared "Every pack includes" panel — replaces the per-card
            feature lists that were identical across all 4 cards (just
            noisy repetition with no differentiation). The four bullets
            are real; the plans are otherwise identical except for the
            class count + price. De-AI pass (LK2-07): glyph tiles and the
            boxed/bordered card dropped for a hairline-ruled typographic
            list — mono index numerals + bold label + serif-italic sub —
            and the price-justification line set as a serif-italic footnote
            under a single rule, no colored quote bar. */}
        <style>{`
          .lk-pricing-panel {
            margin-top: clamp(28px, 4vw, 44px);
            padding-top: clamp(28px, 4vw, 44px);
            border-top: 1px solid var(--ek-border-mid);
          }
          .lk-pricing-head {
            display: grid;
            grid-template-columns: 1.05fr 1fr;
            gap: clamp(16px, 4vw, 56px);
            align-items: end;
            margin-bottom: clamp(28px, 4vw, 40px);
          }
          .lk-pricing-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0 clamp(24px, 4vw, 56px);
            border-top: 1px solid var(--ek-border-mid);
          }
          .lk-pricing-feature {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 16px;
            align-items: baseline;
            padding: clamp(18px, 2.4vw, 24px) 0;
            border-top: 1px solid var(--ek-border);
          }
          /* Top row of each column sits directly under the grid's own
             hairline — drop the per-row rule there to avoid doubling. */
          .lk-pricing-feature:nth-child(1),
          .lk-pricing-feature:nth-child(2) { border-top: none; }
          .lk-pricing-index {
            font-family: var(--ek-font-mono);
            font-size: 13px;
            font-weight: 500;
            letter-spacing: 0.04em;
            color: var(--ek-red);
            font-feature-settings: "tnum";
            line-height: 1;
          }
          .lk-pricing-reassure {
            margin-top: clamp(28px, 4vw, 40px);
            padding-top: clamp(22px, 3vw, 28px);
            border-top: 1px solid var(--ek-border);
          }
          @media (max-width: 760px) {
            .lk-pricing-head { grid-template-columns: 1fr; align-items: start; gap: 12px; }
            .lk-pricing-grid { grid-template-columns: 1fr; }
            /* single column — only the very first row hugs the head rule */
            .lk-pricing-feature:nth-child(2) { border-top: 1px solid var(--ek-border); }
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
                className="ek-microlabel"
                style={{ color: 'var(--ek-red)', marginBottom: 10 }}
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
                <span aria-hidden="true" className="lk-pricing-index">
                  {String(i + 1).padStart(2, '0')}
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
                      fontFamily: 'var(--ek-font-serif)',
                      fontStyle: 'italic',
                      fontSize: 16,
                      fontWeight: 500,
                      color: 'var(--ek-text-soft)',
                      marginTop: 5,
                      lineHeight: 1.5,
                    }}
                  >
                    {f.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lk-pricing-reassure" style={{ textAlign: 'center' }}>
            <p
              style={{
                margin: '0 auto',
                maxWidth: '52ch',
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(1.05rem, 1.6vw, 1.3rem)',
                lineHeight: 1.5,
                letterSpacing: '-0.01em',
                color: 'var(--ek-text-soft)',
              }}
            >
              <span
                style={{
                  color: 'var(--ek-text)',
                  fontWeight: 600,
                  fontStyle: 'normal',
                  fontFamily: 'var(--ek-font-sans)',
                }}
              >
                {tx.reassure.lead}
              </span>{' '}
              {tx.reassure.body}
            </p>
          </div>

          {/* "Tu constancia importa" (A11) — balances "classes never expire": they
              don't, but consistency is what drives progress. Set apart from the
              teacher-value reassure with a hairline + a red lead. */}
          <div
            style={{
              marginTop: 'clamp(22px, 3vw, 28px)',
              paddingTop: 'clamp(22px, 3vw, 28px)',
              borderTop: '1px solid var(--ek-border)',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                margin: '0 auto',
                maxWidth: '54ch',
                fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)',
                lineHeight: 1.55,
                color: 'var(--ek-text-soft)',
              }}
            >
              <span
                style={{
                  color: 'var(--ek-red)',
                  fontWeight: 700,
                  fontFamily: 'var(--ek-font-sans)',
                }}
              >
                {tx.consistency.lead}
              </span>{' '}
              {tx.consistency.body}
            </p>
          </div>
        </motion.div>

        <p
          style={{
            fontSize: 13,
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
