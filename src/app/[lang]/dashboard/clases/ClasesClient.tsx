'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  FileText, Stethoscope, Search,
  MoreVertical, CalendarClock, AlertOctagon, XCircle,
} from 'lucide-react'
import { getSessionByBookingId } from '@/app/actions/video'
import type { SessionSummary } from '@/app/actions/video'
import {
  studentCancelBooking,
  studentRescheduleBooking,
  reportTeacherNoShow,
} from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'
import JoinSessionButton from '@/components/JoinSessionButton'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Modal from '@/components/dashboard/Modal'

const t = {
  en: {
    title: 'My classes',
    subtitle: 'Upcoming and completed · Every class is saved with its summary',
    bookClass: '+ Schedule class',
    exportLabel: 'Export',
    tabUpcoming: 'Upcoming',
    tabHistory: 'Completed',
    tabCancelled: 'Cancelled',
    noUpcoming: 'No upcoming classes',
    noUpcomingSub: 'Book a class to get started.',
    noPast: 'No completed classes yet',
    noPastSub: 'Your session history will appear here.',
    upcomingThisWeek: (n: number) => `${n} class${n !== 1 ? 'es' : ''} this week`,
    historyTitle: 'Recent history',
    historySub: 'Latest completed classes',
    seeAllSuffix: (n: number) => `See all ${n} →`,
    with: 'with',
    classWith: 'Class with',
    mins: 'min',
    statusConfirmed: 'Confirmed',
    statusPending: 'Pending',
    statusAwaitingTeacher: 'Assigning',
    statusLive: 'Live',
    teacherBeingAssigned: 'Assigning teacher',
    statusCompleted: 'Completed',
    statusDiagnostic: 'Diagnostic call',
    today: 'Today',
    tomorrow: 'Tomorrow',
    viewSummary: 'Notebook',
    aiSummary: '◇ AI Summary',
    nextClass: 'Next class',
    noSummaryYet: 'No summary saved for this class yet.',
    summaryTitle: 'Class summary',
    summaryKicker: 'Class notebook',
    covered: 'Topics covered',
    nextTopics: 'Next session suggestions',
    progressNote: 'Progress note',
    teacherNotes: 'Teacher notes',
    transcript: 'Transcript',
    transcriptEmpty: 'No transcript was captured for this class.',
    noSummary: 'No summary available for this session.',
    loadingSession: 'Loading session data…',
    close: 'Close',
    search: 'Search by teacher',
    showing: 'Showing',
    clear: 'Clear',
    enterRoom: 'Enter',
    detailsBtn: 'Details',
    rescheduleBtn: 'Reschedule',
    actions: 'Actions',
    actionCancel: 'Cancel class',
    actionReschedule: 'Reschedule',
    actionNoShow: 'Report teacher no-show',
    cancelTitleEarly: 'Cancel this class?',
    cancelTitleLate: 'Cancel within 24 hours?',
    cancelBodyEarly: 'You will get your class credit back. Are you sure?',
    cancelBodyLate: 'This class starts in less than 24 hours. Per our policy, the credit is forfeited and will not be refunded.',
    cancelConfirm: 'Yes, cancel',
    cancelGoBack: 'Keep the class',
    kickerCancel: 'Manage class',
    kickerReschedule: 'Manage class',
    kickerNoShow: 'Report an issue',
    rescheduleTitle: 'Reschedule this class',
    rescheduleHint: 'Pick a new date and time at least 24 hours from now. Your teacher will reconfirm the new slot.',
    rescheduleNewLabel: 'New date & time',
    rescheduleConfirm: 'Reschedule',
    noShowTitle: 'Report teacher no-show',
    noShowBody: 'Use this only if your teacher never joined the class. Your credit will be restored and our team will follow up.',
    noShowConfirm: 'Submit report',
    actionWorking: 'Working…',
    actionDone: 'Done',
    actionFailed: 'Something went wrong. Try again.',
  },
  es: {
    title: 'Mis clases',
    subtitle: 'Próximas y completadas · Cada clase queda guardada con su resumen',
    bookClass: '+ Agendar clase',
    exportLabel: 'Exportar',
    tabUpcoming: 'Próximas',
    tabHistory: 'Completadas',
    tabCancelled: 'Canceladas',
    noUpcoming: 'No tienes clases próximas',
    noUpcomingSub: 'Agenda una clase para comenzar.',
    noPast: 'Todavía no tienes clases completadas',
    noPastSub: 'Tu historial aparecerá aquí.',
    upcomingThisWeek: (n: number) => `${n} clase${n !== 1 ? 's' : ''} esta semana`,
    historyTitle: 'Historial reciente',
    historySub: 'Últimas clases completadas',
    seeAllSuffix: (n: number) => `Ver las ${n} →`,
    with: 'con',
    classWith: 'Clase con',
    mins: 'min',
    statusConfirmed: 'Confirmada',
    statusPending: 'Pendiente',
    statusAwaitingTeacher: 'Asignando',
    statusLive: 'En vivo',
    teacherBeingAssigned: 'Asignando maestro',
    statusCompleted: 'Completada',
    statusDiagnostic: 'Llamada diagnóstica',
    today: 'Hoy',
    tomorrow: 'Mañana',
    viewSummary: 'Cuaderno',
    aiSummary: '◇ Resumen IA',
    nextClass: 'Próxima clase',
    noSummaryYet: 'Sin resumen guardado para esta clase aún.',
    summaryTitle: 'Resumen de clase',
    summaryKicker: 'Cuaderno de clase',
    covered: 'Temas cubiertos',
    nextTopics: 'Sugerencias para la próxima sesión',
    progressNote: 'Nota de progreso',
    teacherNotes: 'Notas del maestro',
    transcript: 'Transcripción',
    transcriptEmpty: 'No se capturó transcripción para esta clase.',
    noSummary: 'No hay resumen disponible para esta sesión.',
    loadingSession: 'Cargando datos de sesión…',
    close: 'Cerrar',
    search: 'Buscar por maestro',
    showing: 'Mostrando',
    clear: 'Limpiar',
    enterRoom: 'Entrar',
    detailsBtn: 'Detalles',
    rescheduleBtn: 'Reagendar',
    actions: 'Acciones',
    actionCancel: 'Cancelar clase',
    actionReschedule: 'Reagendar',
    actionNoShow: 'Reportar inasistencia del maestro',
    cancelTitleEarly: '¿Cancelar esta clase?',
    cancelTitleLate: '¿Cancelar dentro de 24 horas?',
    cancelBodyEarly: 'Te devolveremos el crédito de tu clase. ¿Confirmas?',
    cancelBodyLate: 'Esta clase empieza en menos de 24 horas. Según nuestra política, el crédito se pierde y no se reembolsará.',
    cancelConfirm: 'Sí, cancelar',
    cancelGoBack: 'Mantener la clase',
    kickerCancel: 'Gestionar clase',
    kickerReschedule: 'Gestionar clase',
    kickerNoShow: 'Reportar un problema',
    rescheduleTitle: 'Reagendar esta clase',
    rescheduleHint: 'Elige una nueva fecha y hora con al menos 24 horas de anticipación. Tu maestro reconfirmará el nuevo horario.',
    rescheduleNewLabel: 'Nueva fecha y hora',
    rescheduleConfirm: 'Reagendar',
    noShowTitle: 'Reportar inasistencia del maestro',
    noShowBody: 'Úsalo solo si tu maestro no se conectó. Restituiremos tu crédito y nuestro equipo dará seguimiento.',
    noShowConfirm: 'Enviar reporte',
    actionWorking: 'Procesando…',
    actionDone: 'Listo',
    actionFailed: 'Algo salió mal. Intenta de nuevo.',
  },
}

function ymdInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

function formatDate(iso: string, lang: Locale, timeZone: string) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 86400000)
  const tx = t[lang]
  if (ymdInTz(d, timeZone) === ymdInTz(now, timeZone)) return tx.today
  if (ymdInTz(d, timeZone) === ymdInTz(tomorrow, timeZone)) return tx.tomorrow
  return d.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone,
  })
}

function formatTime(iso: string, lang: 'es' | 'en', timeZone: string) {
  return new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-HN' : 'en-US', {
    hour: '2-digit', minute: '2-digit', timeZone,
  })
}

function dayInTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(new Date(iso))
}

function monthShortInTz(iso: string, lang: Locale, timeZone: string): string {
  return new Date(iso)
    .toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { month: 'short', timeZone })
    .toUpperCase()
    .replace(/\./g, '')
}

function weekdayLong(iso: string, lang: Locale, timeZone: string): string {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    weekday: 'long',
    timeZone,
  })
}

interface Booking {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  type?: string
  teacher_id?: string | null
  teacher?: { profile?: { full_name?: string; avatar_url?: string } } | null
  meeting_notes?: string | null
}

interface SessionData {
  id: string
  notes: string | null
  teacher_notes: string | null
  transcript: string | null
  transcript_captured_at: string | null
  started_at: string | null
  ended_at: string | null
}

interface Props {
  lang: Locale
  timezone: string
  upcomingBookings: Booking[]
  pastBookings: Booking[]
}

export default function ClasesClient({ lang, timezone, upcomingBookings, pastBookings }: Props) {
  const tx = t[lang]
  const accent = 'var(--ek-red)'
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')
  const [viewingBookingId, setViewingBookingId] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [loadingSession, setLoadingSession] = useState(false)
  const [search, setSearch] = useState('')

  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<
    | { booking: Booking; kind: 'cancel' | 'reschedule' | 'no_show' }
    | null
  >(null)
  const [rescheduleNewIso, setRescheduleNewIso] = useState('')
  const [actionStatus, setActionStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!openMenuFor) return
    function onDoc() { setOpenMenuFor(null) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [openMenuFor])

  // Minute-tick for the Live badge transition
  const [nowTick, setNowTick] = useState<number | null>(null)
  useEffect(() => {
    const tt = setTimeout(() => setNowTick(Date.now()), 0)
    const id = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => { clearTimeout(tt); clearInterval(id) }
  }, [])

  const bookings = activeTab === 'upcoming' ? upcomingBookings : pastBookings

  const filteredBookings = useMemo(() => {
    let list = bookings
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(b => {
        const name = b.teacher?.profile?.full_name?.toLowerCase() || ''
        return name.includes(q) || (b.type === 'placement_test' && 'placement diagnostic'.includes(q))
      })
    }
    return list
  }, [bookings, search])

  const isEmpty = filteredBookings.length === 0
  const [nowSnapshotMs] = useState(() => Date.now())

  const bookingRefs = useRef<Record<string, HTMLLIElement | null>>({})

  async function openSummary(bookingId: string) {
    setViewingBookingId(bookingId)
    setSessionData(null)
    setLoadingSession(true)
    const data = await getSessionByBookingId(bookingId)
    setSessionData(data)
    setLoadingSession(false)
  }
  function closeSummary() { setViewingBookingId(null); setSessionData(null) }

  function openAction(booking: Booking, kind: 'cancel' | 'reschedule' | 'no_show') {
    setActionTarget({ booking, kind })
    setActionStatus('idle')
    setActionError(null)
    if (kind === 'reschedule') {
      const baseMs = (nowTick ?? nowSnapshotMs) + 25 * 60 * 60 * 1000
      const d = new Date(baseMs)
      d.setMinutes(0, 0, 0)
      const pad = (n: number) => String(n).padStart(2, '0')
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      setRescheduleNewIso(local)
    }
    setOpenMenuFor(null)
  }
  function closeAction() {
    setActionTarget(null); setActionStatus('idle'); setActionError(null); setRescheduleNewIso('')
  }

  async function runAction() {
    if (!actionTarget) return
    setActionStatus('working'); setActionError(null)
    try {
      let res: { success?: boolean; error?: string; message?: string } | undefined
      if (actionTarget.kind === 'cancel') {
        res = await studentCancelBooking(actionTarget.booking.id, lang)
      } else if (actionTarget.kind === 'reschedule') {
        if (!rescheduleNewIso) { setActionStatus('error'); setActionError(tx.actionFailed); return }
        const iso = new Date(rescheduleNewIso).toISOString()
        res = await studentRescheduleBooking(actionTarget.booking.id, iso, lang)
      } else if (actionTarget.kind === 'no_show') {
        res = await reportTeacherNoShow(actionTarget.booking.id, lang)
      }
      if (res?.error) { setActionStatus('error'); setActionError(res.error); return }
      closeAction()
      setToast(res?.message || tx.actionDone)
      window.location.reload()
    } catch (err) {
      setActionStatus('error'); setActionError((err as Error).message || tx.actionFailed)
    }
  }

  let parsedSummary: SessionSummary | null = null
  if (sessionData?.teacher_notes) {
    try { parsedSummary = JSON.parse(sessionData.teacher_notes) } catch { parsedSummary = null }
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
      <DashTopBar
        title={tx.title}
        sub={tx.subtitle}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              href={`/${lang}/dashboard/agendar`}
              className="ek-btn ek-btn-primary ek-btn-square"
              style={{ padding: '9px 16px', fontSize: 12 }}
            >
              {tx.bookClass}
            </Link>
          </div>
        }
      />

      <div style={{ padding: '28px 36px', maxWidth: 1280, margin: '0 auto' }}>
        {/* Tabs + search */}
        <div
          style={{
            display: 'flex',
            marginBottom: 20,
            borderBottom: '1px solid var(--ek-border)',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              { key: 'upcoming' as const, label: tx.tabUpcoming, count: upcomingBookings.length },
              { key: 'history' as const, label: tx.tabHistory, count: pastBookings.length },
            ]).map((tab) => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 0,
                    color: active ? 'var(--ek-text)' : 'var(--ek-text-muted)',
                    borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                    marginBottom: -1,
                    fontFamily: 'var(--ek-font-sans)',
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              )
            })}
          </div>

          <div style={{ position: 'relative', width: 260, marginBottom: 6 }}>
            <Search
              className="h-3.5 w-3.5"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ek-text-muted)',
              }}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tx.search}
              style={{
                width: '100%',
                paddingLeft: 36,
                paddingRight: 12,
                paddingTop: 9,
                paddingBottom: 9,
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border)',
                color: 'var(--ek-text)',
                fontFamily: 'var(--ek-font-sans)',
              }}
            />
          </div>
        </div>

        {/* List section */}
        <section
          style={{
            background: 'var(--ek-card)',
            borderRadius: 14,
            border: '1px solid var(--ek-border)',
            overflow: 'hidden',
            marginBottom: 28,
          }}
        >
          <header
            style={{
              padding: '16px 22px',
              borderBottom: '1px solid var(--ek-border-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                  fontWeight: 700,
                }}
              >
                {activeTab === 'upcoming' ? tx.tabUpcoming : tx.historyTitle}
              </div>
              <h3
                style={{
                  margin: '4px 0 0',
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--ek-text)',
                  letterSpacing: '-0.02em',
                }}
              >
                {activeTab === 'upcoming'
                  ? tx.upcomingThisWeek(filteredBookings.length)
                  : tx.historySub}
              </h3>
            </div>
            {activeTab === 'history' && pastBookings.length > filteredBookings.length && (
              <span style={{ fontSize: 12, color: 'var(--ek-text-muted)' }}>
                {tx.seeAllSuffix(pastBookings.length)}
              </span>
            )}
          </header>

          {isEmpty ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ek-text)' }}>
                {search
                  ? lang === 'es' ? 'Ninguna clase coincide.' : 'No classes match.'
                  : activeTab === 'upcoming'
                    ? tx.noUpcoming
                    : tx.noPast}
              </p>
              {!search && (
                <p style={{ margin: '6px 0 20px', fontSize: 12, color: 'var(--ek-text-muted)' }}>
                  {activeTab === 'upcoming' ? tx.noUpcomingSub : tx.noPastSub}
                </p>
              )}
              {activeTab === 'upcoming' && !search && (
                <Link
                  href={`/${lang}/dashboard/agendar`}
                  className="ek-btn ek-btn-red ek-btn-square"
                  style={{ padding: '10px 22px', fontSize: 13 }}
                >
                  {tx.bookClass} →
                </Link>
              )}
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {filteredBookings.map((booking) => {
                const isCompleted = booking.status === 'completed'
                const teacherName = booking.teacher?.profile?.full_name || null
                const awaitingTeacher =
                  booking.type !== 'placement_test' && !teacherName && booking.status === 'pending'
                const startMs = new Date(booking.scheduled_at).getTime()
                const endMs = startMs + (booking.duration_minutes || 60) * 60_000
                const isLive =
                  nowTick !== null &&
                  nowTick >= startMs &&
                  nowTick <= endMs &&
                  booking.status !== 'completed' &&
                  booking.status !== 'cancelled'
                const isNext =
                  activeTab === 'upcoming' &&
                  booking === filteredBookings[0]

                if (isCompleted) {
                  // Past row with inline AI summary panel
                  let parsed: SessionSummary | null = null
                  if (booking.meeting_notes) {
                    try { parsed = JSON.parse(booking.meeting_notes) } catch { parsed = null }
                  }
                  return (
                    <li
                      key={booking.id}
                      ref={(el) => { bookingRefs.current[booking.id] = el }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '70px 1fr 110px',
                        gap: 18,
                        alignItems: 'flex-start',
                        padding: '20px 22px',
                        borderBottom: '1px solid var(--ek-border-soft)',
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 9.5,
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            color: 'var(--ek-text-muted)',
                            fontWeight: 700,
                          }}
                        >
                          {monthShortInTz(booking.scheduled_at, lang, timezone)}
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: 'var(--ek-text)',
                            letterSpacing: '-0.025em',
                            lineHeight: 1,
                            marginTop: 2,
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
                          {dayInTz(booking.scheduled_at, timezone)}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--ek-text-muted)',
                            marginTop: 2,
                            textTransform: 'capitalize',
                          }}
                        >
                          {weekdayLong(booking.scheduled_at, lang, timezone)}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            marginBottom: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13.5,
                              fontWeight: 700,
                              color: 'var(--ek-text)',
                            }}
                          >
                            {booking.type === 'placement_test'
                              ? (lang === 'es' ? 'Llamada diagnóstica' : 'Diagnostic call')
                              : teacherName
                                ? `${tx.with} ${teacherName}`
                                : (lang === 'es' ? 'Sin maestro' : 'No teacher')}
                          </span>
                          <StatusBadge variant="completed">{tx.statusCompleted}</StatusBadge>
                        </div>

                        <div
                          style={{
                            background: 'var(--ek-paper)',
                            borderRadius: 8,
                            padding: '12px 14px',
                            border: '1px solid var(--ek-border)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9.5,
                              letterSpacing: '0.18em',
                              textTransform: 'uppercase',
                              color: accent,
                              fontWeight: 700,
                              marginBottom: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontFamily: 'var(--ek-font-mono)',
                            }}
                          >
                            {tx.aiSummary}
                          </div>
                          {parsed?.covered && parsed.covered.length > 0 ? (
                            <>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: 'var(--ek-ink-soft)',
                                  lineHeight: 1.55,
                                  marginBottom: 6,
                                }}
                              >
                                {parsed.covered.slice(0, 2).join(' · ')}
                              </div>
                              {parsed.nextTopics && parsed.nextTopics[0] && (
                                <div
                                  style={{
                                    fontSize: 11.5,
                                    color: 'var(--ek-text-muted)',
                                    fontStyle: 'italic',
                                    fontFamily: 'var(--ek-font-serif)',
                                  }}
                                >
                                  → {parsed.nextTopics[0]}
                                </div>
                              )}
                            </>
                          ) : (
                            <div
                              style={{
                                fontSize: 12,
                                color: 'var(--ek-text-muted)',
                                fontStyle: 'italic',
                              }}
                            >
                              {tx.noSummaryYet}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button
                          onClick={() => openSummary(booking.id)}
                          style={{
                            background: 'transparent',
                            color: 'var(--ek-text-soft)',
                            border: '1px solid var(--ek-border-mid)',
                            padding: '8px 12px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'var(--ek-font-sans)',
                          }}
                        >
                          {tx.viewSummary}
                        </button>
                      </div>
                    </li>
                  )
                }

                // Upcoming row
                return (
                  <li
                    key={booking.id}
                    ref={(el) => { bookingRefs.current[booking.id] = el }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 1fr auto auto auto',
                      gap: 16,
                      alignItems: 'center',
                      padding: '18px 22px',
                      borderBottom: '1px solid var(--ek-border-soft)',
                      background: isNext ? 'var(--ek-red-tint)' : 'transparent',
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontSize: 9.5,
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          color: 'var(--ek-text-muted)',
                          fontWeight: 700,
                        }}
                      >
                        {monthShortInTz(booking.scheduled_at, lang, timezone)}
                      </div>
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: isNext ? accent : 'var(--ek-text)',
                          letterSpacing: '-0.025em',
                          lineHeight: 1,
                          marginTop: 2,
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {dayInTz(booking.scheduled_at, timezone)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--ek-text-muted)',
                          marginTop: 2,
                          textTransform: 'capitalize',
                        }}
                      >
                        {weekdayLong(booking.scheduled_at, lang, timezone)}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: awaitingTeacher ? 'var(--ek-text-muted)' : 'var(--ek-text)',
                        }}
                      >
                        {booking.type === 'placement_test' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <Stethoscope className="h-3.5 w-3.5" style={{ color: accent }} />
                            {tx.statusDiagnostic}
                          </span>
                        ) : awaitingTeacher ? (
                          <em style={{ fontFamily: 'var(--ek-font-serif)' }}>{tx.teacherBeingAssigned}</em>
                        ) : (
                          `${tx.classWith} ${teacherName}`
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--ek-text-muted)',
                          marginTop: 3,
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {formatTime(booking.scheduled_at, lang, timezone)} · {booking.duration_minutes} {tx.mins}
                      </div>
                    </div>

                    <StatusBadge
                      variant={
                        isLive
                          ? 'cancelled'
                          : booking.status === 'confirmed'
                            ? 'confirmed'
                            : awaitingTeacher
                              ? 'pending'
                              : 'neutral'
                      }
                    >
                      {isLive
                        ? tx.statusLive
                        : booking.status === 'confirmed'
                          ? tx.statusConfirmed
                          : awaitingTeacher
                            ? tx.statusAwaitingTeacher
                            : tx.statusPending}
                    </StatusBadge>

                    {/* Kebab menu */}
                    {booking.type !== 'placement_test' &&
                      (booking.status === 'pending' || booking.status === 'confirmed') &&
                      (() => {
                        const canReportNoShow = nowTick !== null && nowTick > endMs + 5 * 60_000
                        const isOpen = openMenuFor === booking.id
                        return (
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuFor(isOpen ? null : booking.id)
                              }}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                background: 'var(--ek-paper)',
                                color: 'var(--ek-text-soft)',
                                border: '1px solid var(--ek-border-mid)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              aria-label={tx.actions}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                            {isOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '100%',
                                  marginTop: 4,
                                  zIndex: 30,
                                  width: 220,
                                  background: 'var(--ek-card)',
                                  border: '1px solid var(--ek-border)',
                                  borderRadius: 8,
                                  overflow: 'hidden',
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                                }}
                              >
                                <button
                                  onClick={() => openAction(booking, 'reschedule')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'var(--ek-text)',
                                    background: 'transparent',
                                    border: 0,
                                    cursor: 'pointer',
                                    fontFamily: 'var(--ek-font-sans)',
                                  }}
                                >
                                  <CalendarClock className="h-3.5 w-3.5" style={{ color: 'var(--ek-text-muted)' }} />
                                  {tx.actionReschedule}
                                </button>
                                <button
                                  onClick={() => openAction(booking, 'cancel')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'var(--ek-text)',
                                    background: 'transparent',
                                    border: 0,
                                    borderTop: '1px solid var(--ek-border-soft)',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--ek-font-sans)',
                                  }}
                                >
                                  <XCircle className="h-3.5 w-3.5" style={{ color: accent }} />
                                  {tx.actionCancel}
                                </button>
                                {canReportNoShow && (
                                  <button
                                    onClick={() => openAction(booking, 'no_show')}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: '10px 12px',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: 'var(--ek-text)',
                                      background: 'transparent',
                                      border: 0,
                                      borderTop: '1px solid var(--ek-border-soft)',
                                      cursor: 'pointer',
                                      fontFamily: 'var(--ek-font-sans)',
                                    }}
                                  >
                                    <AlertOctagon className="h-3.5 w-3.5" style={{ color: 'var(--ek-warn-text)' }} />
                                    {tx.actionNoShow}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                    {!awaitingTeacher && (
                      <JoinSessionButton
                        lang={lang}
                        bookingId={booking.id}
                        scheduledAt={booking.scheduled_at}
                        variant="compact"
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Summary modal (full detail) */}
      <Modal
        open={!!viewingBookingId}
        onClose={closeSummary}
        kicker={tx.summaryKicker}
        title={tx.summaryTitle}
        maxWidth={460}
      >
        <style>{`
          .lk-clases-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
          .lk-clases-list li {
            padding-left: 14px;
            border-left: 3px solid var(--ek-red);
            font-size: 13px;
            line-height: 1.5;
            color: var(--ek-ink-soft);
          }
          .lk-clases-list--muted li { border-left-color: var(--ek-border-mid); }
          .lk-clases-list--next li { font-style: italic; font-family: var(--ek-font-serif); }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loadingSession ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 12 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '2px solid var(--ek-red-tint-3)',
                  borderTopColor: accent,
                  animation: 'spin 1s linear infinite',
                }}
              />
              <p style={{ fontSize: 13, color: 'var(--ek-text-muted)' }}>{tx.loadingSession}</p>
            </div>
          ) : (
            <>
              {parsedSummary ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {parsedSummary.covered.length > 0 && (
                    <div>
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.18em',
                          marginBottom: 10,
                          color: 'var(--ek-text-muted)',
                          fontFamily: 'var(--ek-font-mono)',
                        }}
                      >
                        {tx.covered}
                      </p>
                      <ul className="lk-clases-list">
                        {parsedSummary.covered.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {parsedSummary.nextTopics.length > 0 && (
                    <div>
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.18em',
                          marginBottom: 10,
                          color: 'var(--ek-text-muted)',
                          fontFamily: 'var(--ek-font-mono)',
                        }}
                      >
                        {tx.nextTopics}
                      </p>
                      <ul className="lk-clases-list lk-clases-list--next">
                        {parsedSummary.nextTopics.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {parsedSummary.progressNote && (
                    <div
                      style={{
                        paddingLeft: 16,
                        borderLeft: '3px solid var(--ek-red)',
                      }}
                    >
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.18em',
                          marginBottom: 6,
                          color: accent,
                          fontFamily: 'var(--ek-font-mono)',
                        }}
                      >
                        {tx.progressNote}
                      </p>
                      <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ek-ink-soft)' }}>
                        {parsedSummary.progressNote}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--ek-text-muted)', fontStyle: 'italic', fontFamily: 'var(--ek-font-serif)' }}>
                  {tx.noSummary}
                </p>
              )}
              {sessionData?.notes && (
                <div style={{ borderTop: '1px solid var(--ek-border)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <FileText className="h-3.5 w-3.5" style={{ color: 'var(--ek-text-muted)' }} />
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.18em',
                        color: 'var(--ek-text-muted)',
                        fontFamily: 'var(--ek-font-mono)',
                      }}
                    >
                      {tx.teacherNotes}
                    </p>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--ek-ink-soft)' }}>
                    {sessionData.notes}
                  </p>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--ek-border)', paddingTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <FileText className="h-3.5 w-3.5" style={{ color: 'var(--ek-text-muted)' }} />
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.18em',
                      color: 'var(--ek-text-muted)',
                      fontFamily: 'var(--ek-font-mono)',
                    }}
                  >
                    {tx.transcript}
                  </p>
                </div>
                {sessionData?.transcript ? (
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      borderRadius: 8,
                      padding: 12,
                      maxHeight: 256,
                      overflowY: 'auto',
                      color: 'var(--ek-ink-soft)',
                      background: 'var(--ek-paper)',
                      border: '1px solid var(--ek-border)',
                    }}
                  >
                    {sessionData.transcript}
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: 12,
                      fontStyle: 'italic',
                      color: 'var(--ek-text-muted)',
                      fontFamily: 'var(--ek-font-serif)',
                    }}
                  >
                    {tx.transcriptEmpty}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Action modal */}
      {(() => {
        const startMs = actionTarget ? new Date(actionTarget.booking.scheduled_at).getTime() : 0
        const isLateCancel = startMs - (nowTick ?? nowSnapshotMs) < 24 * 60 * 60 * 1000
        const kind = actionTarget?.kind
        const title =
          kind === 'reschedule' ? tx.rescheduleTitle
            : kind === 'no_show' ? tx.noShowTitle
              : (isLateCancel ? tx.cancelTitleLate : tx.cancelTitleEarly)
        const kicker =
          kind === 'reschedule' ? tx.kickerReschedule
            : kind === 'no_show' ? tx.kickerNoShow
              : tx.kickerCancel
        return (
          <Modal
            open={!!actionTarget}
            onClose={() => { if (actionStatus !== 'working') closeAction() }}
            kicker={kicker}
            title={title}
            maxWidth={440}
            footer={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={closeAction}
                  disabled={actionStatus === 'working'}
                  className="ek-btn ek-btn-ghost ek-btn-square"
                  style={{ padding: '10px 16px', fontSize: 12 }}
                >
                  {kind === 'cancel' ? tx.cancelGoBack : tx.close}
                </button>
                <button
                  onClick={runAction}
                  disabled={actionStatus === 'working' || (kind === 'reschedule' && !rescheduleNewIso)}
                  className="ek-btn ek-btn-red ek-btn-square"
                  style={{
                    padding: '10px 16px',
                    fontSize: 12,
                    opacity: actionStatus === 'working' ? 0.7 : 1,
                  }}
                >
                  {actionStatus === 'working'
                    ? tx.actionWorking
                    : kind === 'cancel' ? tx.cancelConfirm
                      : kind === 'reschedule' ? tx.rescheduleConfirm
                        : tx.noShowConfirm}
                </button>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {kind === 'cancel' && (
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ek-ink-soft)' }}>
                  {isLateCancel ? tx.cancelBodyLate : tx.cancelBodyEarly}
                </p>
              )}
              {kind === 'no_show' && (
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ek-ink-soft)' }}>
                  {tx.noShowBody}
                </p>
              )}
              {kind === 'reschedule' && (
                <>
                  <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ek-ink-soft)' }}>
                    {tx.rescheduleHint}
                  </p>
                  <label style={{ display: 'block' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.18em',
                        marginBottom: 6,
                        display: 'block',
                        color: 'var(--ek-text-muted)',
                        fontFamily: 'var(--ek-font-mono)',
                      }}
                    >
                      {tx.rescheduleNewLabel}
                    </span>
                    <input
                      type="datetime-local"
                      value={rescheduleNewIso}
                      onChange={(e) => setRescheduleNewIso(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        fontSize: 13,
                        outline: 'none',
                        background: 'var(--ek-card)',
                        border: '1px solid var(--ek-border)',
                        color: 'var(--ek-text)',
                        fontFamily: 'var(--ek-font-sans)',
                      }}
                    />
                  </label>
                </>
              )}
              {actionStatus === 'error' && actionError && (
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.5,
                    paddingLeft: 14,
                    borderLeft: '3px solid var(--ek-red)',
                    color: accent,
                  }}
                >
                  {actionError}
                </div>
              )}
            </div>
          </Modal>
        )
      })()}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 50,
            maxWidth: 360,
            background: 'var(--ek-ink)',
            color: 'var(--ek-on-dark)',
            padding: '14px 18px',
            borderRadius: 10,
            fontSize: 13,
            boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
            fontFamily: 'var(--ek-font-sans)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
