'use client'

import { Calendar, Video, CheckCircle2 } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'

interface Session {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  student?: { profile?: { full_name?: string } } | null
}

interface Props {
  lang: Locale
  totalSessions: number
  thisMonthSessions: number
  sessions: Session[]
}

const t = {
  en: {
    title: 'Session history',
    subtitle: 'A record of all your completed classes.',
    thisMonth: 'Sessions this month',
    total: 'Total sessions',
    recentSessions: 'Completed sessions',
    noSessions: 'No completed sessions yet.',
    date: 'Date',
    student: 'Student',
    duration: 'Duration',
    status: 'Status',
    completed: 'Completed',
    mins: 'min',
  },
  es: {
    title: 'Historial de sesiones',
    subtitle: 'Registro de todas tus clases completadas.',
    thisMonth: 'Sesiones este mes',
    total: 'Sesiones totales',
    recentSessions: 'Sesiones completadas',
    noSessions: 'Sin sesiones completadas aún.',
    date: 'Fecha',
    student: 'Estudiante',
    duration: 'Duración',
    status: 'Estado',
    completed: 'Completada',
    mins: 'min',
  },
}

export default function GananciasClient({ lang, totalSessions, thisMonthSessions, sessions }: Props) {
  const tx = t[lang]

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: tx.thisMonth, value: thisMonthSessions, icon: Calendar },
            { label: tx.total, value: totalSessions, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
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
                    {[tx.date, tx.student, tx.duration, tx.status].map(h => (
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
                        {(s.student as any)?.profile?.full_name?.split(' ')[0] || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                        {s.duration_minutes}{tx.mins}
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
