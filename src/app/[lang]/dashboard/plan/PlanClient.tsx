'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2, Check, AlertCircle, ArrowRight, ArrowDown,
  BookOpen, Zap, X, CreditCard, Calendar, Plus, Receipt,
  ChevronDown, Sparkles, TrendingUp,
} from 'lucide-react'
import { simulatePurchase } from '@/app/actions/purchase'
import { savePreferredCurrency } from '@/app/actions/profile'
import { PRICING_PLANS } from '@/lib/pricing'
import { useCurrency } from '@/lib/useCurrency'
import CurrencySelect from '@/components/CurrencySelect'
import type { Locale } from '@/lib/i18n/translations'

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
    title: 'Your Plan',
    subtitle: 'Monthly plans — classes renew every month. Cancel anytime.',
    classesLeft: 'classes remaining',
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
    comparePlans: 'Choose a plan',
    perMonth: '/ month',
    classes: 'classes',
    perClass: 'per class',
    popular: 'Most popular',
    select: 'Get started',
    upgrade: 'Upgrade',
    downgrade: 'Downgrade',
    current: 'Current plan',
    plans: { spark: 'Spark', drive: 'Drive', ascent: 'Ascent', peak: 'Peak' },
    features: {
      spark:  ['8 classes included', 'All teacher access', 'Progress tracking', 'Chat support'],
      drive:  ['12 classes included', 'All teacher access', 'Progress tracking', 'Priority support', 'Session recordings'],
      ascent: ['16 classes included', 'All teacher access', 'Progress tracking', 'Priority support', 'Session recordings', 'Dedicated advisor'],
      peak:   ['20 classes included', 'All teacher access', 'Progress tracking', 'Priority support', 'Session recordings', 'Dedicated advisor', 'Monthly progress report'],
    },
    topUpTitle: 'Need more classes?',
    topUpBody: 'Top-ups stack on top of your monthly balance. Unused classes carry over.',
    topUpCta: 'Add classes',
    faqTitle: 'Common questions',
    faqs: [
      { q: 'How does billing work?', a: 'Plans renew monthly on the same day. Your classes are credited immediately after each successful payment.' },
      { q: 'Can I cancel anytime?', a: "Yes — cancel from the manage-subscription link and you'll keep access through the end of your current billing period." },
      { q: 'Do unused classes expire?', a: "No. Any classes you haven't used carry over month to month for as long as your plan is active." },
      { q: 'Can I change plans mid-month?', a: 'Yes. Upgrades take effect immediately and credits from your current plan are preserved. Downgrades apply at the next renewal.' },
    ],
    billingTitle: 'Billing history',
    billingEmpty: 'No charges yet. Once you start a plan, receipts will appear here.',
    billingDate: 'Date',
    billingDesc: 'Description',
    billingAmount: 'Amount',
    billingStatus: 'Status',
    confirmTitle: 'Confirm Purchase',
    confirmPlan: 'Plan',
    confirmClasses: 'Classes',
    confirmPrice: 'Price',
    confirmNote: 'This is a simulated purchase. No real charge is made.',
    payNow: 'Pay Now',
    paying: 'Processing…',
    cancelPay: 'Cancel',
    successTitle: 'Purchase Complete!',
    successSub: (n: number) => `${n} classes have been added to your account.`,
    successCta: 'Schedule Your First Class',
    successCtaIntake: 'Complete Your Learning Profile First',
    addMoreTitle: 'Add more classes?',
    addMoreBody: (n: number) => `You still have ${n} class${n === 1 ? '' : 'es'} remaining. Adding a new plan will stack on top of your current balance.`,
    addMoreCurrent: 'Current balance',
    addMoreNew: 'New plan classes',
    addMoreConfirm: 'Yes, add classes',
    addMoreCancel: 'Keep current plan',
  },
  es: {
    title: 'Tu Plan',
    subtitle: 'Planes mensuales — las clases se renuevan cada mes. Cancela cuando quieras.',
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
    comparePlans: 'Elige un plan',
    perMonth: '/ mes',
    classes: 'clases',
    perClass: 'por clase',
    popular: 'Más popular',
    select: 'Empezar',
    upgrade: 'Mejorar',
    downgrade: 'Bajar plan',
    current: 'Plan actual',
    plans: { spark: 'Chispa', drive: 'Impulso', ascent: 'Ascenso', peak: 'Cima' },
    features: {
      spark:  ['8 clases incluidas', 'Acceso a todos los maestros', 'Seguimiento de progreso', 'Soporte por chat'],
      drive:  ['12 clases incluidas', 'Acceso a todos los maestros', 'Seguimiento de progreso', 'Soporte prioritario', 'Grabaciones de sesiones'],
      ascent: ['16 clases incluidas', 'Acceso a todos los maestros', 'Seguimiento de progreso', 'Soporte prioritario', 'Grabaciones de sesiones', 'Asesor dedicado'],
      peak:   ['20 clases incluidas', 'Acceso a todos los maestros', 'Seguimiento de progreso', 'Soporte prioritario', 'Grabaciones de sesiones', 'Asesor dedicado', 'Informe mensual de progreso'],
    },
    topUpTitle: '¿Necesitas más clases?',
    topUpBody: 'Los top-ups se suman a tu saldo mensual. Las clases sin usar se acumulan.',
    topUpCta: 'Agregar clases',
    faqTitle: 'Preguntas frecuentes',
    faqs: [
      { q: '¿Cómo funciona el cobro?', a: 'Los planes se renuevan mensualmente el mismo día. Tus clases se acreditan justo después de cada pago exitoso.' },
      { q: '¿Puedo cancelar cuando quiera?', a: 'Sí — cancela desde el enlace de administrar suscripción y mantendrás acceso hasta el final de tu periodo actual.' },
      { q: '¿Vencen las clases sin usar?', a: 'No. Las clases sin usar se acumulan mes a mes mientras tu plan esté activo.' },
      { q: '¿Puedo cambiar de plan a mitad de mes?', a: 'Sí. Los upgrades son inmediatos y conservas los créditos del plan actual. Los downgrades aplican en la siguiente renovación.' },
    ],
    billingTitle: 'Historial de pagos',
    billingEmpty: 'Aún no hay cobros. Cuando inicies un plan, los recibos aparecerán aquí.',
    billingDate: 'Fecha',
    billingDesc: 'Descripción',
    billingAmount: 'Monto',
    billingStatus: 'Estado',
    confirmTitle: 'Confirmar Compra',
    confirmPlan: 'Plan',
    confirmClasses: 'Clases',
    confirmPrice: 'Precio',
    confirmNote: 'Esta es una compra simulada. No se realizará ningún cargo real.',
    payNow: 'Pagar Ahora',
    paying: 'Procesando…',
    cancelPay: 'Cancelar',
    successTitle: '¡Compra Completada!',
    successSub: (n: number) => `${n} clases han sido agregadas a tu cuenta.`,
    successCta: 'Agendar tu Primera Clase',
    successCtaIntake: 'Completa tu Perfil de Aprendizaje Primero',
    addMoreTitle: '¿Agregar más clases?',
    addMoreBody: (n: number) => `Aún tienes ${n} clase${n === 1 ? '' : 's'} disponibles. El nuevo plan se sumará a tu saldo actual.`,
    addMoreCurrent: 'Saldo actual',
    addMoreNew: 'Clases del nuevo plan',
    addMoreConfirm: 'Sí, agregar clases',
    addMoreCancel: 'Mantener plan actual',
  },
}

const PLAN_ICONS: Record<string, typeof BookOpen> = {
  spark: Sparkles,
  drive: Zap,
  ascent: TrendingUp,
  peak: Zap,
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
  const { currency, changeCurrency, convert } = useCurrency({
    initialCurrency,
    onPersist: async (code) => { await savePreferredCurrency(code) },
  })
  const [isPending, startTransition] = useTransition()
  const [selectedPlan, setSelectedPlan] = useState<(typeof PRICING_PLANS)[number] | null>(null)
  const [pendingPlan, setPendingPlan] = useState<(typeof PRICING_PLANS)[number] | null>(null)
  const [showAddMoreConfirm, setShowAddMoreConfirm] = useState(false)
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null)
  const [error, setError] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [, forceRender] = useState(0)

  // Re-render once FX rates settle so prices in non-USD currencies populate.
  useEffect(() => {
    const id = setInterval(() => forceRender(n => n + 1), 1500)
    return () => clearInterval(id)
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

  function handleConfirmAddMore() {
    setShowAddMoreConfirm(false)
    setSelectedPlan(pendingPlan)
    setPendingPlan(null)
  }

  function handleCancelAddMore() {
    setShowAddMoreConfirm(false)
    setPendingPlan(null)
  }

  function handlePay() {
    if (!selectedPlan) return
    setError('')
    startTransition(async () => {
      const result = await simulatePurchase(selectedPlan.key, lang)
      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setSelectedPlan(null)
        setPurchaseResult({
          classesAdded: result.classesAdded,
          newTotal: result.newTotal,
          planName: result.planName,
        })
      }
    })
  }

  const currentPlanDef = currentPlan
    ? PRICING_PLANS.find(p => p.key === currentPlan) || null
    : null

  const statusLabel = (() => {
    switch (subscriptionStatus) {
      case 'active':    return tx.statusActive
      case 'trialing':  return tx.statusTrialing
      case 'cancelled': return tx.statusCancelled
      case 'past_due':  return tx.statusPastDue
      default: return null
    }
  })()

  const renewalFormatted = renewalDate
    ? new Date(renewalDate).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  // ── Success screen ────────────────────────────────────────────
  if (purchaseResult) {
    return (
      <div className="min-h-full" style={{ background: '#F9F9F9' }}>
        <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <div className="max-w-[1440px] mx-auto">
            <h1 className="text-[22px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full max-w-[440px] rounded-3xl overflow-hidden text-center"
            style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}
          >
            <div className="py-10 px-6" style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-[22px] font-black text-white mb-1">{tx.successTitle}</h2>
              <p className="text-[14px] text-white/80">{tx.successSub(purchaseResult.classesAdded)}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-5" style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}>
                <div className="text-[42px] font-black leading-none" style={{ color: '#111111' }}>
                  {purchaseResult.newTotal}
                </div>
                <div className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{tx.classesLeft}</div>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span style={{ color: '#9CA3AF' }}>{tx.confirmPlan}</span>
                <span className="font-semibold" style={{ color: '#111111' }}>{purchaseResult.planName}</span>
              </div>
              <Link
                href={intakeDone ? `/${lang}/dashboard/agendar` : `/${lang}/dashboard/intake`}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-lg font-bold text-[14px] transition-all"
                style={{ background: '#C41E3A', color: '#fff' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
              >
                <Calendar className="h-4 w-4" />
                {intakeDone ? tx.successCta : tx.successCtaIntake}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Main plan screen ─────────────────────────────────────────
  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div className="px-6 lg:px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div className="max-w-[1440px] mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: '#111111' }}>{tx.title}</h1>
            <p className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
          </div>
          <CurrencySelect value={currency} onChange={changeCurrency} lang={lang} />
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8 grid gap-6 lg:grid-cols-[1fr_340px]">

        {/* Left column */}
        <div className="space-y-6 min-w-0">

          {/* Current plan hero */}
          <CurrentPlanHero
            lang={lang}
            planName={currentPlanDef ? tx.plans[currentPlanDef.key as keyof typeof tx.plans] : null}
            classesRemaining={classesRemaining}
            statusLabel={statusLabel}
            renewalFormatted={renewalFormatted}
          />

          {/* Plan comparison */}
          <section id="plans" style={{ scrollMarginTop: 24 }}>
            <h2 className="text-[16px] font-black mb-4" style={{ color: '#111111' }}>{tx.comparePlans}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRICING_PLANS.map((plan) => {
                const isCurrent = plan.key === currentPlan
                const features = tx.features[plan.key as keyof typeof tx.features]
                const planName = tx.plans[plan.key as keyof typeof tx.plans]
                const currentIdx = currentPlanDef ? PRICING_PLANS.findIndex(p => p.key === currentPlanDef.key) : -1
                const planIdx = PRICING_PLANS.findIndex(p => p.key === plan.key)
                const action: 'select' | 'upgrade' | 'downgrade' | 'current' =
                  isCurrent ? 'current'
                  : currentIdx < 0 ? 'select'
                  : planIdx > currentIdx ? 'upgrade'
                  : 'downgrade'
                const Icon = PLAN_ICONS[plan.key] || BookOpen
                const perClass = plan.priceUsd / plan.classes
                return (
                  <div
                    key={plan.key}
                    className="rounded-2xl overflow-hidden relative flex flex-col"
                    style={{
                      background: '#fff',
                      border: `1.5px solid ${plan.highlight ? '#111111' : '#E5E7EB'}`,
                      boxShadow: plan.highlight ? '0 10px 30px rgba(17,17,17,0.1)' : '0 2px 6px rgba(0,0,0,0.04)',
                    }}
                  >
                    {plan.highlight && (
                      <div
                        className="text-[10px] font-bold text-center py-1.5 tracking-widest uppercase"
                        style={{ background: '#111111', color: '#F9F9F9' }}
                      >
                        {tx.popular}
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center"
                          style={{ background: plan.highlight ? 'rgba(196,30,58,0.12)' : 'rgba(196,30,58,0.08)' }}
                        >
                          <Icon className="h-4 w-4" style={{ color: '#C41E3A' }} />
                        </div>
                        <h3 className="text-[15px] font-black" style={{ color: '#111111' }}>{planName}</h3>
                      </div>

                      <div className="flex items-baseline gap-1 mb-0.5">
                        <span className="text-[32px] font-black leading-none" style={{ color: '#111111' }}>
                          {convert(plan.priceUsd)}
                        </span>
                        <span className="text-[12px]" style={{ color: '#9CA3AF' }}>{tx.perMonth}</span>
                      </div>
                      <p className="text-[11px] mb-4" style={{ color: '#9CA3AF' }}>
                        {plan.classes} {tx.classes} · {convert(perClass)} {tx.perClass}
                      </p>

                      <button
                        onClick={() => handleSelectPlan(plan)}
                        disabled={action === 'current'}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[12px] transition-all mb-5 disabled:opacity-60"
                        style={
                          action === 'current'
                            ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }
                          : action === 'downgrade'
                            ? { background: '#F9F9F9', color: '#374151', border: '1px solid #E5E7EB' }
                          : plan.highlight
                            ? { background: '#C41E3A', color: '#fff' }
                          : { background: '#111111', color: '#F9F9F9' }
                        }
                        onMouseEnter={e => {
                          if (action === 'current') return
                          if (action === 'downgrade') e.currentTarget.style.background = '#F3F4F6'
                          else if (plan.highlight) e.currentTarget.style.background = '#9E1830'
                          else e.currentTarget.style.background = '#2D2D2D'
                        }}
                        onMouseLeave={e => {
                          if (action === 'current') return
                          if (action === 'downgrade') e.currentTarget.style.background = '#F9F9F9'
                          else if (plan.highlight) e.currentTarget.style.background = '#C41E3A'
                          else e.currentTarget.style.background = '#111111'
                        }}
                      >
                        {action === 'current' && <><CheckCircle2 className="h-3.5 w-3.5" /> {tx.current}</>}
                        {action === 'select'   && <>{tx.select} <ArrowRight className="h-3 w-3" /></>}
                        {action === 'upgrade'  && <><ArrowRight className="h-3 w-3" /> {tx.upgrade}</>}
                        {action === 'downgrade' && <><ArrowDown className="h-3 w-3" /> {tx.downgrade}</>}
                      </button>

                      <ul className="space-y-2 mt-auto">
                        {features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: '#C41E3A' }} strokeWidth={3} />
                            <span className="text-[12px] leading-snug" style={{ color: '#4B5563' }}>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Billing history */}
          <section className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
            <div className="px-6 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <Receipt className="h-4 w-4" style={{ color: '#9CA3AF' }} />
              <h2 className="text-[15px] font-black" style={{ color: '#111111' }}>{tx.billingTitle}</h2>
            </div>
            {/* TODO (Phase 4): pull from Stripe invoices API once live keys are set.
                  Until then the history table is intentionally empty-state. */}
            <div className="p-10 text-center">
              <Receipt className="h-8 w-8 mx-auto mb-3" style={{ color: '#E5E7EB' }} />
              <p className="text-[13px]" style={{ color: '#6B7280' }}>{tx.billingEmpty}</p>
            </div>
          </section>
        </div>

        {/* Right column — sidebar */}
        <aside className="space-y-6">

          {/* Top-up card */}
          <div
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #C41E3A, #8B1529)' }}
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="absolute -right-4 bottom-0 h-20 w-20 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="relative">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                <Plus className="h-3 w-3 text-white" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">{lang === 'es' ? 'Top-up' : 'Top up'}</span>
              </div>
              <h3 className="text-[17px] font-black text-white leading-tight mb-2">{tx.topUpTitle}</h3>
              <p className="text-[12px] text-white/80 leading-relaxed mb-4">{tx.topUpBody}</p>
              <a
                href="#plans"
                onClick={(e) => {
                  e.preventDefault()
                  const el = document.getElementById('plans')
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                }}
                className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg text-[12px] font-bold transition-all"
                style={{ background: '#fff', color: '#C41E3A' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#F9F9F9')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#fff')}
              >
                {tx.topUpCta}
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* FAQ */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <h3 className="text-[14px] font-black" style={{ color: '#111111' }}>{tx.faqTitle}</h3>
            </div>
            <div>
              {tx.faqs.map((faq, i) => {
                const isOpen = openFaq === i
                return (
                  <div key={i} style={{ borderBottom: i < tx.faqs.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="text-[12px] font-bold leading-tight" style={{ color: '#111111' }}>{faq.q}</span>
                      <ChevronDown
                        className="h-3.5 w-3.5 flex-shrink-0 transition-transform"
                        style={{ color: '#9CA3AF', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-[12px] leading-relaxed" style={{ color: '#4B5563' }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Add-more-classes confirmation modal */}
      <AnimatePresence>
        {showAddMoreConfirm && pendingPlan && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={handleCancelAddMore}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(17,17,17,0.55)', backdropFilter: 'blur(3px)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{ background: '#fff' }}
            >
              <div className="px-6 pt-6 pb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4" style={{ background: 'rgba(196,30,58,0.08)' }}>
                  <AlertCircle className="h-5 w-5" style={{ color: '#C41E3A' }} />
                </div>
                <h3 className="font-bold text-[16px] mb-2" style={{ color: '#111111' }}>{tx.addMoreTitle}</h3>
                <p className="text-[13px] leading-relaxed mb-5" style={{ color: '#4B5563' }}>
                  {tx.addMoreBody(classesRemaining)}
                </p>
                <div className="rounded-xl p-4 mb-5 space-y-2" style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span style={{ color: '#9CA3AF' }}>{tx.addMoreCurrent}</span>
                    <span className="font-bold" style={{ color: '#111111' }}>{classesRemaining} {tx.classes}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span style={{ color: '#9CA3AF' }}>{tx.addMoreNew}</span>
                    <span className="font-bold" style={{ color: '#16A34A' }}>+{pendingPlan.classes} {tx.classes}</span>
                  </div>
                  <div className="h-px" style={{ background: '#E5E7EB' }} />
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold" style={{ color: '#111111' }}>Total</span>
                    <span className="font-black" style={{ color: '#C41E3A' }}>
                      {classesRemaining + pendingPlan.classes} {tx.classes}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleCancelAddMore} className="flex-1 py-3 rounded-lg font-medium text-[13px] transition-all" style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#F9F9F9' }}>{tx.addMoreCancel}</button>
                  <button onClick={handleConfirmAddMore} className="flex-1 py-3 rounded-lg font-bold text-[13px] transition-all" style={{ background: '#C41E3A', color: '#fff' }}>{tx.addMoreConfirm}</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Payment confirmation modal */}
      <AnimatePresence>
        {selectedPlan && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isPending && setSelectedPlan(null)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(17,17,17,0.55)', backdropFilter: 'blur(3px)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{ background: '#fff' }}
            >
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" style={{ color: '#C41E3A' }} />
                  <h3 className="font-bold text-[15px]" style={{ color: '#111111' }}>{tx.confirmTitle}</h3>
                </div>
                <button onClick={() => !isPending && setSelectedPlan(null)} disabled={isPending} style={{ color: '#9CA3AF' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-6 pt-5 pb-4 space-y-3">
                {[
                  [tx.confirmPlan, tx.plans[selectedPlan.key as keyof typeof tx.plans]],
                  [tx.confirmClasses, `${selectedPlan.classes} ${tx.classes}`],
                  [tx.confirmPrice, convert(selectedPlan.priceUsd)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: '#9CA3AF' }}>{label}</span>
                    <span className="font-semibold" style={{ color: '#111111' }}>{value}</span>
                  </div>
                ))}
                <div className="mt-1 pt-3 flex items-start gap-2 text-[11px] rounded-lg p-3" style={{ background: '#F9F9F9', borderTop: '1px solid #E5E7EB', color: '#9CA3AF' }}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
                  {tx.confirmNote}
                </div>
              </div>
              {error && (
                <div className="mx-6 mb-3 rounded p-3 text-[12px]" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}>
                  {error}
                </div>
              )}
              <div className="flex gap-3 px-6 pb-6">
                <button onClick={() => !isPending && setSelectedPlan(null)} disabled={isPending} className="flex-1 py-3 rounded-lg font-medium text-[13px]" style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#F9F9F9' }}>
                  {tx.cancelPay}
                </button>
                <button onClick={handlePay} disabled={isPending} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[13px] disabled:opacity-60" style={{ background: '#C41E3A', color: '#fff' }}>
                  {isPending ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      {tx.paying}
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-3.5 w-3.5" />
                      {tx.payNow}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function CurrentPlanHero({
  lang,
  planName,
  classesRemaining,
  statusLabel,
  renewalFormatted,
}: {
  lang: Locale
  planName: string | null
  classesRemaining: number
  statusLabel: string | null
  renewalFormatted: string | null
}) {
  const tx = T[lang]
  const hasPlan = !!planName

  return (
    <div
      className="rounded-3xl overflow-hidden relative"
      style={{
        background: hasPlan ? 'linear-gradient(135deg, #C41E3A, #8B1529)' : '#fff',
        border: hasPlan ? 'none' : '1px solid #E5E7EB',
        boxShadow: hasPlan ? '0 20px 60px rgba(196,30,58,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {hasPlan && (
        <>
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="absolute -right-8 bottom-0 h-40 w-40 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </>
      )}
      <div className="relative p-6 lg:p-8 grid gap-5 md:grid-cols-[1fr_auto] items-center">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-2"
            style={{ color: hasPlan ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}
          >
            {tx.currentPlanLabel}
          </p>
          <h2
            className="text-[26px] lg:text-[32px] font-black leading-tight mb-1"
            style={{ color: hasPlan ? '#fff' : '#111111' }}
          >
            {planName || tx.freePlanName}
          </h2>
          {!hasPlan && (
            <p className="text-[13px]" style={{ color: '#6B7280' }}>{tx.freePlanSub}</p>
          )}
          {hasPlan && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {statusLabel && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  {statusLabel}
                </span>
              )}
              {renewalFormatted && (
                <span className="text-[12px] text-white/80">
                  {tx.renewsOn} <strong className="text-white">{renewalFormatted}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        <div
          className="rounded-2xl p-5 text-center"
          style={{
            background: hasPlan ? 'rgba(255,255,255,0.12)' : '#F9F9F9',
            backdropFilter: hasPlan ? 'blur(8px)' : undefined,
            minWidth: '180px',
          }}
        >
          <div
            className="text-[44px] font-black leading-none tabular-nums"
            style={{ color: hasPlan ? '#fff' : '#C41E3A' }}
          >
            {classesRemaining}
          </div>
          <div
            className="text-[11px] font-semibold uppercase tracking-widest mt-2"
            style={{ color: hasPlan ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}
          >
            {tx.classesLeft}
          </div>
        </div>
      </div>

      {hasPlan && (
        <div className="relative px-6 lg:px-8 pb-5 flex items-center justify-end">
          {/* TODO (Phase 4): wire to Stripe Billing Portal via customer_id lookup. */}
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold transition-all opacity-70"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'not-allowed' }}
          >
            <CreditCard className="h-3.5 w-3.5" />
            {tx.manageSub}
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'rgba(255,255,255,0.15)' }}>
              {tx.manageSubSoon}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
