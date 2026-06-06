'use client'

import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { StatLedger } from '@/components/ui/StatLedger'
import { SectionHeader } from '@/components/dashboard/SectionHeader'

interface Session {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  student?: { profile?: { full_name?: string } | null } | null
  payoutUsd: number
}

interface Props {
  lang: Locale
  totalSessions: number
  thisMonthSessions: number
  thisMonthEarningsUsd: number
  totalEarningsUsd: number
  sessions: Session[]
}

const t = {
  en: {
    title: 'Earnings',
    subtitle: 'Your session history + teacher payouts.',
    thisMonth: 'Sessions this month',
    total: 'Total sessions',
    thisMonthEarnings: 'This month earnings',
    totalEarnings: 'Total earnings',
    recentSessions: 'Completed sessions',
    noSessions: 'No completed sessions yet.',
    date: 'Date',
    student: 'Student',
    duration: 'Duration',
    earnings: 'Payout',
    status: 'Status',
    completed: 'Completed',
    mins: 'min',
  },
  es: {
    title: 'Ganancias',
    subtitle: 'Historial de sesiones + tus pagos.',
    thisMonth: 'Sesiones este mes',
    total: 'Sesiones totales',
    thisMonthEarnings: 'Ganancias del mes',
    totalEarnings: 'Ganancias totales',
    recentSessions: 'Sesiones completadas',
    noSessions: 'Sin sesiones completadas aún.',
    date: 'Fecha',
    student: 'Estudiante',
    duration: 'Duración',
    earnings: 'Pago',
    status: 'Estado',
    completed: 'Completada',
    mins: 'min',
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
  thisMonthEarningsUsd,
  totalEarningsUsd,
  sessions,
}: Props) {
  const tx = t[lang]

  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>
      <DashTopBar title={tx.title} sub={tx.subtitle} />

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-8">

        {/* Stats — editorial ledger: big numbers + hairline rules, no boxes.
            Earnings read in the red accent; session counts stay plain. */}
        <StatLedger
          items={[
            { kicker: tx.thisMonthEarnings, value: formatUsd(thisMonthEarningsUsd, lang), accent: true },
            { kicker: tx.totalEarnings, value: formatUsd(totalEarningsUsd, lang), accent: true },
            { kicker: tx.thisMonth, value: thisMonthSessions },
            { kicker: tx.total, value: totalSessions },
          ]}
        />

        {/* Completed sessions — hairline-ruled table, no boxes.
            Every row is pre-filtered to status='completed', so the redundant
            green status column is dropped entirely. */}
        <section>
          <SectionHeader title={tx.recentSessions} />

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
                    {[tx.date, tx.student, tx.duration, tx.earnings].map(h => (
                      <th
                        key={h}
                        className="text-left py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                        style={{
                          color: 'var(--ek-text-muted)',
                          fontFamily: 'var(--ek-font-mono)',
                          borderBottom: '1px solid var(--ek-border)',
                        }}
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
                        {new Date(s.scheduled_at).toLocaleDateString(
                          lang === 'es' ? 'es-HN' : 'en-US',
                          { month: 'short', day: 'numeric', year: 'numeric' }
                        )}
                      </td>
                      <td className="py-3.5 text-[13px] font-medium" style={{ color: 'var(--ek-text)' }}>
                        {s.student?.profile?.full_name?.split(' ')[0] || '—'}
                      </td>
                      <td className="py-3.5 text-[13px]" style={{ color: 'var(--ek-text-soft)' }}>
                        {s.duration_minutes}{tx.mins}
                      </td>
                      <td
                        className="py-3.5 text-[13px] font-bold"
                        style={{ color: 'var(--ek-red)', fontFeatureSettings: '"tnum"' }}
                      >
                        {formatUsd(s.payoutUsd, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
