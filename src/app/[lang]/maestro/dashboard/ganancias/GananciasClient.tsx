'use client'

import { Calendar, Video, CheckCircle2, DollarSign, Wallet } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'

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
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: tx.thisMonthEarnings, value: formatUsd(thisMonthEarningsUsd, lang), icon: DollarSign, accent: true },
            { label: tx.totalEarnings, value: formatUsd(totalEarningsUsd, lang), icon: Wallet, accent: true },
            { label: tx.thisMonth, value: thisMonthSessions.toString(), icon: Calendar, accent: false },
            { label: tx.total, value: totalSessions.toString(), icon: CheckCircle2, accent: false },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div
              key={label}
              className="rounded-xl p-5"
              style={{
                background: '#fff',
                border: `1px solid ${accent ? '#FCA5A5' : '#E5E7EB'}`,
              }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded mb-3"
                style={{ background: accent ? '#FEF2F2' : '#F3F4F6' }}
              >
                <Icon className="h-4 w-4" style={{ color: accent ? '#C41E3A' : '#9CA3AF' }} />
              </div>
              <div className="text-[22px] font-black mb-0.5" style={{ color: '#111111' }}>{value}</div>
              <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Sessions table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #E5E7EB' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
            <h2 className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.recentSessions}</h2>
          </div>

          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                style={{ background: '#F3F4F6' }}
              >
                <Video className="h-5 w-5" style={{ color: '#9CA3AF' }} />
              </div>
              <p className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.noSessions}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {[tx.date, tx.student, tx.duration, tx.earnings, tx.status].map(h => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td className="px-5 py-3.5 text-[13px]" style={{ color: '#111111' }}>
                        {new Date(s.scheduled_at).toLocaleDateString(
                          lang === 'es' ? 'es-HN' : 'en-US',
                          { month: 'short', day: 'numeric', year: 'numeric' }
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] font-medium" style={{ color: '#111111' }}>
                        {s.student?.profile?.full_name?.split(' ')[0] || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                        {s.duration_minutes}{tx.mins}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] font-bold" style={{ color: '#C41E3A' }}>
                        {formatUsd(s.payoutUsd, lang)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[10px] font-semibold px-2.5 py-1 rounded"
                          style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }}
                        >
                          {tx.completed}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
