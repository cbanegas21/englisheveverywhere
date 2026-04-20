'use client'

import { useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  Calendar, Video, Clock, CheckCircle2, ChevronRight, FileText, Sparkles, X,
  ChevronLeft, Stethoscope, Search, TrendingUp, History, CalendarDays,
} from 'lucide-react'
import { getSessionByBookingId } from '@/app/actions/video'
import type { SessionSummary } from '@/app/actions/video'
import type { Locale } from '@/lib/i18n/translations'
import JoinSessionButton from '@/components/JoinSessionButton'

const t = {
  en: {
    title: 'My Classes',
    subtitle: 'Upcoming and past sessions.',
    tabUpcoming: 'Upcoming',
    tabHistory: 'History',
    noUpcoming: 'No upcoming classes',
    noUpcomingSub: 'Book a class to get started.',
    noPast: 'No completed classes yet',
    noPastSub: 'Your session history will appear here.',
    bookClass: 'Book a class',
    with: 'with',
    mins: 'min',
    enterRoom: 'Join class',
    statusConfirmed: 'Confirmed',
    statusPending: 'Pending',
    statusAwaitingTeacher: 'Awaiting teacher',
    teacherBeingAssigned: 'Teacher being assigned',
    statusCompleted: 'Completed',
    statusDiagnostic: 'Diagnostic call',
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
    calendarTitle: 'Monthly overview',
    days: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    search: 'Search by teacher name',
    noResults: 'No classes match your search.',
    stats30d: 'Last 30 days',
    statsTotal: 'Total classes',
    statsCompleted: 'Completed',
    statsHours: 'Hours learned',
    bookingsThisMonth: (n: number) => `${n} ${n === 1 ? 'class' : 'classes'} this month`,
  },
  es: {
    title: 'Mis Clases',
    subtitle: 'Sesiones próximas y pasadas.',
    tabUpcoming: 'Próximas',
    tabHistory: 'Historial',
    noUpcoming: 'No tienes clases próximas',
    noUpcomingSub: 'Agenda una clase para comenzar.',
    noPast: 'Todavía no tienes clases completadas',
    noPastSub: 'Tu historial de sesiones aparecerá aquí.',
    bookClass: 'Agendar clase',
    with: 'con',
    mins: 'min',
    enterRoom: 'Entrar a sala',
    statusConfirmed: 'Confirmada',
    statusPending: 'Pendiente',
    statusAwaitingTeacher: 'Asignando maestro',
    teacherBeingAssigned: 'Maestro por asignar',
    statusCompleted: 'Completada',
    statusDiagnostic: 'Llamada diagnóstica',
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
    calendarTitle: 'Vista mensual',
    days: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    search: 'Buscar por maestro',
    noResults: 'Ninguna clase coincide con tu búsqueda.',
    stats30d: 'Últimos 30 días',
    statsTotal: 'Clases totales',
    statsCompleted: 'Completadas',
    statsHours: 'Horas aprendidas',
    bookingsThisMonth: (n: number) => `${n} ${n === 1 ? 'clase' : 'clases'} este mes`,
  },
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

interface Booking {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  type?: string
  teacher_id?: string | null
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
  const [search, setSearch] = useState('')

  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())

  const bookingRefs = useRef<Record<string, HTMLLIElement | null>>({})

  const allBookings = useMemo(() => [...upcomingBookings, ...pastBookings], [upcomingBookings, pastBookings])
  const bookings = activeTab === 'upcoming' ? upcomingBookings : pastBookings

  const filteredBookings = useMemo(() => {
    if (!search.trim()) return bookings
    const q = search.trim().toLowerCase()
    return bookings.filter(b => {
      const name = b.teacher?.profile?.full_name?.toLowerCase() || ''
      return name.includes(q) || (b.type === 'placement_test' && 'placement diagnostic'.includes(q))
    })
  }, [bookings, search])

  const isEmpty = filteredBookings.length === 0

  const [nowSnapshotMs] = useState(() => Date.now())

  // 30-day stats
  const stats = useMemo(() => {
    const monthAgo = nowSnapshotMs - 30 * 24 * 60 * 60 * 1000
    const last30 = allBookings.filter(b => new Date(b.scheduled_at).getTime() >= monthAgo)
    const completed30 = last30.filter(b => b.status === 'completed')
    const totalMinutes = completed30.reduce((s, b) => s + (b.duration_minutes || 0), 0)
    return {
      total: last30.length,
      completed: completed30.length,
      hours: Math.round(totalMinutes / 60),
    }
  }, [allBookings, nowSnapshotMs])

  // Build set of booked days in current calendar month
  const bookedDays = useMemo(() => {
    const set = new Set<number>()
    for (const b of allBookings) {
      const d = new Date(b.scheduled_at)
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        set.add(d.getDate())
      }
    }
    return set
  }, [allBookings, calYear, calMonth])

  const bookingsThisMonth = useMemo(() => bookedDays.size, [bookedDays])

  const calendarCells = buildCalendarGrid(calYear, calMonth)
  const monthLabel = (lang === 'es' ? MONTHS_ES : MONTHS_EN)[calMonth]

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  function scrollToDay(day: number) {
    const target = bookings.find(b => {
      const d = new Date(b.scheduled_at)
      return d.getDate() === day && d.getMonth() === calMonth && d.getFullYear() === calYear
    })
    if (target) {
      bookingRefs.current[target.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

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
    try { parsedSummary = JSON.parse(sessionData.teacher_notes) } catch { parsedSummary = null }
  }

  function getBadge(booking: Booking) {
    if (booking.type === 'placement_test') {
      return {
        label: tx.statusDiagnostic,
        style: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' },
        icon: <Stethoscope className="h-3 w-3" />,
      }
    }
    if (booking.status === 'confirmed') {
      return {
        label: tx.statusConfirmed,
        style: { background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' },
        icon: null,
      }
    }
    if (booking.status === 'completed') {
      return {
        label: tx.statusCompleted,
        style: { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' },
        icon: null,
      }
    }
    if (booking.status === 'pending' && !booking.teacher_id) {
      return {
        label: tx.statusAwaitingTeacher,
        style: { background: '#FFFBEB', color: '#D97706', border: '1px solid #FCD34D' },
        icon: null,
      }
    }
    return {
      label: tx.statusPending,
      style: { background: '#FFFBEB', color: '#D97706', border: '1px solid #FCD34D' },
      icon: null,
    }
  }

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black tracking-tight" style={{ color: '#111111' }}>{tx.title}</h1>
            <p className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
          </div>
          <Link
            href={`/${lang}/dashboard/agendar`}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold transition-all"
            style={{ background: '#C41E3A', color: '#fff' }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
          >
            <Calendar className="h-4 w-4" />
            {tx.bookClass}
          </Link>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">

          {/* LEFT RAIL */}
          <aside className="space-y-4">
            {/* Monthly calendar */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                <button
                  onClick={prevMonth}
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: '#6B7280' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#111111' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-center">
                  <p className="text-[14px] font-black capitalize" style={{ color: '#111111' }}>
                    {monthLabel} {calYear}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                    {tx.bookingsThisMonth(bookingsThisMonth)}
                  </p>
                </div>
                <button
                  onClick={nextMonth}
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: '#6B7280' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#111111' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 px-4 pt-4 pb-1">
                {tx.days.map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 px-4 pb-4 gap-y-1.5">
                {calendarCells.map((day, i) => {
                  if (!day) return <div key={i} />
                  const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()
                  const hasBooking = bookedDays.has(day)
                  return (
                    <button
                      key={i}
                      onClick={() => hasBooking && scrollToDay(day)}
                      className="flex flex-col items-center py-1 rounded-lg transition-colors"
                      style={{ cursor: hasBooking ? 'pointer' : 'default' }}
                      onMouseEnter={e => { if (hasBooking) e.currentTarget.style.background = '#F3F4F6' }}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span
                        className="text-[13px] font-bold w-8 h-8 flex items-center justify-center rounded-full tabular-nums"
                        style={isToday ? { background: '#C41E3A', color: '#fff' } : { color: hasBooking ? '#111111' : '#9CA3AF' }}
                      >
                        {day}
                      </span>
                      {hasBooking && !isToday && (
                        <span className="h-1 w-1 rounded-full mt-0.5" style={{ background: '#C41E3A' }} />
                      )}
                      {hasBooking && isToday && (
                        <span className="h-1 w-1 rounded-full mt-0.5" style={{ background: '#fff' }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 30-day stats */}
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(196,30,58,0.08)' }}>
                  <TrendingUp className="h-4 w-4" style={{ color: '#C41E3A' }} />
                </div>
                <h3 className="text-[13px] font-bold" style={{ color: '#111111' }}>{tx.stats30d}</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: tx.statsTotal, value: stats.total },
                  { label: tx.statsCompleted, value: stats.completed },
                  { label: tx.statsHours, value: stats.hours },
                ].map((s, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[22px] font-black tabular-nums" style={{ color: '#111111' }}>{s.value}</p>
                    <p className="text-[10px] mt-0.5 leading-tight" style={{ color: '#9CA3AF' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* MAIN: Tabs + search + list */}
          <main className="min-w-0 space-y-4">
            {/* Tabs + search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F3F4F6' }}>
                {([
                  { key: 'upcoming' as const, label: tx.tabUpcoming, icon: CalendarDays, count: upcomingBookings.length },
                  { key: 'history' as const, label: tx.tabHistory, icon: History, count: pastBookings.length },
                ]).map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold transition-all"
                      style={
                        activeTab === tab.key
                          ? { background: '#fff', color: '#111111', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                          : { background: 'transparent', color: '#6B7280' }
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums"
                        style={{ background: activeTab === tab.key ? 'rgba(196,30,58,0.1)' : '#E5E7EB', color: activeTab === tab.key ? '#C41E3A' : '#6B7280' }}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={tx.search}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-[13px] outline-none transition-all"
                  style={{ background: '#fff', border: '1px solid #E5E7EB', color: '#111111' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                />
              </div>
            </div>

            {/* List */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
              {isEmpty ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(196,30,58,0.08)' }}>
                    <Calendar className="h-7 w-7" style={{ color: '#C41E3A' }} />
                  </div>
                  <p className="text-[15px] font-bold mb-1" style={{ color: '#111111' }}>
                    {search ? tx.noResults : activeTab === 'upcoming' ? tx.noUpcoming : tx.noPast}
                  </p>
                  {!search && (
                    <p className="text-[12px] mb-6" style={{ color: '#9CA3AF' }}>
                      {activeTab === 'upcoming' ? tx.noUpcomingSub : tx.noPastSub}
                    </p>
                  )}
                  {activeTab === 'upcoming' && !search && (
                    <Link
                      href={`/${lang}/dashboard/agendar`}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg font-semibold text-[13px] transition-all"
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
                  {filteredBookings.map((booking) => {
                    const isCompleted = booking.status === 'completed'
                    const teacherName = booking.teacher?.profile?.full_name || null
                    const teacherAvatar = booking.teacher?.profile?.avatar_url || null
                    const awaitingTeacher = booking.type !== 'placement_test' && !teacherName
                    const badge = getBadge(booking)

                    return (
                      <li
                        key={booking.id}
                        ref={el => { bookingRefs.current[booking.id] = el }}
                        className="flex items-center gap-4 px-5 py-4 transition-colors"
                        style={{ borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Date column */}
                        <div className="flex-shrink-0 text-center w-14 py-1 rounded-lg" style={{ background: '#F9F9F9', border: '1px solid #F3F4F6' }}>
                          <div className="text-[10px] uppercase tracking-wide font-bold" style={{ color: '#C41E3A' }}>
                            {new Date(booking.scheduled_at).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { month: 'short' }).replace('.', '')}
                          </div>
                          <div className="text-[20px] font-black leading-none mt-0.5 tabular-nums" style={{ color: '#111111' }}>
                            {new Date(booking.scheduled_at).getDate()}
                          </div>
                        </div>

                        {/* Avatar + icon */}
                        <div className="hidden sm:flex flex-shrink-0">
                          {booking.type === 'placement_test' ? (
                            <div className="h-11 w-11 rounded-full flex items-center justify-center" style={{ background: '#EFF6FF' }}>
                              <Stethoscope className="h-5 w-5" style={{ color: '#1D4ED8' }} />
                            </div>
                          ) : teacherAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={teacherAvatar}
                              alt={teacherName || ''}
                              className="h-11 w-11 rounded-full object-cover"
                              style={{ border: '2px solid #F3F4F6' }}
                            />
                          ) : (
                            <div className="h-11 w-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(196,30,58,0.08)' }}>
                              {isCompleted
                                ? <CheckCircle2 className="h-5 w-5" style={{ color: '#C41E3A' }} />
                                : <Video className="h-5 w-5" style={{ color: '#C41E3A' }} />
                              }
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[14px] font-bold truncate"
                            style={{ color: awaitingTeacher ? '#9CA3AF' : '#111111', fontStyle: awaitingTeacher ? 'italic' : 'normal' }}
                          >
                            {booking.type === 'placement_test'
                              ? (lang === 'es' ? 'Llamada diagnóstica' : 'Diagnostic call')
                              : awaitingTeacher
                              ? tx.teacherBeingAssigned
                              : `${tx.with} ${teacherName}`
                            }
                          </div>
                          <div className="flex items-center gap-2 text-[12px] mt-0.5" style={{ color: '#6B7280' }}>
                            <span>{formatDate(booking.scheduled_at, lang)}</span>
                            <span style={{ color: '#D1D5DB' }}>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(booking.scheduled_at)}
                            </span>
                            <span style={{ color: '#D1D5DB' }}>·</span>
                            <span>{booking.duration_minutes}{tx.mins}</span>
                          </div>
                        </div>

                        {/* Right side: badge + CTA */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="hidden md:flex text-[10px] font-semibold px-2.5 py-1 rounded items-center gap-1"
                            style={badge.style}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>

                          {activeTab === 'upcoming' && !awaitingTeacher && (
                            <JoinSessionButton
                              lang={lang}
                              bookingId={booking.id}
                              scheduledAt={booking.scheduled_at}
                              variant="compact"
                            />
                          )}

                          {isCompleted && (
                            <button
                              onClick={() => openSummary(booking.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                              style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB'; e.currentTarget.style.color = '#111111' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#6B7280' }}
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
          </main>
        </div>
      </div>

      {/* Summary modal */}
      {viewingBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0" style={{ background: 'rgba(17,17,17,0.5)', backdropFilter: 'blur(4px)' }} onClick={closeSummary} />
          <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between px-6 py-5 sticky top-0 bg-white" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: '#C41E3A' }} />
                <span className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.summaryTitle}</span>
              </div>
              <button onClick={closeSummary} className="transition-colors" style={{ color: '#9CA3AF' }} onMouseEnter={e => (e.currentTarget.style.color = '#111111')} onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {loadingSession ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <span className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(196,30,58,0.2)', borderTopColor: '#C41E3A' }} />
                  <p className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.loadingSession}</p>
                </div>
              ) : (
                <>
                  {parsedSummary ? (
                    <div className="space-y-4">
                      {parsedSummary.covered.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>{tx.covered}</p>
                          <ul className="space-y-1.5">
                            {parsedSummary.covered.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: '#374151' }}>
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: '#C41E3A' }} />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {parsedSummary.nextTopics.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>{tx.nextTopics}</p>
                          <ul className="space-y-1.5">
                            {parsedSummary.nextTopics.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: '#374151' }}>
                                <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {parsedSummary.progressNote && (
                        <div className="rounded-xl p-4" style={{ background: 'rgba(196,30,58,0.05)', border: '1px solid rgba(196,30,58,0.1)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#C41E3A' }}>{tx.progressNote}</p>
                          <p className="text-[13px] leading-relaxed" style={{ color: '#374151' }}>{parsedSummary.progressNote}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl p-5 text-center" style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}>
                      <p className="text-[12px]" style={{ color: '#9CA3AF' }}>{tx.noSummary}</p>
                    </div>
                  )}
                  {sessionData?.notes && (
                    <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '1.25rem' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>{tx.teacherNotes}</p>
                      </div>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#374151' }}>{sessionData.notes}</p>
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
