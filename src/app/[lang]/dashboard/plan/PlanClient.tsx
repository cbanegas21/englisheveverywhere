'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CreditCard, ChevronDown } from 'lucide-react'
import { createCheckoutSession } from '@/app/actions/stripe'
import { savePreferredCurrency } from '@/app/actions/profile'
import { PRICING_PLANS } from '@/lib/pricing'
import { useCurrency } from '@/lib/useCurrency'
import CurrencySelect from '@/components/CurrencySelect'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { DarkHeroCard } from '@/components/ui/DarkHeroCard'
import Modal from '@/components/dashboard/Modal'

interface Props {
  lang: Locale
  currentPlan: string | null
  subscriptionStatus: string | null
  renewalDate: string | null
  classesRemaining: number
  intakeDone: boolean
  initialCurrency?: string
}

const T = {
  en: {
    title: 'My plan',
    subtitle: 'Monthly packs · No auto-renewal · Classes never expire',
    currency: 'Currency',
    classesLeft: 'classes available',
    currentPlanLabel: 'Current plan',
    freePlanName: 'No active plan',
    freePlanSub: 'Pick a plan below to start learning.',
    renewsOn: 'Renews on',
    statusActive: 'Active',
    statusTrialing: 'Trial',
    statusCancelled: 'Cancelled',
    statusPastDue: 'Past due',
    manageSub: 'Manage subscription',
    manageSubSoon: 'Coming soon',
    comparePlans: 'Choose another plan',
    perMonth: '/ month',
    classes: 'classes',
    perClassEach: 'per class',
    popular: 'Most popular',
    select: 'Get started',
    upgrade: 'Upgrade',
    downgrade: 'Downgrade',
    current: '✓ Current plan',
    plans: { spark: 'Departure', drive: 'Journey', ascent: 'Ascent', peak: 'Summit' } as Record<string, string>,
    tags: {
      spark: 'Start the habit',
      drive: 'A month of consistency',
      ascent: 'Real progress',
      peak: 'Maximum exposure',
    } as Record<string, string>,
    // Plans differ ONLY in classes/month and price. Everything else is
    // identical — listing tiered features here would be aspirational
    // (overclaim). Render the shared list once via includedFeatures
    // below the comparison grid.
    includedKicker: 'Same in every plan',
    includedTitle: 'What you get, regardless of pack:',
    includedFeatures: [
      { label: '60-minute classes', sub: '1 to 1, live on video' },
      { label: 'Certified teacher', sub: 'Hand-matched to your level and goals' },
      { label: 'Classes never expire', sub: 'Use them at your pace, no deadlines' },
      { label: 'No auto-renewal', sub: 'Pay once, then pay again only if you want' },
    ] as Array<{ label: string; sub: string }>,
    faqTitle: 'Frequently asked',
    faqs: [
      { q: 'Do unused classes expire?', a: 'No. They stack month to month while your plan is active.' },
      { q: 'Can I cancel?', a: 'Yes, anytime. You keep access through the end of the current period.' },
      { q: 'Change plans?', a: 'Upgrades are immediate. Downgrades apply at the next renewal.' },
    ],
    billingTitle: 'Your payments',
    billingEmpty: 'No payments yet. Once you start a plan, receipts will appear here.',
    confirmTitle: 'Confirm purchase',
    confirmPlan: 'Plan',
    confirmClasses: 'Classes',
    confirmPrice: 'Price',
    confirmLead: 'Your teacher, your schedule, your pace.',
    confirmNote: 'Secure one-time payment via Stripe — no subscription, no hidden charges. You can book your first class the moment you finish.',
    payNow: 'Pay now',
    paying: 'Processing…',
    cancelPay: 'Cancel',
    successKicker: 'Payment confirmed',
    successTitle: 'Purchase complete!',
    successSub: (n: number) => `${n} ${n === 1 ? 'class has' : 'classes have'} been added to your account.`,
    successCta: 'Schedule your first class',
    successCtaIntake: 'Complete your learning profile first',
    addMoreTitle: 'Add more classes?',
    addMoreBody: (n: number) => `You still have ${n} class${n === 1 ? '' : 'es'} remaining. Adding a new plan will stack on top of your current balance.`,
    addMoreCurrent: 'Current balance',
    addMoreNew: 'New plan classes',
    addMoreConfirm: 'Yes, add classes',
    addMoreCancel: 'Keep current plan',
  },
  es: {
    title: 'Mi plan',
    subtitle: 'Paquetes mensuales · Sin renovación automática · Las clases no expiran',
    currency: 'Moneda',
    classesLeft: 'clases disponibles',
    currentPlanLabel: 'Plan actual',
    freePlanName: 'Sin plan activo',
    freePlanSub: 'Elige un plan para empezar a aprender.',
    renewsOn: 'Se renueva el',
    statusActive: 'Activo',
    statusTrialing: 'Prueba',
    statusCancelled: 'Cancelado',
    statusPastDue: 'Vencido',
    manageSub: 'Administrar suscripción',
    manageSubSoon: 'Próximamente',
    comparePlans: 'Elige otro plan',
    perMonth: '/ mes',
    classes: 'clases',
    perClassEach: 'por clase',
    popular: 'Más popular',
    select: 'Empezar',
    upgrade: 'Mejorar',
    downgrade: 'Bajar',
    current: '✓ Plan actual',
    plans: { spark: 'Partida', drive: 'Trayecto', ascent: 'Ascenso', peak: 'Cumbre' } as Record<string, string>,
    tags: {
      spark: 'Empieza el hábito',
      drive: 'Un mes de constancia',
      ascent: 'Progreso real',
      peak: 'Máxima exposición',
    } as Record<string, string>,
    includedKicker: 'Lo mismo en cada paquete',
    includedTitle: 'Lo que recibes, sin importar el paquete:',
    includedFeatures: [
      { label: 'Clases de 60 minutos', sub: '1 a 1, en vivo por video' },
      { label: 'Maestro certificado', sub: 'Asignado a tu nivel y metas' },
      { label: 'Las clases nunca caducan', sub: 'Úsalas a tu ritmo, sin fechas límite' },
      { label: 'Sin renovación automática', sub: 'Pagas una vez y vuelves a pagar solo si quieres' },
    ] as Array<{ label: string; sub: string }>,
    faqTitle: 'Preguntas frecuentes',
    faqs: [
      { q: '¿Las clases sin usar expiran?', a: 'No. Se acumulan mes a mes mientras tu plan esté activo.' },
      { q: '¿Puedo cancelar?', a: 'Sí, en cualquier momento. Mantienes acceso hasta el final del periodo.' },
      { q: '¿Cambiar de plan?', a: 'Upgrades son inmediatos. Downgrades aplican en la siguiente renovación.' },
    ],
    billingTitle: 'Tus pagos',
    billingEmpty: 'Aún no hay pagos. Cuando inicies un plan, los recibos aparecerán aquí.',
    confirmTitle: 'Confirmar compra',
    confirmPlan: 'Plan',
    confirmClasses: 'Clases',
    confirmPrice: 'Precio',
    confirmLead: 'Tu maestro, tu horario, tu ritmo.',
    confirmNote: 'Pago único y seguro con Stripe — sin suscripción ni cargos ocultos. Reservas tu primera clase apenas termines.',
    payNow: 'Pagar ahora',
    paying: 'Procesando…',
    cancelPay: 'Cancelar',
    successKicker: 'Pago confirmado',
    successTitle: '¡Compra completada!',
    successSub: (n: number) => `${n === 1 ? '1 clase ha sido agregada' : `${n} clases han sido agregadas`} a tu cuenta.`,
    successCta: 'Agendar tu primera clase',
    successCtaIntake: 'Completa tu perfil de aprendizaje primero',
    addMoreTitle: '¿Agregar más clases?',
    addMoreBody: (n: number) => `Aún tienes ${n} clase${n === 1 ? '' : 's'} disponibles. El nuevo plan se sumará a tu saldo actual.`,
    addMoreCurrent: 'Saldo actual',
    addMoreNew: 'Clases del nuevo plan',
    addMoreConfirm: 'Sí, agregar clases',
    addMoreCancel: 'Mantener plan actual',
  },
}

interface PurchaseResult {
  classesAdded: number
  newTotal: number
  planName: string
}

export default function PlanClient({
  lang,
  currentPlan,
  subscriptionStatus,
  renewalDate,
  classesRemaining,
  intakeDone,
  initialCurrency,
}: Props) {
  const tx = T[lang]
  const accent = 'var(--ek-red)'
  const { currency, changeCurrency, convert } = useCurrency({
    initialCurrency,
    onPersist: async (code) => { await savePreferredCurrency(code) },
  })
  const [isPending, startTransition] = useTransition()
  const [selectedPlan, setSelectedPlan] = useState<(typeof PRICING_PLANS)[number] | null>(null)
  const [pendingPlan, setPendingPlan] = useState<(typeof PRICING_PLANS)[number] | null>(null)
  const [showAddMoreConfirm, setShowAddMoreConfirm] = useState(false)
  const [purchaseResult] = useState<PurchaseResult | null>(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') !== '1') return null
    const plan = PRICING_PLANS.find((p) => p.key === params.get('plan'))
    if (!plan) return null
    return {
      classesAdded: plan.classes,
      // Show the REAL balance the server just fetched (this success screen is a
      // fresh server render after the ?success=1 redirect, so classesRemaining
      // already reflects the webhook credit). The old `classesRemaining +
      // plan.classes` DOUBLE-counted once the webhook had credited.
      newTotal: classesRemaining,
      planName: lang === 'es' ? plan.nameEs : plan.nameEn,
    }
  })
  const [error, setError] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [, forceRender] = useState(0)

  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 1500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1' || params.get('cancelled') === '1') {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  function handleSelectPlan(plan: (typeof PRICING_PLANS)[number]) {
    setError('')
    if (classesRemaining > 0) {
      setPendingPlan(plan)
      setShowAddMoreConfirm(true)
    } else {
      setSelectedPlan(plan)
    }
  }
  function handleConfirmAddMore() { setShowAddMoreConfirm(false); setSelectedPlan(pendingPlan); setPendingPlan(null) }
  function handleCancelAddMore() { setShowAddMoreConfirm(false); setPendingPlan(null) }

  function handlePay() {
    if (!selectedPlan) return
    setError('')
    startTransition(async () => {
      const result = await createCheckoutSession(selectedPlan.key, lang)
      if (result?.error) {
        setError(result.error)
      } else if (result?.url) {
        window.location.href = result.url
      }
    })
  }

  const currentPlanDef = currentPlan
    ? PRICING_PLANS.find((p) => p.key === currentPlan) || null
    : null

  const statusLabel = (() => {
    switch (subscriptionStatus) {
      case 'active': return tx.statusActive
      case 'trialing': return tx.statusTrialing
      case 'cancelled': return tx.statusCancelled
      case 'past_due': return tx.statusPastDue
      default: return null
    }
  })()

  const renewalFormatted = renewalDate
    ? new Date(renewalDate).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  // ── Success screen ────────────────────────────────────────────
  if (purchaseResult) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
        <DashTopBar title={tx.title} sub={tx.subtitle} />
        <div
          style={{
            padding: 24,
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-border)',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              textAlign: 'center',
              fontFamily: 'var(--ek-font-sans)',
            }}
          >
            <div style={{ padding: '40px 24px', background: 'var(--ek-ink)', color: 'var(--ek-on-dark)' }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-on-dark-soft)',
                  fontFamily: 'var(--ek-font-mono)',
                  marginBottom: 14,
                }}
              >
                {tx.successKicker}
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  fontFamily: 'var(--ek-font-serif)',
                }}
              >
                {tx.successTitle}
              </h2>
              <p style={{ marginTop: 8, fontSize: 14, color: 'var(--ek-on-dark-soft)' }}>
                {tx.successSub(purchaseResult.classesAdded)}
              </p>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  borderRadius: 12,
                  padding: 20,
                  background: 'var(--ek-paper)',
                  border: '1px solid var(--ek-border)',
                }}
              >
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: 'var(--ek-text)',
                    fontFeatureSettings: '"tnum"',
                  }}
                >
                  {purchaseResult.newTotal}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    marginTop: 8,
                    color: 'var(--ek-text-muted)',
                  }}
                >
                  {tx.classesLeft}
                </div>
              </div>
              <Link
                href={intakeDone ? `/${lang}/dashboard/agendar` : `/${lang}/dashboard/intake`}
                className="ek-btn ek-btn-red ek-btn-square"
                style={{
                  padding: '14px 0',
                  fontSize: 14,
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                {intakeDone ? tx.successCta : tx.successCtaIntake} →
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Main plan screen ─────────────────────────────────────────
  return (
    <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
      <DashTopBar
        title={tx.title}
        sub={tx.subtitle}
        right={
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 8,
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-border-mid)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ek-text-soft)' }}>
              {tx.currency}:
            </span>
            <CurrencySelect
              value={currency}
              onChange={changeCurrency}
              lang={lang}
              variant="light"
              compact
            />
          </div>
        }
      />

      <div style={{ padding: '28px 36px', maxWidth: 1280, margin: '0 auto' }}>
        {/* Current plan hero */}
        {currentPlanDef ? (
          <DarkHeroCard
            ghost={tx.plans[currentPlanDef.key]?.toLowerCase()}
            ghostSize={320}
            ghostStyle={{ right: -40, bottom: -80, top: 'auto' }}
            padding="32px 36px"
            radius={16}
            style={{ marginBottom: 32 }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 32,
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ek-on-dark-muted)',
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  {tx.currentPlanLabel}
                </div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 'clamp(2.5rem, 4vw, 3rem)',
                    fontWeight: 800,
                    letterSpacing: '-0.035em',
                    lineHeight: 1,
                    color: 'var(--ek-on-dark)',
                  }}
                >
                  {tx.plans[currentPlanDef.key]}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
                  {statusLabel && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.12)',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        color: 'var(--ek-on-dark)',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--ek-success-dot)',
                        }}
                      />
                      {statusLabel}
                    </span>
                  )}
                  {renewalFormatted && (
                    <span style={{ fontSize: 12.5, color: 'var(--ek-on-dark-soft)' }}>
                      {tx.renewsOn} <strong style={{ color: 'var(--ek-on-dark)' }}>{renewalFormatted}</strong>
                    </span>
                  )}
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(244,239,230,0.10)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 12,
                  padding: '20px 28px',
                  textAlign: 'center',
                  minWidth: 200,
                }}
              >
                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: 'var(--ek-on-dark)',
                    letterSpacing: '-0.03em',
                    fontFeatureSettings: '"tnum"',
                  }}
                >
                  {classesRemaining}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--ek-on-dark-muted)',
                    fontWeight: 700,
                    marginTop: 10,
                  }}
                >
                  {tx.classesLeft}
                </div>
              </div>
            </div>
          </DarkHeroCard>
        ) : (
          <div
            style={{
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-border)',
              borderRadius: 16,
              padding: '32px 36px',
              marginBottom: 32,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-muted)',
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              {tx.currentPlanLabel}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(2rem, 3vw, 2.5rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--ek-text)',
              }}
            >
              {tx.freePlanName}
            </h2>
            <p style={{ marginTop: 8, fontSize: 14, color: 'var(--ek-text-soft)' }}>{tx.freePlanSub}</p>
          </div>
        )}

        {/* Plan comparison */}
        <div style={{ marginBottom: 32 }}>
          <h3
            style={{
              margin: '0 0 14px',
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--ek-text)',
              letterSpacing: '-0.02em',
            }}
          >
            {tx.comparePlans}
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {PRICING_PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan
              const name = tx.plans[plan.key]
              const tag = tx.tags[plan.key]
              const perClass = plan.priceUsd / plan.classes
              return (
                <div
                  key={plan.key}
                  style={{
                    background: 'var(--ek-card)',
                    borderRadius: 14,
                    border: `1.5px solid ${plan.highlight ? 'var(--ek-ink)' : 'var(--ek-border)'}`,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    boxShadow: plan.highlight ? '0 12px 30px rgba(17,17,17,0.08)' : 'none',
                  }}
                >
                  {plan.highlight && (
                    <div
                      style={{
                        background: 'var(--ek-ink)',
                        color: 'var(--ek-on-dark)',
                        textAlign: 'center',
                        padding: '6px 0',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {tx.popular}
                    </div>
                  )}
                  <div
                    style={{
                      padding: '20px 20px 22px',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--ek-text-muted)',
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      {plan.classes} {tx.classes} / {lang === 'es' ? 'mes' : 'month'}
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: 'var(--ek-text)',
                        letterSpacing: '-0.02em',
                        marginBottom: 6,
                      }}
                    >
                      {name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginBottom: 16 }}>
                      {tag}
                    </div>

                    <div style={{ marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 38,
                          fontWeight: 800,
                          color: 'var(--ek-text)',
                          letterSpacing: '-0.025em',
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {convert(plan.priceUsd)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginLeft: 4 }}>
                        {tx.perMonth}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--ek-text-muted)',
                        marginBottom: 18,
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      ≈ {convert(perClass)} {tx.perClassEach}
                    </div>

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrent}
                      style={{
                        padding: '11px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isCurrent ? 'default' : 'pointer',
                        marginBottom: 18,
                        border: 0,
                        background: isCurrent
                          ? 'var(--ek-success-bg)'
                          : plan.highlight
                            ? accent
                            : 'var(--ek-ink)',
                        color: isCurrent ? 'var(--ek-success-text)' : '#fff',
                        fontFamily: 'var(--ek-font-sans)',
                      }}
                    >
                      {isCurrent ? tx.current : tx.select}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Shared "Same in every plan" panel — plans differ ONLY in
              classes-per-month and price. Listing tiered features
              (recordings, dedicated advisor, monthly report) on a
              per-card basis was overclaiming features that don't
              actually differ in product. */}
          <div
            style={{
              marginTop: 24,
              padding: '24px 28px',
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
                color: accent,
                marginBottom: 4,
              }}
            >
              {tx.includedKicker}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '-0.015em',
                color: 'var(--ek-text)',
                marginBottom: 18,
              }}
            >
              {tx.includedTitle}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
              }}
            >
              {tx.includedFeatures.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      width: 3,
                      alignSelf: 'stretch',
                      minHeight: 16,
                      borderRadius: 2,
                      background: accent,
                      opacity: 0.7,
                      marginTop: 1,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--ek-text)',
                        lineHeight: 1.3,
                      }}
                    >
                      {f.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--ek-text-muted)',
                        marginTop: 2,
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
          </div>
        </div>

        {/* Billing + FAQ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 20 }}>
          <section
            style={{
              background: 'var(--ek-card)',
              borderRadius: 14,
              border: '1px solid var(--ek-border)',
              overflow: 'hidden',
            }}
          >
            <header style={{ padding: '16px 22px', borderBottom: '1px solid var(--ek-border-soft)' }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                  fontWeight: 700,
                }}
              >
                {lang === 'es' ? 'Historial' : 'History'}
              </div>
              <h4
                style={{
                  margin: '4px 0 0',
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--ek-text)',
                  letterSpacing: '-0.015em',
                }}
              >
                {tx.billingTitle}
              </h4>
            </header>
            <div style={{ padding: '40px 22px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--ek-text-muted)' }}>{tx.billingEmpty}</p>
            </div>
          </section>

          <aside
            style={{
              background: 'var(--ek-card)',
              borderRadius: 14,
              border: '1px solid var(--ek-border)',
              padding: '20px 22px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-muted)',
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              {tx.faqTitle}
            </div>
            {tx.faqs.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <div
                  key={i}
                  style={{
                    borderTop: i > 0 ? '1px solid var(--ek-border-soft)' : 'none',
                    padding: '12px 0',
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      gap: 8,
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      padding: 0,
                      textAlign: 'left',
                      fontFamily: 'var(--ek-font-sans)',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ek-text)' }}>
                      {faq.q}
                    </span>
                    <ChevronDown
                      className="h-3.5 w-3.5"
                      style={{
                        color: 'var(--ek-text-muted)',
                        transition: 'transform 0.18s',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ek-text-soft)', lineHeight: 1.5 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </aside>
        </div>
      </div>

      {/* Add-more confirm — shared centered modal (no transform-centering bug) */}
      <Modal
        open={showAddMoreConfirm && !!pendingPlan}
        onClose={handleCancelAddMore}
        kicker={lang === 'es' ? 'Tus clases se acumulan' : 'Your classes stack'}
        title={tx.addMoreTitle}
        maxWidth={420}
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleCancelAddMore}
              className="ek-btn ek-btn-ghost ek-btn-square"
              style={{ flex: 1, padding: '12px 0', fontSize: 13, justifyContent: 'center' }}
            >
              {tx.addMoreCancel}
            </button>
            <button
              onClick={handleConfirmAddMore}
              className="ek-btn ek-btn-red ek-btn-square"
              style={{ flex: 1, padding: '12px 0', fontSize: 13, justifyContent: 'center' }}
            >
              {tx.addMoreConfirm}
            </button>
          </div>
        }
      >
        {pendingPlan && (
          <>
            <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.55, color: 'var(--ek-text-soft)' }}>
              {tx.addMoreBody(classesRemaining)}
            </p>
            <div
              style={{
                borderTop: '1px solid var(--ek-border)',
                borderBottom: '1px solid var(--ek-border)',
                padding: '14px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
              }}
            >
              <Row label={tx.addMoreCurrent} value={`${classesRemaining} ${tx.classes}`} />
              <Row
                label={tx.addMoreNew}
                value={`+${pendingPlan.classes} ${tx.classes}`}
                valueColor="var(--ek-success-text)"
              />
              <div style={{ height: 1, background: 'var(--ek-border-soft)' }} />
              <Row
                label="Total"
                value={`${classesRemaining + pendingPlan.classes} ${tx.classes}`}
                valueColor={accent}
                bold
              />
            </div>
          </>
        )}
      </Modal>

      {/* Payment confirmation — shared centered modal, sales-forward */}
      <Modal
        open={!!selectedPlan}
        onClose={() => { if (!isPending) setSelectedPlan(null) }}
        kicker={lang === 'es' ? 'Estás a un paso' : "You're one step away"}
        title={selectedPlan ? `${tx.plans[selectedPlan.key]} — ${selectedPlan.classes} ${tx.classes}` : undefined}
        maxWidth={460}
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => { if (!isPending) setSelectedPlan(null) }}
              disabled={isPending}
              className="ek-btn ek-btn-ghost ek-btn-square"
              style={{ flex: 1, padding: '12px 0', fontSize: 13, justifyContent: 'center' }}
            >
              {tx.cancelPay}
            </button>
            <button
              onClick={handlePay}
              disabled={isPending}
              className="ek-btn ek-btn-red ek-btn-square"
              style={{ flex: 1.4, padding: '12px 0', fontSize: 13, justifyContent: 'center', opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? tx.paying : (
                <>
                  <CreditCard className="h-3.5 w-3.5" />
                  {tx.payNow}
                </>
              )}
            </button>
          </div>
        }
      >
        {selectedPlan && (
          <>
            {/* Price — front and centre */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: '4px 10px',
                paddingBottom: 18,
                borderBottom: '1px solid var(--ek-border)',
              }}
            >
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  color: 'var(--ek-text)',
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {convert(selectedPlan.priceUsd)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ek-text-muted)' }}>
                {lang === 'es' ? 'pago único' : 'one payment'} · ≈ {convert(selectedPlan.priceUsd / selectedPlan.classes)} {tx.perClassEach}
              </span>
            </div>

            <p style={{ margin: '14px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--ek-text)', lineHeight: 1.4 }}>
              {tx.confirmLead}
            </p>

            {/* What you get — editorial hairline list, no ✓-squares */}
            <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }}>
              {tx.includedFeatures.map((f, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '11px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--ek-border-soft)',
                  }}
                >
                  <span
                    aria-hidden
                    style={{ width: 3, alignSelf: 'stretch', minHeight: 16, background: accent, opacity: 0.7, borderRadius: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ek-text)' }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 1 }}>{f.sub}</div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Reassurance — the value, not the price */}
            <p
              style={{
                margin: '16px 0 0',
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'italic',
                fontSize: 13.5,
                lineHeight: 1.5,
                color: 'var(--ek-text-soft)',
              }}
            >
              {lang === 'es'
                ? 'No pagas por una clase — pagas por un maestro que es solo tuyo y que recuerda dónde te quedaste.'
                : "You're not paying for a class — you're paying for a teacher who's only yours, who remembers where you left off."}
            </p>

            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ek-text-muted)', lineHeight: 1.5 }}>
              {tx.confirmNote}
            </div>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  fontSize: 12,
                  borderRadius: 8,
                  background: 'var(--ek-red-tint)',
                  border: '1px solid var(--ek-red-tint-3)',
                  color: 'var(--ek-red)',
                }}
              >
                {error}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  valueColor,
}: {
  label: string
  value: string
  bold?: boolean
  valueColor?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--ek-text-muted)' }}>{label}</span>
      <span
        style={{
          fontWeight: bold ? 800 : 600,
          color: valueColor || 'var(--ek-text)',
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value}
      </span>
    </div>
  )
}
