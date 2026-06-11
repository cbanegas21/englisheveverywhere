'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/lib/i18n/translations'
import { saveTeacherVeemPayout } from '@/app/actions/payouts'
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
  cleared: boolean
}

interface Props {
  lang: Locale
  totalSessions: number
  thisMonthSessions: number
  thisMonthEarnedUsd: number
  lifetimeEarnedUsd: number
  availableUsd: number
  pendingUsd: number
  nextPayoutLabel: string
  veemEmail: string | null
  sessions: Session[]
}

const t = {
  en: {
    title: 'Earnings',
    subtitle: 'Your earnings, payouts, and session history.',
    available: 'Available',
    pending: 'In hold',
    earnedMonth: 'Earned this month',
    sessions: 'Sessions',
    thisMonthLabel: 'this month',
    payoutsTitle: 'Payouts',
    // setup
    setupTitle: 'Set up your payouts',
    setupBody: 'We pay you through Veem — a free wallet you can cash out from to your bank.',
    setupStep1: 'Create a free Veem account (it takes a couple of minutes).',
    setupStep2: 'Add your Veem account email below — we send your earnings there every week.',
    createVeem: 'Create a Veem account →',
    veemEmailLabel: 'Your Veem email',
    veemEmailPlaceholder: 'you@email.com',
    save: 'Save',
    saving: 'Saving…',
    edit: 'Change',
    cancel: 'Cancel',
    errInvalid: 'Enter a valid email.',
    errGeneric: 'Could not save. Please try again.',
    // connected
    connectedTitle: 'Payouts go to your Veem',
    autoNote: 'Your available earnings are sent to your Veem automatically every week.',
    nextPayout: (d: string) => `Next payout: ${d}`,
    howItWorks: 'Earnings clear 7 days after each class, then go to your Veem wallet automatically every week. From Veem you move funds to your bank whenever you like.',
    // history
    history: 'Session earnings',
    noSessions: 'No completed sessions yet.',
    date: 'Date',
    student: 'Student',
    duration: 'Duration',
    payout: 'Earnings',
    status: 'Status',
    statusHold: 'In hold',
    statusAvailable: 'Available',
    statusPaid: 'Paid',
    mins: 'min',
  },
  es: {
    title: 'Ganancias',
    subtitle: 'Tus ganancias, pagos e historial de sesiones.',
    available: 'Disponible',
    pending: 'En espera',
    earnedMonth: 'Ganado este mes',
    sessions: 'Sesiones',
    thisMonthLabel: 'este mes',
    payoutsTitle: 'Pagos',
    setupTitle: 'Configura tus pagos',
    setupBody: 'Te pagamos a través de Veem — una billetera gratuita desde la que puedes retirar a tu banco.',
    setupStep1: 'Crea una cuenta gratuita en Veem (toma un par de minutos).',
    setupStep2: 'Agrega el correo de tu cuenta Veem abajo — ahí te enviamos tus ganancias cada semana.',
    createVeem: 'Crear una cuenta Veem →',
    veemEmailLabel: 'Tu correo de Veem',
    veemEmailPlaceholder: 'tu@correo.com',
    save: 'Guardar',
    saving: 'Guardando…',
    edit: 'Cambiar',
    cancel: 'Cancelar',
    errInvalid: 'Ingresa un correo válido.',
    errGeneric: 'No se pudo guardar. Inténtalo de nuevo.',
    connectedTitle: 'Tus pagos van a tu Veem',
    autoNote: 'Tus ganancias disponibles se envían a tu Veem automáticamente cada semana.',
    nextPayout: (d: string) => `Próximo pago: ${d}`,
    howItWorks: 'Las ganancias se liberan 7 días después de cada clase y luego van a tu billetera Veem automáticamente cada semana. Desde Veem mueves los fondos a tu banco cuando quieras.',
    history: 'Ganancias por sesión',
    noSessions: 'Sin sesiones completadas aún.',
    date: 'Fecha',
    student: 'Estudiante',
    duration: 'Duración',
    payout: 'Ganancia',
    status: 'Estado',
    statusHold: 'En espera',
    statusAvailable: 'Disponible',
    statusPaid: 'Pagado',
    mins: 'min',
  },
}

function formatUsd(amount: number, lang: Locale): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-HN' : 'en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(amount)
}

export default function GananciasClient({
  lang, totalSessions, thisMonthSessions, thisMonthEarnedUsd,
  availableUsd, pendingUsd, nextPayoutLabel, veemEmail, sessions,
}: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(!veemEmail)
  const [email, setEmail] = useState(veemEmail ?? '')
  const [error, setError] = useState('')

  function save() {
    setError('')
    startTransition(async () => {
      const res = await saveTeacherVeemPayout(email)
      if ('error' in res) {
        setError(res.error === 'invalid_email' ? tx.errInvalid : tx.errGeneric)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 13,
    borderRadius: 'var(--ek-radius-sm)', border: '1px solid var(--ek-border)',
    background: 'var(--ek-card)', color: 'var(--ek-text)', fontFamily: 'var(--ek-font-sans)', outline: 'none',
  }

  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>
      <DashTopBar title={tx.title} sub={tx.subtitle} />

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-8">
        {/* Payout setup / status — Veem */}
        <section style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)', padding: '20px 22px' }}>
          <div className="ek-microlabel" style={{ color: 'var(--ek-red)' }}>{tx.payoutsTitle}</div>

          {!editing && veemEmail ? (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-text)' }}>{tx.connectedTitle}</div>
                <div style={{ fontSize: 13, color: 'var(--ek-text-soft)', marginTop: 3, fontFamily: 'var(--ek-font-mono)' }}>{veemEmail}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ek-text-muted)', marginTop: 8, lineHeight: 1.5, maxWidth: 460 }}>{tx.autoNote}</div>
              </div>
              <button onClick={() => { setEmail(veemEmail); setEditing(true) }} className="ek-btn ek-btn-ghost ek-btn-square" style={{ flexShrink: 0, padding: '8px 16px', fontSize: 13 }}>{tx.edit}</button>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-text)' }}>{tx.setupTitle}</div>
              <p style={{ fontSize: 13, color: 'var(--ek-text-soft)', margin: '6px 0 14px', lineHeight: 1.55, maxWidth: 520 }}>{tx.setupBody}</p>
              <ol style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13, color: 'var(--ek-text-soft)', lineHeight: 1.6 }}>
                <li>{tx.setupStep1}{' '}
                  <a href="https://www.veem.com/signup/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ek-red)', fontWeight: 700, textDecoration: 'none' }}>{tx.createVeem}</a>
                </li>
                <li style={{ marginTop: 4 }}>{tx.setupStep2}</li>
              </ol>
              <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 6 }}>{tx.veemEmailLabel}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 520 }}>
                <input
                  type="email" value={email} placeholder={tx.veemEmailPlaceholder}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  disabled={isPending} className="ek-input" style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                />
                <button onClick={save} disabled={isPending || !email.trim()} className="ek-btn ek-btn-primary ek-btn-square" style={{ flexShrink: 0, padding: '10px 20px', fontSize: 13, opacity: (isPending || !email.trim()) ? 0.6 : 1 }}>
                  {isPending ? tx.saving : tx.save}
                </button>
                {veemEmail && (
                  <button onClick={() => { setEditing(false); setEmail(veemEmail); setError('') }} className="ek-btn ek-btn-ghost ek-btn-square" style={{ flexShrink: 0, padding: '10px 16px', fontSize: 13 }}>{tx.cancel}</button>
                )}
              </div>
              {error && <div style={{ fontSize: 12.5, color: 'var(--ek-red)', marginTop: 8 }}>{error}</div>}
            </div>
          )}
        </section>

        {/* Earnings ledger */}
        <StatLedger
          items={[
            { kicker: tx.available, value: formatUsd(availableUsd, lang), accent: true },
            { kicker: tx.pending, value: formatUsd(pendingUsd, lang) },
            { kicker: tx.earnedMonth, value: formatUsd(thisMonthEarnedUsd, lang) },
            { kicker: tx.sessions, value: totalSessions, sub: `${thisMonthSessions} ${tx.thisMonthLabel}` },
          ]}
        />

        {veemEmail && (
          <div style={{ marginTop: -16, fontSize: 12.5, color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', letterSpacing: '0.02em' }}>
            ↳ {tx.nextPayout(nextPayoutLabel)}
          </div>
        )}

        {/* Per-session earnings history */}
        <section>
          <SectionHeader title={tx.history} />
          {sessions.length === 0 ? (
            <p className="text-[15px] italic py-10" style={{ fontFamily: 'var(--ek-font-serif)', color: 'var(--ek-text-muted)' }}>{tx.noSessions}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[tx.date, tx.student, tx.duration, tx.payout, tx.status].map(h => (
                      <th key={h} className="text-left py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', borderBottom: '1px solid var(--ek-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => {
                    const statusLabel = s.paidOut ? tx.statusPaid : s.cleared ? tx.statusAvailable : tx.statusHold
                    const statusColor = s.paidOut ? 'var(--ek-text-muted)' : s.cleared ? 'var(--ek-text)' : 'var(--ek-text-muted)'
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--ek-border-soft)' }}>
                        <td className="py-3.5 text-[13px]" style={{ color: 'var(--ek-text)' }}>
                          {new Date(s.scheduled_at).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 text-[13px] font-medium" style={{ color: 'var(--ek-text)' }}>{s.student?.profile?.full_name?.split(' ')[0] || '—'}</td>
                        <td className="py-3.5 text-[13px]" style={{ color: 'var(--ek-text-soft)' }}>{s.duration_minutes}{tx.mins}</td>
                        <td className="py-3.5 text-[13px] font-bold" style={{ color: 'var(--ek-red)', fontFeatureSettings: '"tnum"' }}>{formatUsd(s.payoutUsd, lang)}</td>
                        <td className="py-3.5 text-[12px]" style={{ color: statusColor, fontFamily: 'var(--ek-font-mono)' }}>{statusLabel}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ek-text-muted)', lineHeight: 1.5, maxWidth: 560 }}>{tx.howItWorks}</p>
        </section>
      </div>
    </div>
  )
}
