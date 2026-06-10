'use client'

import { useState, useTransition } from 'react'
import type { Locale } from '@/lib/i18n/translations'
import { createStripeConnectLink } from '@/app/actions/stripe'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { StatLedger } from '@/components/ui/StatLedger'
import { SectionHeader } from '@/components/dashboard/SectionHeader'

interface Session {
  id: string
  scheduled_at: string
  duration_minutes: number
  student?: { profile?: { full_name?: string } | null } | null
  payoutUsd: number
  paidOut: boolean
}

type ConnectStatus = 'none' | 'pending' | 'ready'

interface Props {
  lang: Locale
  totalSessions: number
  thisMonthSessions: number
  thisMonthEarnedUsd: number
  lifetimeEarnedUsd: number
  awaitingPayoutUsd: number
  connectStatus: ConnectStatus
  justConnected: boolean
  sessions: Session[]
}

const t = {
  en: {
    title: 'Earnings',
    subtitle: 'Your earnings, payout status, and session history.',
    thisMonthEarnings: 'Earned this month',
    lifetimeEarnings: 'Lifetime earned',
    awaitingPayout: 'Awaiting payout',
    totalSessions: 'Sessions',
    payoutsTitle: 'Payouts',
    setupBody: 'Connect a bank account to receive your earnings.',
    setupCta: 'Set up payouts',
    pendingBody: 'Your payout account needs a few more details before it can receive money.',
    pendingCta: 'Finish setup',
    readyTitle: 'Payouts active',
    readyBody: 'Your connected account is ready to receive payouts.',
    connectedNote: 'Payout account connected — thank you!',
    cadenceNote: 'Earnings accrue here as you complete classes. Payouts to your connected bank are processed manually for now.',
    history: 'Session payouts',
    noSessions: 'No completed sessions yet.',
    date: 'Date',
    student: 'Student',
    duration: 'Duration',
    payout: 'Payout',
    status: 'Status',
    statusAwaiting: 'Awaiting',
    statusPaid: 'Paid',
    mins: 'min',
    payoutError: 'Could not open payout setup. Please try again.',
    opening: 'Opening…',
    thisMonthLabel: 'this month',
  },
  es: {
    title: 'Ganancias',
    subtitle: 'Tus ganancias, estado de pagos e historial de sesiones.',
    thisMonthEarnings: 'Ganado este mes',
    lifetimeEarnings: 'Ganado en total',
    awaitingPayout: 'Pendiente de pago',
    totalSessions: 'Sesiones',
    payoutsTitle: 'Pagos',
    setupBody: 'Conecta una cuenta bancaria para recibir tus ganancias.',
    setupCta: 'Configurar pagos',
    pendingBody: 'Tu cuenta de pagos necesita algunos datos más antes de poder recibir dinero.',
    pendingCta: 'Completar configuración',
    readyTitle: 'Pagos activos',
    readyBody: 'Tu cuenta conectada está lista para recibir pagos.',
    connectedNote: 'Cuenta de pagos conectada — ¡gracias!',
    cadenceNote: 'Tus ganancias se acumulan aquí a medida que completas clases. Los pagos a tu banco conectado se procesan manualmente por ahora.',
    history: 'Pagos por sesión',
    noSessions: 'Sin sesiones completadas aún.',
    date: 'Fecha',
    student: 'Estudiante',
    duration: 'Duración',
    payout: 'Pago',
    status: 'Estado',
    statusAwaiting: 'Pendiente',
    statusPaid: 'Pagado',
    mins: 'min',
    payoutError: 'No se pudo abrir la configuración de pagos. Inténtalo de nuevo.',
    opening: 'Abriendo…',
    thisMonthLabel: 'este mes',
  },
}

function formatUsd(amount: number, lang: Locale): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-HN' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function GananciasClient({
  lang,
  totalSessions,
  thisMonthSessions,
  thisMonthEarnedUsd,
  lifetimeEarnedUsd,
  awaitingPayoutUsd,
  connectStatus,
  justConnected,
  sessions,
}: Props) {
  const tx = t[lang]
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function setupPayouts() {
    setError('')
    startTransition(async () => {
      const res = await createStripeConnectLink(lang)
      if (res && 'url' in res && res.url) {
        window.location.href = res.url
        return
      }
      setError((res && 'error' in res && res.error) ? res.error : tx.payoutError)
    })
  }

  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>
      <DashTopBar title={tx.title} sub={tx.subtitle} />

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-8">
        {justConnected && (
          <div
            style={{
              padding: '12px 16px', borderRadius: 'var(--ek-radius-md)',
              background: 'var(--ek-success-bg)', color: 'var(--ek-success-text)',
              border: '1px solid var(--ek-success-border)', fontSize: 13, fontWeight: 600,
            }}
          >
            {tx.connectedNote}
          </div>
        )}

        {/* Payout setup / status banner */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
            padding: '18px 20px', borderRadius: 'var(--ek-radius-md)',
            background: 'var(--ek-card)', border: '1px solid var(--ek-border)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ek-text-muted)' }}>
              {tx.payoutsTitle}
            </div>
            <div style={{ fontSize: 14, color: 'var(--ek-text)', marginTop: 5, fontWeight: connectStatus === 'ready' ? 700 : 500 }}>
              {connectStatus === 'ready' ? tx.readyTitle : connectStatus === 'pending' ? tx.pendingBody : tx.setupBody}
            </div>
            {connectStatus === 'ready' && (
              <div style={{ fontSize: 12.5, color: 'var(--ek-text-muted)', marginTop: 3 }}>{tx.readyBody}</div>
            )}
            {error && <div style={{ fontSize: 12.5, color: 'var(--ek-red)', marginTop: 6 }}>{error}</div>}
          </div>

          {connectStatus === 'ready' ? (
            <span
              style={{
                flexShrink: 0, fontFamily: 'var(--ek-font-mono)', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--ek-success-text)', background: 'var(--ek-success-bg)',
                border: '1px solid var(--ek-success-border)', borderRadius: 999, padding: '5px 12px',
              }}
            >
              ✓ {tx.readyTitle}
            </span>
          ) : (
            <button
              onClick={setupPayouts}
              disabled={isPending}
              style={{
                flexShrink: 0, padding: '10px 18px', borderRadius: 'var(--ek-radius-sm)',
                background: 'var(--ek-red)', color: '#fff', border: '1px solid var(--ek-red)',
                fontSize: 13, fontWeight: 700, cursor: isPending ? 'wait' : 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? tx.opening : connectStatus === 'pending' ? tx.pendingCta : tx.setupCta}
            </button>
          )}
        </div>

        {/* Earnings ledger */}
        <StatLedger
          items={[
            { kicker: tx.thisMonthEarnings, value: formatUsd(thisMonthEarnedUsd, lang), accent: true },
            { kicker: tx.lifetimeEarnings, value: formatUsd(lifetimeEarnedUsd, lang), accent: true },
            { kicker: tx.awaitingPayout, value: formatUsd(awaitingPayoutUsd, lang) },
            { kicker: tx.totalSessions, value: totalSessions, sub: `${thisMonthSessions} ${tx.thisMonthLabel}` },
          ]}
        />

        {/* Per-session payout history */}
        <section>
          <SectionHeader title={tx.history} />

          {sessions.length === 0 ? (
            <p
              className="text-[15px] italic py-10"
              style={{ fontFamily: 'var(--ek-font-serif)', color: 'var(--ek-text-muted)' }}
            >
              {tx.noSessions}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[tx.date, tx.student, tx.duration, tx.payout, tx.status].map(h => (
                      <th
                        key={h}
                        className="text-left py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', borderBottom: '1px solid var(--ek-border)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--ek-border-soft)' }}>
                      <td className="py-3.5 text-[13px]" style={{ color: 'var(--ek-text)' }}>
                        {new Date(s.scheduled_at).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 text-[13px] font-medium" style={{ color: 'var(--ek-text)' }}>
                        {s.student?.profile?.full_name?.split(' ')[0] || '—'}
                      </td>
                      <td className="py-3.5 text-[13px]" style={{ color: 'var(--ek-text-soft)' }}>
                        {s.duration_minutes}{tx.mins}
                      </td>
                      <td className="py-3.5 text-[13px] font-bold" style={{ color: 'var(--ek-red)', fontFeatureSettings: '"tnum"' }}>
                        {formatUsd(s.payoutUsd, lang)}
                      </td>
                      <td className="py-3.5 text-[12px]" style={{ color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)' }}>
                        {s.paidOut ? tx.statusPaid : tx.statusAwaiting}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ek-text-muted)', lineHeight: 1.5 }}>
            {tx.cadenceNote}
          </p>
        </section>
      </div>
    </div>
  )
}
