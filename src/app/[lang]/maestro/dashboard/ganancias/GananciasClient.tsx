'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  DollarSign, TrendingUp, Calendar, CreditCard, ExternalLink,
  CheckCircle2, Zap
} from 'lucide-react'
import { createStripeConnectLink } from '@/app/actions/stripe'
import type { Locale } from '@/lib/i18n/translations'

interface Payment {
  amount_usd: number
  teacher_payout_usd: number
  created_at: string
}

interface Props {
  lang: Locale
  hourlyRate: number
  totalSessions: number
  thisMonthEarnings: number
  allTimeEarnings: number
  recentPayments: Payment[]
  hasStripeAccount: boolean
  justConnected: boolean
}

const t = {
  en: {
    title: 'Earnings',
    subtitle: 'Track your income and connect Stripe to receive payouts.',
    thisMonth: 'This month',
    allTime: 'All time',
    sessions: 'Total sessions',
    rate: 'Your rate',
    perHour: '/hr',
    keep85: 'You keep 85%',
    recentPayments: 'Recent payments',
    noPayments: 'No payments yet. Complete sessions to start earning.',
    connectStripe: 'Connect Stripe to get paid',
    connectSub: 'Connect your Stripe account to receive automatic payouts after each session.',
    connectBtn: 'Connect Stripe',
    connecting: 'Redirecting to Stripe...',
    connected: 'Stripe account connected!',
    stripeConnected: 'Stripe connected',
    stripeConnectedSub: 'Your account is set up to receive payouts.',
    howItWorks: 'How payouts work',
    step1: 'Student books a class',
    step2: 'You teach the session',
    step3: 'You receive 85% within 2 business days',
    usd: 'USD',
  },
  es: {
    title: 'Ganancias',
    subtitle: 'Monitorea tus ingresos y conecta Stripe para recibir pagos.',
    thisMonth: 'Este mes',
    allTime: 'Total ganancias',
    sessions: 'Sesiones totales',
    rate: 'Tu tarifa',
    perHour: '/hr',
    keep85: 'Recibes el 85%',
    recentPayments: 'Pagos recientes',
    noPayments: 'Sin pagos aún. Completa sesiones para empezar a ganar.',
    connectStripe: 'Conecta Stripe para recibir pagos',
    connectSub: 'Conecta tu cuenta de Stripe para recibir pagos automáticos después de cada sesión.',
    connectBtn: 'Conectar Stripe',
    connecting: 'Redirigiendo a Stripe...',
    connected: '¡Cuenta de Stripe conectada!',
    stripeConnected: 'Stripe conectado',
    stripeConnectedSub: 'Tu cuenta está configurada para recibir pagos.',
    howItWorks: 'Cómo funcionan los pagos',
    step1: 'Estudiante reserva una clase',
    step2: 'Tú impartes la sesión',
    step3: 'Recibes el 85% en 2 días hábiles',
    usd: 'USD',
  },
}

export default function GananciasClient({
  lang, hourlyRate, totalSessions, thisMonthEarnings, allTimeEarnings,
  recentPayments, hasStripeAccount, justConnected
}: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleConnectStripe() {
    startTransition(async () => {
      const result = await createStripeConnectLink(lang)
      if (result?.url) router.push(result.url)
    })
  }

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto space-y-6">

        {/* Connected banner */}
        <AnimatePresence>
          {justConnected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}
            >
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: '#16A34A' }} />
              <p className="text-[13px] font-semibold" style={{ color: '#16A34A' }}>{tx.connected}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: tx.thisMonth, value: `$${thisMonthEarnings.toFixed(0)}`, sub: tx.usd, icon: DollarSign },
            { label: tx.allTime, value: `$${allTimeEarnings.toFixed(0)}`, sub: tx.usd, icon: TrendingUp },
            { label: tx.sessions, value: totalSessions, icon: Calendar },
            { label: tx.rate, value: `$${hourlyRate}${tx.perHour}`, sub: tx.keep85, icon: Zap },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl p-5"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded mb-3"
                style={{ background: '#F3F4F6' }}
              >
                <Icon className="h-4 w-4" style={{ color: '#9CA3AF' }} />
              </div>
              <div className="text-[22px] font-black mb-0.5" style={{ color: '#111111' }}>{value}</div>
              <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{label}</div>
              {sub && <div className="text-[11px] font-medium mt-0.5" style={{ color: '#16A34A' }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Recent payments */}
          <div
            className="lg:col-span-3 rounded-xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <h2 className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.recentPayments}</h2>
              <span
                className="text-[11px] font-semibold px-2.5 py-0.5 rounded"
                style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }}
              >
                {tx.keep85}
              </span>
            </div>

            {recentPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                  style={{ background: '#F3F4F6' }}
                >
                  <DollarSign className="h-5 w-5" style={{ color: '#9CA3AF' }} />
                </div>
                <p className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.noPayments}</p>
              </div>
            ) : (
              <div>
                {recentPayments.map((payment, i) => {
                  const date = new Date(payment.created_at)
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 px-5 py-3.5"
                      style={{ borderBottom: '1px solid #E5E7EB' }}
                    >
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded"
                        style={{ background: '#F3F4F6' }}
                      >
                        <DollarSign className="h-4 w-4" style={{ color: '#9CA3AF' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold" style={{ color: '#111111' }}>
                          ${payment.teacher_payout_usd.toFixed(2)} {tx.usd}
                        </div>
                        <div className="text-[11px]" style={{ color: '#9CA3AF' }}>
                          {date.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[11px] line-through" style={{ color: '#E5E7EB' }}>${payment.amount_usd.toFixed(2)}</div>
                        <div className="text-[11px] font-bold" style={{ color: '#16A34A' }}>85%</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Stripe card */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: '#fff',
                border: `1px solid ${hasStripeAccount ? '#86EFAC' : '#E5E7EB'}`,
              }}
            >
              {hasStripeAccount ? (
                <div className="p-5 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded flex-shrink-0"
                    style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}
                  >
                    <CheckCircle2 className="h-4 w-4" style={{ color: '#16A34A' }} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: '#16A34A' }}>{tx.stripeConnected}</div>
                    <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.stripeConnectedSub}</div>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded mb-4"
                    style={{ background: '#F3F4F6' }}
                  >
                    <CreditCard className="h-4 w-4" style={{ color: '#9CA3AF' }} />
                  </div>
                  <h3 className="text-[14px] font-bold mb-1" style={{ color: '#111111' }}>{tx.connectStripe}</h3>
                  <p className="text-[12px] leading-relaxed mb-4" style={{ color: '#4B5563' }}>{tx.connectSub}</p>
                  <button
                    onClick={handleConnectStripe}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-semibold text-[13px] transition-all disabled:opacity-60"
                    style={{ background: '#C41E3A', color: '#fff' }}
                    onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#9E1830' }}
                    onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = '#C41E3A' }}
                  >
                    {isPending ? (
                      <>
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        {tx.connecting}
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3.5 w-3.5" />
                        {tx.connectBtn}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* How it works */}
            <div
              className="rounded-xl p-5"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <h3 className="text-[13px] font-bold mb-4" style={{ color: '#111111' }}>{tx.howItWorks}</h3>
              <div className="space-y-3">
                {[tx.step1, tx.step2, tx.step3].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold"
                      style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-[12px] leading-relaxed" style={{ color: '#4B5563' }}>{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
