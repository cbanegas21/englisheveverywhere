'use client'

import Link from 'next/link'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import JoinSessionButton from '@/components/JoinSessionButton'

interface Props {
  lang: Locale
  bookingId: string | null
  scheduledAt: string | null
  timezone: string
  isPast?: boolean
}

function formatDate(iso: string, lang: Locale, timezone: string) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: timezone || 'America/Tegucigalpa',
  })
}

function formatTime(iso: string, timezone: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: timezone || 'America/Tegucigalpa',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PlacementScheduledScreen({ lang, bookingId, scheduledAt, timezone, isPast }: Props) {
  const isEs = lang === 'es'
  const date = scheduledAt ? formatDate(scheduledAt, lang, timezone) : null
  const time = scheduledAt ? formatTime(scheduledAt, timezone) : null

  if (isPast) {
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
            {/* Amber header */}
            <div
              className="py-8 px-6 text-center"
              style={{ background: 'linear-gradient(135deg, #D97706, #B45309)' }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <AlertCircle className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-[20px] font-black text-white">
                {isEs ? 'Tu llamada ha pasado' : 'Your call has passed'}
              </h2>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-[14px] leading-relaxed" style={{ color: '#374151' }}>
                {isEs ? (
                  <>
                    Tu llamada de diagnóstico estaba programada para el{' '}
                    <strong>{date}</strong> a las <strong>{time}</strong>{' '}
                    pero ya pasó. Puedes reagendarla para continuar.
                  </>
                ) : (
                  <>
                    Your diagnostic call was scheduled for{' '}
                    <strong>{date}</strong> at <strong>{time}</strong>{' '}
                    but that time has passed. You can reschedule to continue.
                  </>
                )}
              </p>

              <Link
                href={`/${lang}/dashboard/placement?reschedule=1`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold text-[13px]"
                style={{ background: '#C41E3A', color: '#fff' }}
              >
                {isEs ? 'Reagendar llamada' : 'Reschedule call'}
              </Link>
              <Link
                href={`/${lang}/dashboard`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold text-[13px]"
                style={{ background: '#F3F4F6', color: '#374151' }}
              >
                {isEs ? 'Volver al dashboard' : 'Back to dashboard'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
            <h2 className="text-[20px] font-black text-white">
              {isEs
                ? '¡Tu llamada diagnóstica está agendada! ✓'
                : 'Your diagnostic call is scheduled! ✓'}
            </h2>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            <p className="text-[14px] leading-relaxed" style={{ color: '#374151' }}>
              {isEs ? (
                <>
                  Tu sesión está programada para{' '}
                  <strong>{date}</strong> a las <strong>{time}</strong>.{' '}
                  Un miembro de nuestro equipo se unirá contigo en la plataforma
                  para evaluar tu nivel de inglés en una sesión de 30 minutos.
                  No necesitas preparar nada — solo conectarte a tiempo.
                </>
              ) : (
                <>
                  Your session is scheduled for{' '}
                  <strong>{date}</strong> at <strong>{time}</strong>.{' '}
                  A member of our team will join you on the platform
                  to assess your English level in a 30-minute session.
                  No preparation needed — just show up on time.
                </>
              )}
            </p>

            {bookingId && scheduledAt && (
              <div className="flex justify-center">
                <JoinSessionButton
                  lang={lang}
                  bookingId={bookingId}
                  scheduledAt={scheduledAt}
                  variant="primary"
                />
              </div>
            )}

            <Link
              href={`/${lang}/dashboard`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold text-[13px] transition-all"
              style={{ background: '#F3F4F6', color: '#374151' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#E5E7EB')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#F3F4F6')}
            >
              {isEs ? 'Ir al Dashboard' : 'Go to Dashboard'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
