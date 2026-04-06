'use client'

import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2, Check, AlertCircle, ArrowRight,
  BookOpen, Star, Zap, X, CreditCard, Calendar,
} from 'lucide-react'
import { simulatePurchase, HNL_RATE } from '@/app/actions/purchase'
import type { Locale } from '@/lib/i18n/translations'
import Link from 'next/link'

interface Props {
  lang: Locale
  currentPlan: string | null
  subscriptionStatus: string | null
  classesRemaining: number
  intakeDone: boolean
}

const t = {
  en: {
    title: 'Your Plan',
    subtitle: 'Choose the pack that fits your learning rhythm.',
    currentPlan: 'Current plan',
    classesLeft: 'classes remaining',
    choosePlan: 'Choose a plan',
    upgrade: 'Add more classes',
    current: 'Current plan',
    select: 'Get started',
    perMonth: '/pack',
    classes: 'classes',
    perClass: 'per class',
    popular: 'Most popular',
    plans: { starter: 'Starter', estandar: 'Standard', intensivo: 'Intensive' },
    features: {
      starter:   ['4 classes included', 'All teacher access', 'Progress tracking', 'Chat support'],
      estandar:  ['8 classes included', 'All teacher access', 'Progress tracking', 'Priority support', 'Session recordings'],
      intensivo: ['16 classes included', 'All teacher access', 'Progress tracking', 'Priority support', 'Session recordings', 'Dedicated advisor'],
    },
    // Payment modal
    confirmTitle: 'Confirm Purchase',
    confirmPlan: 'Plan',
    confirmClasses: 'Classes',
    confirmPriceUsd: 'Price (USD)',
    confirmPriceHnl: 'Price (HNL)',
    confirmNote: 'This is a simulated purchase. No real charge is made.',
    payNow: 'Pay Now',
    paying: 'Processing…',
    cancelPay: 'Cancel',
    // Success screen
    successTitle: 'Purchase Complete!',
    successSub: (n: number) => `${n} classes have been added to your account.`,
    successCta: 'Schedule Your First Class',
    successCtaIntake: 'Complete Your Learning Profile First',
    addMore: 'Add more classes',
  },
  es: {
    title: 'Tu Plan',
    subtitle: 'Elige el pack que se adapta a tu ritmo de aprendizaje.',
    currentPlan: 'Plan actual',
    classesLeft: 'clases disponibles',
    choosePlan: 'Elige un plan',
    upgrade: 'Agregar más clases',
    current: 'Plan actual',
    select: 'Empezar',
    perMonth: '/pack',
    classes: 'clases',
    perClass: 'por clase',
    popular: 'Más popular',
    plans: { starter: 'Inicial', estandar: 'Estándar', intensivo: 'Intensivo' },
    features: {
      starter:   ['4 clases incluidas', 'Acceso a todos los maestros', 'Seguimiento de progreso', 'Soporte por chat'],
      estandar:  ['8 clases incluidas', 'Acceso a todos los maestros', 'Seguimiento de progreso', 'Soporte prioritario', 'Grabaciones de sesiones'],
      intensivo: ['16 clases incluidas', 'Acceso a todos los maestros', 'Seguimiento de progreso', 'Soporte prioritario', 'Grabaciones de sesiones', 'Asesor dedicado'],
    },
    confirmTitle: 'Confirmar Compra',
    confirmPlan: 'Plan',
    confirmClasses: 'Clases',
    confirmPriceUsd: 'Precio (USD)',
    confirmPriceHnl: 'Precio (HNL)',
    confirmNote: 'Esta es una compra simulada. No se realizará ningún cargo real.',
    payNow: 'Pagar Ahora',
    paying: 'Procesando…',
    cancelPay: 'Cancelar',
    successTitle: '¡Compra Completada!',
    successSub: (n: number) => `${n} clases han sido agregadas a tu cuenta.`,
    successCta: 'Agendar tu Primera Clase',
    successCtaIntake: 'Completa tu Perfil de Aprendizaje Primero',
    addMore: 'Agregar más clases',
  },
}

const PLANS = [
  { key: 'starter',  priceUsd: 39,  classes: 4,  icon: BookOpen },
  { key: 'estandar', priceUsd: 69,  classes: 8,  icon: Star, popular: true },
  { key: 'intensivo',priceUsd: 119, classes: 16, icon: Zap },
]

interface PurchaseResult {
  classesAdded: number
  newTotal: number
  planName: string
}

export default function PlanClient({ lang, currentPlan, classesRemaining, intakeDone }: Props) {
  const tx = t[lang]
  const [isPending, startTransition] = useTransition()
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null)
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null)
  const [error, setError] = useState('')

  function handleSelectPlan(plan: typeof PLANS[0]) {
    setError('')
    setSelectedPlan(plan)
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

  // ── Success screen ────────────────────────────────────────────
  if (purchaseResult) {
    return (
      <div className="min-h-full" style={{ background: '#F9F9F9' }}>
        <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        </div>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full max-w-[420px] rounded-2xl overflow-hidden text-center"
            style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}
          >
            {/* Green top strip */}
            <div className="py-8 px-6" style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-[22px] font-black text-white mb-1">{tx.successTitle}</h2>
              <p className="text-[14px] text-white/80">{tx.successSub(purchaseResult.classesAdded)}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Classes counter */}
              <div
                className="rounded-xl p-5"
                style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
              >
                <div className="text-[42px] font-black leading-none" style={{ color: '#111111' }}>
                  {purchaseResult.newTotal}
                </div>
                <div className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{tx.classesLeft}</div>
              </div>

              {/* Plan info */}
              <div className="flex items-center justify-between text-[13px]">
                <span style={{ color: '#9CA3AF' }}>{tx.confirmPlan}</span>
                <span className="font-semibold" style={{ color: '#111111' }}>{purchaseResult.planName}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span style={{ color: '#9CA3AF' }}>{lang === 'es' ? 'Clases agregadas' : 'Classes added'}</span>
                <span className="font-semibold" style={{ color: '#16A34A' }}>+{purchaseResult.classesAdded}</span>
              </div>

              {/* CTA */}
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

  // ── Plan selection ────────────────────────────────────────────
  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-6">

        {/* Current classes bar */}
        {classesRemaining > 0 && (
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded flex-shrink-0"
              style={{ background: 'rgba(196,30,58,0.08)' }}
            >
              <BookOpen className="h-4 w-4" style={{ color: '#C41E3A' }} />
            </div>
            <div className="flex-1">
              <span className="text-[11px] block mb-0.5" style={{ color: '#9CA3AF' }}>{tx.currentPlan}</span>
              <span className="text-[14px] font-semibold" style={{ color: '#111111' }}>
                {currentPlan ? tx.plans[currentPlan as keyof typeof tx.plans] : tx.choosePlan}
              </span>
            </div>
            <div className="text-right">
              <div className="text-[22px] font-black" style={{ color: '#111111' }}>{classesRemaining}</div>
              <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.classesLeft}</div>
            </div>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.key === currentPlan
            const features = tx.features[plan.key as keyof typeof tx.features]
            const planName = tx.plans[plan.key as keyof typeof tx.plans]
            const priceHnl = Math.round(plan.priceUsd * HNL_RATE)
            const pricePerClassUsd = (plan.priceUsd / plan.classes).toFixed(0)

            return (
              <div
                key={plan.key}
                className="rounded-xl overflow-hidden relative"
                style={{
                  background: '#fff',
                  border: `2px solid ${plan.popular ? '#111111' : '#E5E7EB'}`,
                }}
              >
                {plan.popular && (
                  <div
                    className="text-[10px] font-bold text-center py-1.5 tracking-wide uppercase"
                    style={{ background: '#111111', color: '#F9F9F9' }}
                  >
                    {tx.popular}
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-[15px] font-bold mb-3" style={{ color: '#111111' }}>{planName}</h3>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-[32px] font-black" style={{ color: '#111111' }}>${plan.priceUsd}</span>
                    <span className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.perMonth}</span>
                  </div>
                  <p className="text-[12px] mb-1" style={{ color: '#9CA3AF' }}>
                    {plan.classes} {tx.classes} · ${pricePerClassUsd} {tx.perClass}
                  </p>
                  <p className="text-[11px] mb-5 font-medium" style={{ color: '#C41E3A' }}>
                    ≈ L {priceHnl.toLocaleString()} HNL
                  </p>

                  {/* CTA */}
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isCurrent}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded font-semibold text-[13px] transition-all mb-5 disabled:opacity-60"
                    style={
                      plan.popular
                        ? { background: '#111111', color: '#F9F9F9' }
                        : { border: '1px solid #E5E7EB', background: '#F9F9F9', color: '#111111' }
                    }
                    onMouseEnter={e => {
                      if (!isCurrent && plan.popular) e.currentTarget.style.background = '#2D1F0A'
                      else if (!isCurrent) e.currentTarget.style.background = '#F3F4F6'
                    }}
                    onMouseLeave={e => {
                      if (!isCurrent && plan.popular) e.currentTarget.style.background = '#111111'
                      else if (!isCurrent) e.currentTarget.style.background = '#F9F9F9'
                    }}
                  >
                    {isCurrent
                      ? <><CheckCircle2 className="h-4 w-4" /> {tx.current}</>
                      : <>{currentPlan ? tx.upgrade : tx.select} <ArrowRight className="h-3.5 w-3.5" /></>
                    }
                  </button>

                  {/* Features */}
                  <ul className="space-y-2.5">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <div
                          className="h-4 w-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: 'rgba(196,30,58,0.08)' }}
                        >
                          <Check className="h-2.5 w-2.5" style={{ color: '#C41E3A' }} strokeWidth={2.5} />
                        </div>
                        <span className="text-[12px]" style={{ color: '#4B5563' }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment confirmation modal */}
      <AnimatePresence>
        {selectedPlan && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isPending && setSelectedPlan(null)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(17,17,17,0.5)', backdropFilter: 'blur(2px)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{ background: '#fff' }}
            >
              {/* Modal header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid #E5E7EB' }}
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" style={{ color: '#C41E3A' }} />
                  <h3 className="font-bold text-[15px]" style={{ color: '#111111' }}>{tx.confirmTitle}</h3>
                </div>
                <button
                  onClick={() => !isPending && setSelectedPlan(null)}
                  disabled={isPending}
                  className="transition-colors disabled:opacity-40"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Plan summary */}
              <div className="px-6 pt-5 pb-4 space-y-3">
                {[
                  [tx.confirmPlan, tx.plans[selectedPlan.key as keyof typeof tx.plans]],
                  [tx.confirmClasses, `${selectedPlan.classes} ${tx.classes}`],
                  [tx.confirmPriceUsd, `$${selectedPlan.priceUsd} USD`],
                  [tx.confirmPriceHnl, `L ${Math.round(selectedPlan.priceUsd * HNL_RATE).toLocaleString()} HNL`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: '#9CA3AF' }}>{label}</span>
                    <span className="font-semibold" style={{ color: '#111111' }}>{value}</span>
                  </div>
                ))}

                <div
                  className="mt-1 pt-3 flex items-start gap-2 text-[11px] rounded-lg p-3"
                  style={{ background: '#F9F9F9', borderTop: '1px solid #E5E7EB', color: '#9CA3AF' }}
                >
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
                  {tx.confirmNote}
                </div>
              </div>

              {error && (
                <div
                  className="mx-6 mb-3 rounded p-3 text-[12px]"
                  style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}
                >
                  {error}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => !isPending && setSelectedPlan(null)}
                  disabled={isPending}
                  className="flex-1 py-3 rounded font-medium text-[13px] transition-all"
                  style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#F9F9F9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F9F9F9')}
                >
                  {tx.cancelPay}
                </button>
                <button
                  onClick={handlePay}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded font-bold text-[13px] transition-all disabled:opacity-60"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#9E1830' }}
                  onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = '#C41E3A' }}
                >
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
