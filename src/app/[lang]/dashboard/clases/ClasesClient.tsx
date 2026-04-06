'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Video, Clock, CheckCircle2, ChevronRight, FileText, Sparkles, X } from 'lucide-react'
import { getSessionByBookingId } from '@/app/actions/video'
import type { SessionSummary } from '@/app/actions/video'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    title: 'My Classes',
    subtitle: 'Upcoming and past sessions.',
    tabUpcoming: 'Upcoming',
    tabHistory: 'History',
    noUpcoming: 'No upcoming classes.',
    noUpcomingSub: 'Book a class to get started.',
    noPast: 'No completed classes yet.',
    noPastSub: 'Your session history will appear here.',
    bookClass: 'Book a class',
    with: 'with',
    mins: 'min',
    enterRoom: 'Join class',
    statusConfirmed: 'Confirmed',
    statusPending: 'Pending',
    statusCompleted: 'Completed',
    today: 'Today',
    tomorrow: 'Tomorrow',
    viewSummary: 'Summary',
    summaryTitle: 'Class Summary',
    covered: 'Topics Covered',
    nextTopics: 'Next Session Suggestions',
    progressNote: 'Progress Note',
    teacherNotes: 'Teacher Notes',
    noSummary: 'No summary available for this session.',
    noNotes: 'Your teacher did not leave notes for this session.',
    loadingSession: 'Loading session data...',
    close: 'Close',
  },
  es: {
    title: 'Mis Clases',
    subtitle: 'Sesiones próximas y pasadas.',
    tabUpcoming: 'Próximas',
    tabHistory: 'Historial',
    noUpcoming: 'No tienes clases próximas.',
    noUpcomingSub: 'Agenda una clase para comenzar.',
    noPast: 'Todavía no tienes clases completadas.',
    noPastSub: 'Tu historial de sesiones aparecerá aquí.',
    bookClass: 'Agendar clase',
    with: 'con',
    mins: 'min',
    enterRoom: 'Entrar a sala',
    statusConfirmed: 'Confirmada',
    statusPending: 'Pendiente',
    statusCompleted: 'Completada',
    today: 'Hoy',
    tomorrow: 'Mañana',
    viewSummary: 'Resumen',
    summaryTitle: 'Resumen de Clase',
    covered: 'Temas Cubiertos',
    nextTopics: 'Sugerencias para la Próxima Sesión',
    progressNote: 'Nota de Progreso',
    teacherNotes: 'Notas del Maestro',
    noSummary: 'No hay resumen disponible para esta sesión.',
    noNotes: 'Tu maestro no dejó notas para esta sesión.',
    loadingSession: 'Cargando datos de sesión...',
    close: 'Cerrar',
  },
}

function formatDate(iso: string, lang: Locale) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const tx = t[lang]
  if (d.toDateString() === now.toDateString()) return tx.today
  if (d.toDateString() === tomorrow.toDateString()) return tx.tomorrow
  return d.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function canJoinClass(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  // Match server window: from 15 minutes before start to 90 minutes after
  return diff >= -(90 * 60 * 1000) && diff <= 15 * 60 * 1000
}

interface Booking {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  teacher?: { profile?: { full_name?: string; avatar_url?: string } } | null
}

interface SessionData {
  id: string
  notes: string | null
  teacher_notes: string | null
  started_at: string | null
  ended_at: string | null
}

interface Props {
  lang: Locale
  upcomingBookings: Booking[]
  pastBookings: Booking[]
}

export default function ClasesClient({ lang, upcomingBookings, pastBookings }: Props) {
  const tx = t[lang]
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')
  const [viewingBookingId, setViewingBookingId] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [loadingSession, setLoadingSession] = useState(false)

  const bookings = activeTab === 'upcoming' ? upcomingBookings : pastBookings
  const isEmpty = bookings.length === 0

  async function openSummary(bookingId: string) {
    setViewingBookingId(bookingId)
    setSessionData(null)
    setLoadingSession(true)
    const data = await getSessionByBookingId(bookingId)
    setSessionData(data)
    setLoadingSession(false)
  }

  function closeSummary() {
    setViewingBookingId(null)
    setSessionData(null)
  }

  let parsedSummary: SessionSummary | null = null
  if (sessionData?.teacher_notes) {
    try {
      parsedSummary = JSON.parse(sessionData.teacher_notes)
    } catch {
      parsedSummary = null
    }
  }

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-3xl mx-auto space-y-5">

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded" style={{ background: '#F3F4F6', width: 'fit-content' }}>
          {(['upcoming', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2 rounded text-[13px] font-semibold transition-all"
              style={
                activeTab === tab
                  ? { background: '#fff', color: '#111111', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                  : { background: 'transparent', color: '#9CA3AF' }
              }
            >
              {tab === 'upcoming' ? tx.tabUpcoming : tx.tabHistory}
            </button>
          ))}
        </div>

        {/* Bookings list */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                style={{ background: 'rgba(196,30,58,0.08)' }}
              >
                <Calendar className="h-6 w-6" style={{ color: '#C41E3A' }} />
              </div>
              <p className="text-[13px] font-semibold mb-1" style={{ color: '#111111' }}>
                {activeTab === 'upcoming' ? tx.noUpcoming : tx.noPast}
              </p>
              <p className="text-[12px] mb-5" style={{ color: '#9CA3AF' }}>
                {activeTab === 'upcoming' ? tx.noUpcomingSub : tx.noPastSub}
              </p>
              {activeTab === 'upcoming' && (
                <Link
                  href={`/${lang}/dashboard/agendar`}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded font-semibold text-[12px] transition-all"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
                >
                  {tx.bookClass}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <ul>
              {bookings.map((booking) => {
                const canEnter = activeTab === 'upcoming' && canJoinClass(booking.scheduled_at)
                const isCompleted = booking.status === 'completed'
                const teacherName = (booking.teacher as { profile?: { full_name?: string } } | null)?.profile?.full_name || 'Teacher'

                return (
                  <li
                    key={booking.id}
                    className="flex items-center gap-4 px-5 py-4"
                    style={{ borderBottom: '1px solid #E5E7EB' }}
                  >
                    {/* Date column */}
                    <div className="flex-shrink-0 text-center w-11">
                      <div className="text-[10px] uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                        {formatDate(booking.scheduled_at, lang).slice(0, 3)}
                      </div>
                      <div className="text-[18px] font-black leading-none mt-0.5" style={{ color: '#111111' }}>
                        {new Date(booking.scheduled_at).getDate()}
                      </div>
                    </div>

                    {/* Icon */}
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded"
                      style={{ background: 'rgba(196,30,58,0.08)' }}
                    >
                      {activeTab === 'upcoming'
                        ? <Video className="h-4 w-4" style={{ color: '#C41E3A' }} />
                        : <CheckCircle2 className="h-4 w-4" style={{ color: '#C41E3A' }} />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate" style={{ color: '#111111' }}>
                        {tx.with} {teacherName}
                      </div>
                      <div className="flex items-center gap-2 text-[11px]" style={{ color: '#9CA3AF' }}>
                        <Clock className="h-3 w-3" />
                        {formatTime(booking.scheduled_at)} · {booking.duration_minutes}{tx.mins}
                      </div>
                    </div>

                    {/* Right side: badge + CTA */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="text-[10px] font-semibold px-2.5 py-1 rounded"
                        style={
                          booking.status === 'confirmed'
                            ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }
                            : booking.status === 'completed'
                            ? { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }
                            : { background: 'rgba(196,30,58,0.08)', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.2)' }
                        }
                      >
                        {booking.status === 'confirmed'
                          ? tx.statusConfirmed
                          : booking.status === 'completed'
                          ? tx.statusCompleted
                          : tx.statusPending}
                      </span>

                      {canEnter && (
                        <Link
                          href={`/${lang}/sala/${booking.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-semibold transition-all"
                          style={{ background: '#C41E3A', color: '#fff' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
                        >
                          <Video className="h-3 w-3" />
                          {tx.enterRoom}
                        </Link>
                      )}

                      {isCompleted && !canEnter && (
                        <button
                          onClick={() => openSummary(booking.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-semibold transition-all"
                          style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = '#E5E7EB'
                            e.currentTarget.style.color = '#111111'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = '#F3F4F6'
                            e.currentTarget.style.color = '#6B7280'
                          }}
                        >
                          <Sparkles className="h-3 w-3" />
                          {tx.viewSummary}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Summary modal */}
      {viewingBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(17,17,17,0.5)' }}
            onClick={closeSummary}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl"
            style={{ background: '#fff' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5 sticky top-0 bg-white"
              style={{ borderBottom: '1px solid #E5E7EB' }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: '#C41E3A' }} />
                <span className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.summaryTitle}</span>
              </div>
              <button
                onClick={closeSummary}
                className="transition-colors"
                style={{ color: '#9CA3AF' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {loadingSession ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <span
                    className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'rgba(196,30,58,0.2)', borderTopColor: '#C41E3A' }}
                  />
                  <p className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.loadingSession}</p>
                </div>
              ) : (
                <>
                  {/* AI Summary */}
                  {parsedSummary ? (
                    <div className="space-y-4">
                      {parsedSummary.covered.length > 0 && (
                        <div>
                          <p
                            className="text-[10px] font-bold uppercase tracking-widest mb-2"
                            style={{ color: '#9CA3AF' }}
                          >
                            {tx.covered}
                          </p>
                          <ul className="space-y-1.5">
                            {parsedSummary.covered.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: '#374151' }}>
                                <span
                                  className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                                  style={{ background: '#C41E3A' }}
                                />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {parsedSummary.nextTopics.length > 0 && (
                        <div>
                          <p
                            className="text-[10px] font-bold uppercase tracking-widest mb-2"
                            style={{ color: '#9CA3AF' }}
                          >
                            {tx.nextTopics}
                          </p>
                          <ul className="space-y-1.5">
                            {parsedSummary.nextTopics.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: '#374151' }}>
                                <ChevronRight
                                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                                  style={{ color: '#9CA3AF' }}
                                />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {parsedSummary.progressNote && (
                        <div
                          className="rounded-xl p-4"
                          style={{ background: 'rgba(196,30,58,0.05)', border: '1px solid rgba(196,30,58,0.1)' }}
                        >
                          <p
                            className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                            style={{ color: '#C41E3A' }}
                          >
                            {tx.progressNote}
                          </p>
                          <p className="text-[13px] leading-relaxed" style={{ color: '#374151' }}>
                            {parsedSummary.progressNote}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="rounded-xl p-5 text-center"
                      style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
                    >
                      <p className="text-[12px]" style={{ color: '#9CA3AF' }}>{tx.noSummary}</p>
                    </div>
                  )}

                  {/* Teacher notes */}
                  {sessionData?.notes && (
                    <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '1.25rem' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                        <p
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: '#9CA3AF' }}
                        >
                          {tx.teacherNotes}
                        </p>
                      </div>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#374151' }}>
                        {sessionData.notes}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
