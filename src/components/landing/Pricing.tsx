'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Check } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { useCurrency } from '@/lib/useCurrency'
import { PRICING_PLANS } from '@/lib/pricing'

const t = {
  en: {
    label: 'Transparent pricing',
    title: 'One price.\nNo surprises.',
    sub: 'Pay once. No subscriptions, no auto-renewals, no hidden fees. Your classes never expire.',
    popular: 'Most popular',
    classes: 'classes',
    perClass: 'per class',
    cta: 'Get started',
    note: '* Classes without 24-hour notice of cancellation are forfeited.',
    included: 'Included in every pack',
    features: [
      'Live 1-on-1 session via video',
      'Near-native bilingual teacher',
      'AI post-class summary + vocabulary',
      'CEFR level check every 4 classes',
      'Structured curriculum (Interchange + custom)',
    ],
    packDescs: {
      spark:  'Start the habit. See it work.',
      drive:  'A full month of real consistency.',
      ascent: 'Serious progress, serious results.',
      peak:   'Maximum exposure, maximum growth.',
    },
  },
  es: {
    label: 'Precios transparentes',
    title: 'Un precio.\nSin sorpresas.',
    sub: 'Paga una vez. Sin suscripciones, sin renovación automática, sin cargos ocultos. Tus clases nunca vencen.',
    popular: 'Más popular',
    classes: 'clases',
    perClass: 'por clase',
    cta: 'Comenzar',
    note: '* Las clases sin aviso de cancelación de 24 horas se pierden.',
    included: 'Incluido en todos los packs',
    features: [
      'Sesión 1-a-1 en vivo por video',
      'Maestro bilingüe near-native',
      'Resumen post-clase con IA + vocabulario',
      'Revisión de nivel CEFR cada 4 clases',
      'Currículo estructurado (Interchange + propio)',
    ],
    packDescs: {
      spark:  'Empieza el hábito. Compruébalo.',
      drive:  'Un mes completo de constancia real.',
      ascent: 'Progreso serio, resultados serios.',
      peak:   'Máxima exposición, máximo crecimiento.',
    },
  },
}

export default function Pricing({ lang }: { lang: Locale }) {
  const tx = t[lang]
  const { convert, currency } = useCurrency()

  return (
    <section id="pricing" style={{ background: '#F9F9F9', borderTop: '1px solid #E5E7EB' }}>
      <div className="max-w-6xl mx-auto px-6 py-24">

        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
          <div>
            <motion.p
              className="ee-label-light mb-4"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            >
              {tx.label}
            </motion.p>
            <motion.h2
              className="font-black whitespace-pre-line"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: '#111111', lineHeight: 1.1 }}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.05 }}
            >
              {tx.title}
            </motion.h2>
          </div>
          <div className="flex items-end">
            <motion.p
              className="ee-body max-w-md"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }} transition={{ delay: 0.1 }}
            >
              {tx.sub}
            </motion.p>
          </div>
        </div>

        {/* Currency note */}
        {currency !== 'USD' && (
          <p className="text-[12px] mb-6" style={{ color: '#9CA3AF' }}>
            {lang === 'es'
              ? `* Precios mostrados en ${currency}. Tasa de cambio actualizada diariamente.`
              : `* Prices shown in ${currency}. Exchange rate updated daily.`
            }
          </p>
        )}

        {/* Pack cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {PRICING_PLANS.map((pack, i) => {
            const hl = pack.highlight
            const name = lang === 'es' ? pack.nameEs : pack.nameEn
            const desc = tx.packDescs[pack.key as keyof typeof tx.packDescs]
            const perClassUSD = (pack.priceUsd / pack.classes).toFixed(2)
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                className="rounded overflow-hidden flex flex-col"
                style={{
                  background: hl ? '#111111' : '#fff',
                  border: hl ? '1px solid #111111' : '1px solid #E5E7EB',
                  boxShadow: hl ? '0 12px 40px rgba(17,17,17,0.25)' : '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                {/* Header */}
                <div
                  className="px-5 pt-5 pb-4"
                  style={{ borderBottom: `1px solid ${hl ? 'rgba(255,255,255,0.08)' : '#E5E7EB'}` }}
                >
                  {hl && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded block w-fit mb-3"
                      style={{ background: '#C41E3A', color: '#fff' }}
                    >
                      {tx.popular}
                    </span>
                  )}
                  <p
                    className="text-[11px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: hl ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }}
                  >
                    {name}
                  </p>
                  <div className="text-4xl font-black" style={{ color: hl ? '#F9F9F9' : '#111111' }}>
                    {convert(pack.priceUsd)}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: hl ? 'rgba(255,255,255,0.3)' : '#9CA3AF' }}>
                    {lang === 'es' ? '/ mes' : '/ month'}
                  </p>
                  <p className="text-[12px] font-semibold mt-1" style={{ color: '#C41E3A' }}>
                    {currency === 'USD' ? `$${perClassUSD}` : convert(parseFloat(perClassUSD))} {tx.perClass}
                  </p>
                </div>

                {/* Classes + desc */}
                <div className="px-5 py-4 flex-1">
                  <p className="text-3xl font-black mb-0.5" style={{ color: hl ? '#F9F9F9' : '#111111' }}>
                    {pack.classes}
                  </p>
                  <p
                    className="text-[11px] font-bold uppercase tracking-wide mb-3"
                    style={{ color: hl ? 'rgba(255,255,255,0.3)' : '#9CA3AF' }}
                  >
                    {tx.classes}
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: hl ? 'rgba(255,255,255,0.45)' : '#4B5563' }}>
                    {desc}
                  </p>
                </div>

                {/* CTA */}
                <div className="px-5 pb-5">
                  <Link
                    href={`/${lang}/registro`}
                    className="block text-center text-[13px] font-bold py-2.5 rounded transition-all"
                    style={
                      hl
                        ? { background: '#C41E3A', color: '#fff' }
                        : { background: '#F3F4F6', color: '#111111', border: '1px solid #E5E7EB' }
                    }
                    onMouseEnter={e => {
                      if (hl) (e.currentTarget as HTMLAnchorElement).style.background = '#9E1830'
                      else (e.currentTarget as HTMLAnchorElement).style.background = '#E5E7EB'
                    }}
                    onMouseLeave={e => {
                      if (hl) (e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A'
                      else (e.currentTarget as HTMLAnchorElement).style.background = '#F3F4F6'
                    }}
                  >
                    {tx.cta}
                  </Link>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* What's included */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded p-6"
          style={{ background: '#fff', border: '1px solid #E5E7EB' }}
        >
          <p className="ee-label-light mb-5">{tx.included}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tx.features.map((f) => (
              <div key={f} className="flex items-start gap-3">
                <div
                  className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(196,30,58,0.08)', border: '1px solid rgba(196,30,58,0.15)' }}
                >
                  <Check className="h-3 w-3" style={{ color: '#C41E3A' }} />
                </div>
                <span className="text-[13px] leading-relaxed" style={{ color: '#111111' }}>{f}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="text-[11px] mt-5 text-center" style={{ color: '#9CA3AF' }}>{tx.note}</p>
      </div>
    </section>
  )
}
