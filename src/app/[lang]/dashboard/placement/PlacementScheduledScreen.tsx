'use client'

import Link from 'next/link'
import { Calendar, Clock, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  lang: Locale
  booking: { id: string; scheduledAt: string; status: string } | null
}

function formatDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getCountdown(iso: string): string | null {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return null
  if (diff > 24 * 60 * 60 * 1000) return null // only show if within 24h
  const hours = Math.floor(diff / (60 * 60 * 1000))
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  return `${hours}h ${mins}m`
}

export default function PlacementScheduledScreen({ lang, booking }: Props) {
  const [countdown, setCountdown] = useState<string | null>(
    booking ? getCountdown(booking.scheduledAt) : null
  )

  useEffect(() => {
    if (!booking) return
    const id = setInterval(() => setCountdown(getCountdown(booking.scheduledAt)), 60_000)
    return () => clearInterval(id)
  }, [booking])

  const isEs = lang === 'es'

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>
          {isEs ? 'Diagnóstico' : 'Diagnostic'}
        </h1>
      </div>

      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div
          className="w-full max-w-[480px] rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}
        >
          {/* Green header */}
          <div
            className="py-8 px-6 text-center"
            style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-[20px] font-black text-white mb-2">
              {isEs ? '¡Tu llamada diagnóstica está agendada!' : 'Your diagnostic call is scheduled!'}
            </h2>
            <p className="text-[13px] text-white/75">
              {isEs
                ? 'Un maestro evaluará tu nivel de inglés en una llamada de 30 minutos.'
                : 'A teacher will assess your English level in a 30-minute call.'}
            </p>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            {booking && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2" style={{ color: '#9CA3AF' }}>
                      <Calendar className="h-3.5 w-3.5" />
                      {isEs ? 'Fecha' : 'Date'}
                    </span>
                    <span className="font-semibold" style={{ color: '#111111' }}>
                      {formatDate(booking.scheduledAt, lang)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2" style={{ color: '#9CA3AF' }}>
                      <Clock className="h-3.5 w-3.5" />
                      {isEs ? 'Hora' : 'Time'}
                    </span>
                    <span className="font-semibold" style={{ color: '#111111' }}>
                      {formatTime(booking.scheduledAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span style={{ color: '#9CA3AF' }}>{isEs ? 'Duración' : 'Duration'}</span>
                    <span className="font-semibold" style={{ color: '#111111' }}>30 min</span>
                  </div>
                </div>

                {countdown && (
                  <div
                    className="rounded-xl p-4 text-center"
                    style={{ background: 'rgba(196,30,58,0.05)', border: '1px solid rgba(196,30,58,0.15)' }}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#C41E3A' }}>
                      {isEs ? '¡Empieza en' : 'Starting in'}
                    </p>
                    <p className="text-[28px] font-black" style={{ color: '#C41E3A' }}>{countdown}</p>
                  </div>
                )}

                <div
                  className="rounded-xl p-4 text-[12px] leading-relaxed"
                  style={{ background: '#F9F9F9', border: '1px solid #E5E7EB', color: '#6B7280' }}
                >
                  {isEs
                    ? 'No necesitas preparar nada — solo conéctate a tiempo. Te asignaremos un maestro dentro de las 24 horas siguientes a tu llamada.'
                    : 'No preparation needed — just show up on time. We\'ll assign your teacher within 24 hours after your call.'}
                </div>
              </>
            )}

            <Link
              href={`/${lang}/dashboard`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold text-[13px] transition-all"
              style={{ background: '#C41E3A', color: '#fff' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
            >
              {isEs ? 'Ir al Dashboard' : 'Go to Dashboard'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
