'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { assignAndConfirmBooking, cancelBookingWithRefund, completeBooking } from '../actions'
import BookingAssign from './BookingAssign'
import { isTeacherAvailableClient } from './availability'
import JoinSessionButton from '@/components/JoinSessionButton'
import type { Locale } from '@/lib/i18n/translations'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface BookingEntry {
  id: string
  student_id: string
  teacher_id: string | null
  conductor_profile_id: string | null
  scheduled_at: string
  duration_minutes: number | null
  status: string
  type: string
  meeting_notes: string | null
  video_room_url: string | null
  student_name: string | null
  student_email: string | null
  student_level: string | null
  teacher_name: string | null
  conductor_name: string | null
  ai_summary: string | null
  student_rating: number | null
}

interface TeacherEntry { id: string; name: string; accepting: boolean }
interface StudentEntry { id: string; name: string; email: string }
interface AvailSlot { teacher_id: string; day_of_week: number; start_time: string; end_time: string }
interface PendingEntry {
  id: string
  student_id: string
  scheduled_at: string
  duration_minutes: number | null
  type: string
  student_name: string | null
}

interface Props {
  lang: string
  weekStart: string
  bookings: BookingEntry[]
  teachers: TeacherEntry[]
  allStudents: StudentEntry[]
  availSlots: AvailSlot[]
  pendingBookings: PendingEntry[]
  stats: { todayCount: number; pendingCount: number; weekConfirmed: number; availableSlots: number }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CAL_START_HOUR = 0
const CAL_END_HOUR = 24
const HOUR_HEIGHT = 48

// ── i18n ──────────────────────────────────────────────────────────────────────
// The whole app (admin included) localizes off the /[lang] segment. Server-action
// error strings stay English by design (admin-facing), so the override-retry
// matching below keys on the English server phrases, not these display strings.

const STR = {
  en: {
    // toasts / prompts
    assigned: 'Assigned and confirmed',
    assignFailed: 'Assignment failed',
    assignAnyway: 'Assign anyway?',
    markedComplete: 'Booking marked complete',
    error: 'Error',
    cancelledRefunded: 'Booking cancelled — class credit refunded',
    // teacher filter + legend
    teachers: 'Teachers',
    allTeachers: 'All teachers',
    legend: 'Legend',
    legPending: 'Pending',
    legConfirmed: 'Confirmed',
    legCompleted: 'Completed',
    legPlacement: 'Placement',
    legInterview: 'Interview',
    // nav
    prev: '← Prev',
    next: 'Next →',
    weekBack: '← Week',
    bookingsCount: (n: number) => `${n} bookings`,
    unassignedCol: (n: number) => `UNASSIGNED (${n})`,
    // fallbacks
    studentFallback: 'Student',
    unassigned: 'Unassigned',
    unknown: 'Unknown',
    // detail panel
    bookingDetail: 'Booking Detail',
    student: 'Student',
    teacher: 'Teacher',
    conductor: 'Conductor',
    scheduled: 'Scheduled',
    hondurasTime: 'Honduras time (CST)',
    duration: 'Duration',
    type: 'Type',
    meetingNotes: 'Meeting Notes',
    aiSummary: 'AI Summary',
    studentRating: 'Student Rating',
    assignTeacher: 'Assign Teacher',
    selectTeacher: 'Select teacher…',
    pausedOption: (name: string) => `⏸ ${name} (paused — not accepting)`,
    okOption: (name: string) => `✓ ${name}`,
    offHoursOption: (name: string) => `✗ ${name} (off-hours)`,
    assign: 'Assign',
    markComplete: 'Mark Complete',
    confirmCancelBtn: 'Confirm Cancel',
    no: 'No',
    cancelBooking: 'Cancel Booking',
    // availability panel
    availToday: 'Teacher Availability — Today',
    dayOfWeek: (wd: string) => `(day of week, ${wd})`,
    hour: 'Hour',
    available: 'Available',
    busy: 'Busy',
    availPanelToggle: 'Teacher Availability Panel',
    // page header
    kicker: '↳ Admin · Operations',
    bookings: 'Bookings',
    thisWeek: 'this week',
    visualCalendar: 'Visual calendar — Honduras time (CST, UTC-6)',
    viewWeek: 'Week',
    viewDay: 'Day',
    viewBoard: 'Board',
    // stats
    statToday: 'Bookings Today',
    statPending: 'Pending Assignment',
    statConfirmed: 'Confirmed This Week',
    statSlots: 'Availability Slots',
    // pending table
    pendingAssignments: (n: number) => `Pending Assignments (${n})`,
    thStudent: 'Student',
    thScheduled: 'Scheduled',
    thType: 'Type',
    thDuration: 'Duration',
    thAssign: 'Assign Teacher',
    noPending: 'No pending assignments. All caught up!',
    minShort: (m: number) => `${m} min`,
    minTight: (m: number) => `${m}min`,
    status: { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' } as Record<string, string>,
    types: { class: 'Class', placement_test: 'Placement test', teacher_interview: 'Teacher interview', admin_checkin: 'Admin check-in' } as Record<string, string>,
  },
  es: {
    assigned: 'Asignado y confirmado',
    assignFailed: 'Falló la asignación',
    assignAnyway: '¿Asignar de todos modos?',
    markedComplete: 'Sesión marcada como completada',
    error: 'Error',
    cancelledRefunded: 'Sesión cancelada — crédito de clase reembolsado',
    teachers: 'Maestros',
    allTeachers: 'Todos los maestros',
    legend: 'Leyenda',
    legPending: 'Pendiente',
    legConfirmed: 'Confirmada',
    legCompleted: 'Completada',
    legPlacement: 'Diagnóstico',
    legInterview: 'Entrevista',
    prev: '← Anterior',
    next: 'Siguiente →',
    weekBack: '← Semana',
    bookingsCount: (n: number) => `${n} reservas`,
    unassignedCol: (n: number) => `SIN ASIGNAR (${n})`,
    studentFallback: 'Estudiante',
    unassigned: 'Sin asignar',
    unknown: 'Desconocido',
    bookingDetail: 'Detalle de reserva',
    student: 'Estudiante',
    teacher: 'Maestro',
    conductor: 'Conductor',
    scheduled: 'Programada',
    hondurasTime: 'Hora de Honduras (CST)',
    duration: 'Duración',
    type: 'Tipo',
    meetingNotes: 'Notas de la reunión',
    aiSummary: 'Resumen IA',
    studentRating: 'Calificación del estudiante',
    assignTeacher: 'Asignar maestro',
    selectTeacher: 'Seleccionar maestro…',
    pausedOption: (name: string) => `⏸ ${name} (en pausa — no acepta)`,
    okOption: (name: string) => `✓ ${name}`,
    offHoursOption: (name: string) => `✗ ${name} (fuera de horario)`,
    assign: 'Asignar',
    markComplete: 'Marcar completada',
    confirmCancelBtn: 'Confirmar cancelación',
    no: 'No',
    cancelBooking: 'Cancelar reserva',
    availToday: 'Disponibilidad de maestros — Hoy',
    dayOfWeek: (wd: string) => `(día de la semana, ${wd})`,
    hour: 'Hora',
    available: 'Disponible',
    busy: 'Ocupado',
    availPanelToggle: 'Panel de disponibilidad de maestros',
    kicker: '↳ Admin · Operaciones',
    bookings: 'Reservas',
    thisWeek: 'esta semana',
    visualCalendar: 'Calendario visual — Hora de Honduras (CST, UTC-6)',
    viewWeek: 'Semana',
    viewDay: 'Día',
    viewBoard: 'Tablero',
    statToday: 'Reservas de hoy',
    statPending: 'Pendientes de asignar',
    statConfirmed: 'Confirmadas esta semana',
    statSlots: 'Horarios disponibles',
    pendingAssignments: (n: number) => `Asignaciones pendientes (${n})`,
    thStudent: 'Estudiante',
    thScheduled: 'Programada',
    thType: 'Tipo',
    thDuration: 'Duración',
    thAssign: 'Asignar maestro',
    noPending: 'No hay asignaciones pendientes. ¡Todo al día!',
    minShort: (m: number) => `${m} min`,
    minTight: (m: number) => `${m}min`,
    status: { pending: 'Pendiente', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada' } as Record<string, string>,
    types: { class: 'Clase', placement_test: 'Diagnóstico', teacher_interview: 'Entrevista de maestro', admin_checkin: 'Revisión de admin' } as Record<string, string>,
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toHNHour(iso: string): number {
  return (new Date(iso).getUTCHours() - 6 + 24) % 24
}

function toHNMinute(iso: string): number {
  return new Date(iso).getUTCMinutes()
}

function getBookingColor(status: string, type: string): { bg: string; border: string; text: string } {
  if (status === 'cancelled') return { bg: '#F3F4F6', border: '#D1D5DB', text: '#9CA3AF' }
  if (status === 'completed') return { bg: '#F0FDF4', border: '#86EFAC', text: '#16A34A' }
  if (type === 'placement_test') return { bg: '#EFF6FF', border: '#93C5FD', text: '#2563EB' }
  if (type === 'teacher_interview' || type === 'admin_checkin') return { bg: '#F5F3FF', border: '#C4B5FD', text: '#7C3AED' }
  if (status === 'pending') return { bg: '#FFFBEB', border: '#FCD34D', text: '#D97706' }
  if (status === 'confirmed') return { bg: '#F0FDF4', border: '#6EE7B7', text: '#059669' }
  return { bg: '#F9FAFB', border: '#E5E7EB', text: '#6B7280' }
}

function getStatusBadge(status: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    pending: { bg: 'rgba(245,158,11,0.1)', color: '#D97706' },
    confirmed: { bg: 'rgba(5,150,105,0.1)', color: '#059669' },
    completed: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A' },
    cancelled: { bg: 'rgba(107,114,128,0.1)', color: '#6B7280' },
  }
  return map[status] ?? { bg: '#F9FAFB', color: '#6B7280' }
}

// ── Toast component ───────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      background: type === 'success' ? '#059669' : '#DC2626',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      maxWidth: 320,
    }}>
      {msg}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookingCalendarClient({
  lang,
  weekStart,
  bookings,
  teachers,
  allStudents,
  availSlots,
  pendingBookings,
  stats,
}: Props) {
  const [view, setView] = useState<'week' | 'day' | 'board'>('week')
  const [selectedBooking, setSelectedBooking] = useState<BookingEntry | null>(null)
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set(teachers.map(t => t.id)))
  const [selectedDay, setSelectedDay] = useState(0)
  const [showAvailability, setShowAvailability] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [detailAssignTeacher, setDetailAssignTeacher] = useState('')
  const [showAiSummary, setShowAiSummary] = useState(false)
  const router = useRouter()

  // ── i18n bindings ──────────────────────────────────────────────────────────
  const L: 'en' | 'es' = lang === 'es' ? 'es' : 'en'
  const tx = STR[L]
  const DLOC = L === 'es' ? 'es-HN' : 'en-US'
  function hourLabel(h: number): string {
    // ES uses 24h (natural for Honduras, fits the 60px gutter); EN keeps 12h am/pm.
    if (L === 'es') return `${String(h).padStart(2, '0')}:00`
    return h === 0 ? '12am' : h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`
  }
  const typeLabel = (type: string) => tx.types[type] ?? type.replace(/_/g, ' ')
  const statusLabel = (status: string) => tx.status[status] ?? status
  const viewLabel = (v: 'week' | 'day' | 'board') =>
    v === 'week' ? tx.viewWeek : v === 'day' ? tx.viewDay : tx.viewBoard

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function navigate(dir: 'prev' | 'next') {
    const d = new Date(weekStart + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + (dir === 'next' ? 7 : -7))
    router.push(`/${lang}/admin/bookings?weekStart=${d.toISOString().slice(0, 10)}`)
  }

  // ── Day helpers ──────────────────────────────────────────────────────────────

  function getDayLabels(): { short: string; full: string; iso: string }[] {
    const labels = []
    const start = new Date(weekStart + 'T00:00:00Z')
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + i)
      labels.push({
        short: d.toLocaleDateString(DLOC, { weekday: 'short', timeZone: 'UTC' }),
        full: d.toLocaleDateString(DLOC, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        iso: d.toISOString().slice(0, 10),
      })
    }
    return labels
  }

  function getWeekDayIndex(iso: string): number {
    const bookingDate = new Date(iso)
    const hnMs = bookingDate.getTime() - 6 * 3600000
    const hnDate = new Date(hnMs)
    const weekStartDate = new Date(weekStart + 'T00:00:00Z')
    const diffMs = new Date(hnDate.toISOString().slice(0, 10) + 'T00:00:00Z').getTime() - weekStartDate.getTime()
    return Math.floor(diffMs / 86400000)
  }

  const filteredTeachers = teachers.filter(t => selectedTeachers.has(t.id))
  const unassignedBookings = bookings.filter(b => !b.teacher_id && b.status !== 'cancelled')

  // ── Drag and drop ────────────────────────────────────────────────────────────

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const { draggableId, destination } = result
    if (!destination.droppableId.startsWith('teacher:')) return
    const teacherId = destination.droppableId.replace('teacher:', '')
    assignWithAvailabilityGuard(draggableId, teacherId, () => { router.refresh() })
  }

  // Shared helper: run the assignment; if the server blocks on availability,
  // prompt the admin to override before retrying with force=true. Keeps the
  // guard consistent between drag-drop and the detail panel.
  function assignWithAvailabilityGuard(
    bookingId: string,
    teacherId: string,
    onSuccess: () => void,
    force = false,
  ) {
    startTransition(async () => {
      try {
        await assignAndConfirmBooking(bookingId, teacherId, { force })
        showToast(tx.assigned)
        onSuccess()
      } catch (e) {
        const msg = e instanceof Error ? e.message : tx.assignFailed
        // Match on the English server-error phrases (server messages stay English).
        const lower = msg.toLowerCase()
        const overridable = lower.includes('not available') || lower.includes('primary teacher')
        if (overridable && !force) {
          if (confirm(`${msg}\n\n${tx.assignAnyway}`)) {
            assignWithAvailabilityGuard(bookingId, teacherId, onSuccess, true)
            return
          }
        }
        showToast(msg, 'error')
      }
    })
  }

  // ── Detail panel actions ─────────────────────────────────────────────────────

  function handleAssignFromPanel() {
    if (!selectedBooking || !detailAssignTeacher) return
    const bookingId = selectedBooking.id
    assignWithAvailabilityGuard(bookingId, detailAssignTeacher, () => {
      setSelectedBooking(null)
      router.refresh()
    })
  }

  function handleComplete() {
    if (!selectedBooking) return
    startTransition(async () => {
      try {
        await completeBooking(selectedBooking.id)
        showToast(tx.markedComplete)
        setSelectedBooking(null)
        router.refresh()
      } catch (e) {
        showToast(e instanceof Error ? e.message : tx.error, 'error')
      }
    })
  }

  function handleCancel() {
    if (!selectedBooking) return
    startTransition(async () => {
      try {
        await cancelBookingWithRefund(selectedBooking.id)
        showToast(tx.cancelledRefunded)
        setSelectedBooking(null)
        setConfirmCancel(false)
        router.refresh()
      } catch (e) {
        showToast(e instanceof Error ? e.message : tx.error, 'error')
      }
    })
  }

  // ── Availability ─────────────────────────────────────────────────────────────

  function getAvailabilityForHour(hnHour: number): { available: string[]; busy: string[] } {
    const todayDow = new Date().getDay()
    const available: string[] = []
    const busy: string[] = []

    for (const teacher of teachers) {
      const slots = availSlots.filter(s => s.teacher_id === teacher.id && s.day_of_week === todayDow)
      const isAvailable = slots.some(s => {
        const slotStartH = parseInt(s.start_time.split(':')[0])
        const slotEndH = parseInt(s.end_time.split(':')[0])
        return hnHour >= slotStartH && hnHour < slotEndH
      })

      if (isAvailable) {
        const todayIso = new Date().toISOString().slice(0, 10)
        const hasBooking = bookings.some(b =>
          b.teacher_id === teacher.id &&
          b.status !== 'cancelled' &&
          b.scheduled_at.startsWith(todayIso) &&
          toHNHour(b.scheduled_at) === hnHour
        )
        if (hasBooking) busy.push(teacher.name.split(' ')[0])
        else available.push(teacher.name.split(' ')[0])
      }
    }
    return { available, busy }
  }

  // ── Renders ───────────────────────────────────────────────────────────────────

  function renderTeacherFilter() {
    return (
      <div style={{ width: 180, flexShrink: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{tx.teachers}</p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selectedTeachers.size === teachers.length}
            onChange={() => setSelectedTeachers(selectedTeachers.size === teachers.length ? new Set() : new Set(teachers.map(t => t.id)))}
          />
          <span style={{ fontSize: 12, color: '#374151' }}>{tx.allTeachers}</span>
        </label>
        {teachers.map(t => (
          <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selectedTeachers.has(t.id)}
              onChange={() => {
                const next = new Set(selectedTeachers)
                if (next.has(t.id)) next.delete(t.id); else next.add(t.id)
                setSelectedTeachers(next)
              }}
            />
            <span style={{ fontSize: 12, color: '#374151' }}>{t.name.split(' ')[0]}</span>
          </label>
        ))}

        <div style={{ marginTop: 20, borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{tx.legend}</p>
          {[
            { color: '#FCD34D', label: tx.legPending },
            { color: '#6EE7B7', label: tx.legConfirmed },
            { color: '#86EFAC', label: tx.legCompleted },
            { color: '#93C5FD', label: tx.legPlacement },
            { color: '#C4B5FD', label: tx.legInterview },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
              <span style={{ fontSize: 11, color: '#6B7280' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderWeekView() {
    const dayLabels = getDayLabels()
    const hours = Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }, (_, i) => CAL_START_HOUR + i)
    const calHeight = (CAL_END_HOUR - CAL_START_HOUR) * HOUR_HEIGHT

    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        {/* Week nav header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <button onClick={() => navigate('prev')} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>{tx.prev}</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
            {new Date(weekStart + 'T00:00:00Z').toLocaleDateString(DLOC, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
            {' — '}
            {new Date(new Date(weekStart + 'T00:00:00Z').setUTCDate(new Date(weekStart + 'T00:00:00Z').getUTCDate() + 6)).toLocaleDateString(DLOC, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
          </span>
          <button onClick={() => navigate('next')} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>{tx.next}</button>
        </div>

        {/* Day label row */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid #E5E7EB' }}>
          <div />
          {dayLabels.map((d, i) => {
            const isToday = d.iso === new Date().toISOString().slice(0, 10)
            return (
              <div
                key={i}
                onClick={() => { setSelectedDay(i); setView('day') }}
                style={{ padding: '10px 0', textAlign: 'center', cursor: 'pointer', borderLeft: '1px solid #F3F4F6', background: isToday ? 'rgba(196,30,58,0.04)' : 'transparent' }}
              >
                <p style={{ fontSize: 11, fontWeight: 600, color: isToday ? '#C41E3A' : '#9CA3AF', margin: 0, textTransform: 'uppercase' }}>{d.short}</p>
                <p style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: isToday ? '#C41E3A' : '#374151', margin: '2px 0 0' }}>{d.full}</p>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', overflowY: 'auto', maxHeight: 600 }}>
          {/* Hour labels column */}
          <div style={{ position: 'relative', height: calHeight }}>
            {hours.map(h => (
              <div key={h} style={{ position: 'absolute', top: (h - CAL_START_HOUR) * HOUR_HEIGHT, left: 0, right: 0, height: HOUR_HEIGHT }}>
                <span style={{ fontSize: 10, color: '#9CA3AF', paddingLeft: 8, paddingTop: 4, display: 'block', userSelect: 'none' }}>
                  {hourLabel(h)}
                </span>
              </div>
            ))}
          </div>

          {/* 7 day columns */}
          {dayLabels.map((d, dayIdx) => {
            const isToday = d.iso === new Date().toISOString().slice(0, 10)
            const dayBookings = bookings.filter(b => {
              if (!selectedTeachers.has(b.teacher_id ?? '') && b.teacher_id !== null) return false
              return getWeekDayIndex(b.scheduled_at) === dayIdx
            })

            return (
              <div
                key={dayIdx}
                style={{
                  position: 'relative',
                  height: calHeight,
                  borderLeft: '1px solid #F3F4F6',
                  background: isToday ? 'rgba(196,30,58,0.015)' : 'transparent',
                }}
              >
                {/* Hour grid lines */}
                {hours.map(h => (
                  <div
                    key={h}
                    style={{
                      position: 'absolute',
                      top: (h - CAL_START_HOUR) * HOUR_HEIGHT,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: '#F3F4F6',
                    }}
                  />
                ))}

                {/* Booking blocks */}
                {dayBookings.map(b => {
                  const hnHour = toHNHour(b.scheduled_at)
                  const hnMin = toHNMinute(b.scheduled_at)
                  const dur = b.duration_minutes ?? 60
                  const topPx = (hnHour - CAL_START_HOUR + hnMin / 60) * HOUR_HEIGHT
                  const heightPx = Math.max((dur / 60) * HOUR_HEIGHT, 20)
                  const colors = getBookingColor(b.status, b.type)
                  const isSelected = selectedBooking?.id === b.id

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      style={{
                        position: 'absolute',
                        top: topPx + 1,
                        height: heightPx - 2,
                        left: 2,
                        right: 2,
                        background: colors.bg,
                        border: `1px solid ${isSelected ? '#C41E3A' : colors.border}`,
                        borderRadius: 6,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        padding: '3px 5px',
                        boxShadow: isSelected ? '0 0 0 2px rgba(196,30,58,0.3)' : 'none',
                        transition: 'box-shadow 0.1s',
                      }}
                    >
                      <p style={{ fontSize: 10, fontWeight: 700, color: colors.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {b.student_name?.split(' ')[0] || tx.studentFallback}
                      </p>
                      {heightPx > 30 && (
                        <p style={{ fontSize: 9, color: '#6B7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.teacher_name?.split(' ')[0] || '—'}
                        </p>
                      )}
                      {heightPx > 44 && (
                        <p style={{ fontSize: 9, color: '#9CA3AF', margin: 0 }}>
                          {new Date(b.scheduled_at).toLocaleTimeString(DLOC, { hour: '2-digit', minute: '2-digit', timeZone: 'America/Tegucigalpa' })}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderDayView() {
    const dayLabels = getDayLabels()
    const hours = Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }, (_, i) => CAL_START_HOUR + i)
    const calHeight = (CAL_END_HOUR - CAL_START_HOUR) * HOUR_HEIGHT
    const d = dayLabels[selectedDay]

    const dayBookings = bookings.filter(b => {
      if (!selectedTeachers.has(b.teacher_id ?? '') && b.teacher_id !== null) return false
      return getWeekDayIndex(b.scheduled_at) === selectedDay
    })

    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        {/* Day nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <button onClick={() => navigate('prev')} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>{tx.weekBack}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelectedDay(Math.max(0, selectedDay - 1))} disabled={selectedDay === 0} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: selectedDay === 0 ? '#D1D5DB' : '#374151', fontSize: 13, cursor: selectedDay === 0 ? 'default' : 'pointer' }}>◀</button>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111', padding: '6px 12px' }}>
              {d?.short} {d?.full}
            </span>
            <button onClick={() => setSelectedDay(Math.min(6, selectedDay + 1))} disabled={selectedDay === 6} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: selectedDay === 6 ? '#D1D5DB' : '#374151', fontSize: 13, cursor: selectedDay === 6 ? 'default' : 'pointer' }}>▶</button>
          </div>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{tx.bookingsCount(dayBookings.length)}</span>
        </div>

        {/* Day tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', overflowX: 'auto' }}>
          {dayLabels.map((dl, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              style={{
                flex: '1 0 auto',
                padding: '8px 12px',
                border: 'none',
                borderBottom: selectedDay === i ? '2px solid #C41E3A' : '2px solid transparent',
                background: 'transparent',
                color: selectedDay === i ? '#C41E3A' : '#6B7280',
                fontSize: 12,
                fontWeight: selectedDay === i ? 700 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {dl.short}
            </button>
          ))}
        </div>

        {/* Time grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', overflowY: 'auto', maxHeight: 600 }}>
          <div style={{ position: 'relative', height: calHeight }}>
            {hours.map(h => (
              <div key={h} style={{ position: 'absolute', top: (h - CAL_START_HOUR) * HOUR_HEIGHT, left: 0, right: 0 }}>
                <span style={{ fontSize: 10, color: '#9CA3AF', paddingLeft: 8, paddingTop: 4, display: 'block' }}>
                  {hourLabel(h)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ position: 'relative', height: calHeight, borderLeft: '1px solid #F3F4F6' }}>
            {hours.map(h => (
              <div key={h} style={{ position: 'absolute', top: (h - CAL_START_HOUR) * HOUR_HEIGHT, left: 0, right: 0, height: 1, background: '#F3F4F6' }} />
            ))}
            {dayBookings.map(b => {
              const hnHour = toHNHour(b.scheduled_at)
              const hnMin = toHNMinute(b.scheduled_at)
              const dur = b.duration_minutes ?? 60
              const topPx = (hnHour - CAL_START_HOUR + hnMin / 60) * HOUR_HEIGHT
              const heightPx = Math.max((dur / 60) * HOUR_HEIGHT, 28)
              const colors = getBookingColor(b.status, b.type)
              const isSelected = selectedBooking?.id === b.id

              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBooking(b)}
                  style={{
                    position: 'absolute',
                    top: topPx + 1,
                    height: heightPx - 2,
                    left: 4,
                    right: 4,
                    background: colors.bg,
                    border: `1px solid ${isSelected ? '#C41E3A' : colors.border}`,
                    borderRadius: 8,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    boxShadow: isSelected ? '0 0 0 2px rgba(196,30,58,0.3)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: colors.text, margin: 0 }}>{b.student_name || tx.studentFallback}</p>
                    <p style={{ fontSize: 11, color: '#6B7280', margin: '1px 0 0' }}>
                      {new Date(b.scheduled_at).toLocaleTimeString(DLOC, { hour: '2-digit', minute: '2-digit', timeZone: 'America/Tegucigalpa' })} · {b.duration_minutes ? tx.minTight(b.duration_minutes) : ''}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{b.teacher_name?.split(' ')[0] || tx.unassigned}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  function renderBoardView() {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
          {/* Unassigned column */}
          <Droppable droppableId="unassigned">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                style={{ width: 220, minHeight: 400, background: '#FFFBEB', borderRadius: 12, border: '1px solid #FCD34D', padding: 12, flexShrink: 0 }}
              >
                <p style={{ fontSize: 12, fontWeight: 700, color: '#D97706', marginBottom: 8 }}>
                  {tx.unassignedCol(unassignedBookings.length)}
                </p>
                {unassignedBookings.map((b, index) => (
                  <Draggable key={b.id} draggableId={b.id} index={index}>
                    {(prov, snapshot) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        {...prov.dragHandleProps}
                        onClick={() => setSelectedBooking(b)}
                        style={{
                          ...prov.draggableProps.style,
                          background: snapshot.isDragging ? '#FEF3C7' : '#fff',
                          border: '1px solid #FCD34D',
                          borderRadius: 8,
                          padding: '8px 10px',
                          marginBottom: 8,
                          cursor: 'grab',
                          boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                        }}
                      >
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#111', margin: 0 }}>
                          {b.student_name?.split(' ')[0] || tx.studentFallback}
                        </p>
                        <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>
                          {new Date(b.scheduled_at).toLocaleString(DLOC, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Tegucigalpa' })}
                        </p>
                        <p style={{ fontSize: 10, color: '#9CA3AF', margin: '2px 0 0', textTransform: 'capitalize' }}>{typeLabel(b.type)}</p>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Teacher columns */}
          {filteredTeachers.map(teacher => {
            const teacherBookings = bookings.filter(b => b.teacher_id === teacher.id && b.status !== 'cancelled')
            return (
              <Droppable key={teacher.id} droppableId={`teacher:${teacher.id}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      width: 200,
                      minHeight: 400,
                      background: snapshot.isDraggingOver ? '#F0FDF4' : '#F9FAFB',
                      borderRadius: 12,
                      border: `1px solid ${snapshot.isDraggingOver ? '#86EFAC' : '#E5E7EB'}`,
                      padding: 12,
                      flexShrink: 0,
                      transition: 'all 0.15s',
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                      {teacher.name.split(' ')[0].toUpperCase()}
                    </p>
                    <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8 }}>{tx.bookingsCount(teacherBookings.length)}</p>
                    {teacherBookings.map((b, index) => {
                      const colors = getBookingColor(b.status, b.type)
                      return (
                        <Draggable key={b.id} draggableId={b.id} index={index} isDragDisabled={b.status !== 'pending'}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              onClick={() => setSelectedBooking(b)}
                              style={{
                                ...prov.draggableProps.style,
                                background: snap.isDragging ? '#E0F2FE' : colors.bg,
                                border: `1px solid ${colors.border}`,
                                borderRadius: 8,
                                padding: '8px 10px',
                                marginBottom: 8,
                                cursor: 'pointer',
                              }}
                            >
                              <p style={{ fontSize: 12, fontWeight: 600, color: colors.text, margin: 0 }}>
                                {b.student_name?.split(' ')[0] || tx.studentFallback}
                              </p>
                              <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>
                                {new Date(b.scheduled_at).toLocaleString(DLOC, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Tegucigalpa' })}
                              </p>
                              <span style={{ fontSize: 10, color: colors.text, textTransform: 'capitalize' }}>{statusLabel(b.status)}</span>
                            </div>
                          )}
                        </Draggable>
                      )
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )
          })}
        </div>
      </DragDropContext>
    )
  }

  function renderDetailPanel() {
    const b = selectedBooking!
    const badge = getStatusBadge(b.status)

    return (
      <div style={{
        width: 320,
        flexShrink: 0,
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: 20,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        position: 'sticky',
        top: 20,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{tx.bookingDetail}</p>
            <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color, textTransform: 'capitalize' }}>
              {statusLabel(b.status)}
            </span>
          </div>
          <button
            onClick={() => { setSelectedBooking(null); setConfirmCancel(false); setShowAiSummary(false) }}
            style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Student */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 2px', fontWeight: 600 }}>{tx.student}</p>
          <a href={`/${lang}/admin/students/${b.student_id}`} style={{ fontSize: 14, fontWeight: 700, color: '#111', textDecoration: 'none' }}>
            {b.student_name || '—'}
          </a>
          {b.student_email && <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>{b.student_email}</p>}
          {b.student_level && <span style={{ fontSize: 10, color: '#7C3AED', background: '#F5F3FF', padding: '2px 6px', borderRadius: 10, marginTop: 4, display: 'inline-block' }}>{b.student_level}</span>}
        </div>

        {/* Teacher */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 2px', fontWeight: 600 }}>{tx.teacher}</p>
          {b.teacher_id ? (
            <a href={`/${lang}/admin/teachers/${b.teacher_id}`} style={{ fontSize: 14, fontWeight: 600, color: '#374151', textDecoration: 'none' }}>
              {b.teacher_name || tx.unknown}
            </a>
          ) : (
            <span style={{ fontSize: 13, color: '#D97706' }}>{tx.unassigned}</span>
          )}
        </div>

        {/* Conductor — only relevant for placement calls, which carry an admin-run interviewer on top of the teacher */}
        {b.type === 'placement_test' && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 2px', fontWeight: 600 }}>{tx.conductor}</p>
            {b.conductor_name ? (
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{b.conductor_name}</span>
            ) : (
              <span style={{ fontSize: 13, color: '#D97706' }}>{tx.unassigned}</span>
            )}
          </div>
        )}

        {/* Date/time */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 2px', fontWeight: 600 }}>{tx.scheduled}</p>
          <p style={{ fontSize: 13, color: '#111', margin: 0, fontWeight: 600 }}>
            {new Date(b.scheduled_at).toLocaleString(DLOC, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Tegucigalpa' })}
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{tx.hondurasTime}</p>
        </div>

        {/* Duration + Type */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 2px', fontWeight: 600 }}>{tx.duration}</p>
            <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{b.duration_minutes ? tx.minShort(b.duration_minutes) : '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 2px', fontWeight: 600 }}>{tx.type}</p>
            <p style={{ fontSize: 13, color: '#374151', margin: 0, textTransform: 'capitalize' }}>{typeLabel(b.type)}</p>
          </div>
        </div>

        {/* Meeting notes */}
        {b.meeting_notes && (
          <div style={{ marginBottom: 14, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px', fontWeight: 600 }}>{tx.meetingNotes}</p>
            <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>{b.meeting_notes}</p>
          </div>
        )}

        {/* AI Summary */}
        {b.ai_summary && (
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={() => setShowAiSummary(!showAiSummary)}
              style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 700, color: '#7C3AED', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {showAiSummary ? '▾' : '▸'} {tx.aiSummary}
            </button>
            {showAiSummary && (
              <div style={{ marginTop: 6, padding: '10px 12px', background: '#F5F3FF', borderRadius: 8, border: '1px solid #C4B5FD' }}>
                <p style={{ fontSize: 12, color: '#4B5563', margin: 0, lineHeight: 1.5 }}>{b.ai_summary}</p>
              </div>
            )}
          </div>
        )}

        {/* Student rating */}
        {b.student_rating !== null && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px', fontWeight: 600 }}>{tx.studentRating}</p>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} style={{ fontSize: 16, color: star <= (b.student_rating ?? 0) ? '#F59E0B' : '#E5E7EB' }}>★</span>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop: '1px solid #E5E7EB', margin: '16px 0' }} />

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Assign teacher (always show if not completed/cancelled) */}
          {b.status !== 'completed' && b.status !== 'cancelled' && (
            <div>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 6px', fontWeight: 600 }}>{tx.assignTeacher}</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={detailAssignTeacher}
                  onChange={e => setDetailAssignTeacher(e.target.value)}
                  disabled={isPending}
                  style={{ flex: 1, borderRadius: 7, border: '1px solid #E5E7EB', padding: '7px 10px', fontSize: 12, color: '#111', background: '#fff', outline: 'none' }}
                >
                  <option value="">{tx.selectTeacher}</option>
                  {teachers.map(t => {
                    const ok = isTeacherAvailableClient(t.id, availSlots, b.scheduled_at, b.duration_minutes || 60)
                    // Paused teachers can't take a NEW student (server-gated), so
                    // disable selection unless they already serve this student
                    // (i.e. they're the booking's current teacher). See TE-01.
                    const isCurrent = b.teacher_id === t.id
                    const paused = !t.accepting && !isCurrent
                    const label = paused
                      ? tx.pausedOption(t.name)
                      : ok ? tx.okOption(t.name) : tx.offHoursOption(t.name)
                    return (
                      <option key={t.id} value={t.id} disabled={paused}>
                        {label}
                      </option>
                    )
                  })}
                </select>
                <button
                  onClick={handleAssignFromPanel}
                  disabled={isPending || !detailAssignTeacher}
                  style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: detailAssignTeacher ? '#111' : '#E5E7EB', color: detailAssignTeacher ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: detailAssignTeacher ? 'pointer' : 'default' }}
                >
                  {isPending ? '…' : tx.assign}
                </button>
              </div>
            </div>
          )}

          {/* Complete */}
          {b.status === 'confirmed' && (
            <button
              onClick={handleComplete}
              disabled={isPending}
              style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}
            >
              {tx.markComplete}
            </button>
          )}

          {/* Video room — admin can observe any confirmed session */}
          {b.status === 'confirmed' && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <JoinSessionButton
                lang={lang as Locale}
                bookingId={b.id}
                scheduledAt={b.scheduled_at}
                variant="secondary"
              />
            </div>
          )}

          {/* Cancel */}
          {(b.status === 'pending' || b.status === 'confirmed') && (
            confirmCancel ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleCancel}
                  disabled={isPending}
                  style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {tx.confirmCancelBtn}
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}
                >
                  {tx.no}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCancel(true)}
                style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'rgba(220,38,38,0.05)', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {tx.cancelBooking}
              </button>
            )
          )}
        </div>
      </div>
    )
  }

  function renderAvailabilityPanel() {
    const hours = Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }, (_, i) => CAL_START_HOUR + i)
    return (
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }}>{tx.availToday}</p>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{tx.dayOfWeek(new Date().toLocaleDateString(DLOC, { weekday: 'long', timeZone: 'America/Tegucigalpa' }))}</span>
        </div>
        <div style={{ padding: 16, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#9CA3AF', fontWeight: 600, fontSize: 11 }}>{tx.hour}</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#059669', fontWeight: 600, fontSize: 11 }}>{tx.available}</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#9CA3AF', fontWeight: 600, fontSize: 11 }}>{tx.busy}</th>
              </tr>
            </thead>
            <tbody>
              {hours.map(h => {
                const { available, busy } = getAvailabilityForHour(h)
                if (available.length === 0 && busy.length === 0) return null
                return (
                  <tr key={h} style={{ borderTop: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '4px 8px', color: '#374151', fontWeight: 600 }}>
                      {hourLabel(h)}
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      {available.map(n => (
                        <span key={n} style={{ display: 'inline-block', marginRight: 4, padding: '1px 6px', background: '#F0FDF4', color: '#059669', borderRadius: 10, fontSize: 11 }}>{n}</span>
                      ))}
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      {busy.map(n => (
                        <span key={n} style={{ display: 'inline-block', marginRight: 4, padding: '1px 6px', background: '#F3F4F6', color: '#9CA3AF', borderRadius: 10, fontSize: 11 }}>{n}</span>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Page header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ek-text-muted)',
              marginBottom: 6,
            }}
          >
            {tx.kicker}
          </div>
          <h1
            style={{
              fontFamily: 'var(--ek-font-sans)',
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: 'var(--ek-text)',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {tx.bookings}{' '}
            <span style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--ek-text-muted)' }}>
              {tx.thisWeek}
            </span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', margin: '6px 0 0' }}>
            {tx.visualCalendar}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['week', 'day', 'board'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                background: view === v ? '#111' : '#fff',
                color: view === v ? '#fff' : '#374151',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {viewLabel(v)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: tx.statToday, value: stats.todayCount },
          { label: tx.statPending, value: stats.pendingCount, red: stats.pendingCount > 0 },
          { label: tx.statConfirmed, value: stats.weekConfirmed },
          { label: tx.statSlots, value: stats.availableSlots },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: (s as { red?: boolean }).red ? '#C41E3A' : '#111', margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending assignments — top of page so admin sees them first */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 12 }}>
          {tx.pendingAssignments(pendingBookings.length)}
        </h2>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {[tx.thStudent, tx.thScheduled, tx.thType, tx.thDuration, tx.thAssign].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    {tx.noPending}
                  </td>
                </tr>
              ) : pendingBookings.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: '#111' }}>{b.student_name || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#4B5563' }}>
                    {new Date(b.scheduled_at).toLocaleString(DLOC, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Tegucigalpa' })}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', textTransform: 'capitalize' }}>{typeLabel(b.type)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#4B5563' }}>{b.duration_minutes ? tx.minShort(b.duration_minutes) : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <BookingAssign
                      bookingId={b.id}
                      currentTeacherId={null}
                      teachers={teachers}
                      scheduledAt={b.scheduled_at}
                      durationMinutes={b.duration_minutes}
                      availSlots={availSlots}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Main area */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Teacher filter sidebar */}
        {view !== 'board' && renderTeacherFilter()}

        {/* Calendar / board */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
          {view === 'board' && renderBoardView()}
        </div>

        {/* Detail panel */}
        {selectedBooking && renderDetailPanel()}
      </div>

      {/* Availability toggle */}
      <div style={{ marginTop: 20 }}>
        <button
          onClick={() => setShowAvailability(!showAvailability)}
          style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' }}
        >
          {showAvailability ? '▾' : '▸'} {tx.availPanelToggle}
        </button>
        {showAvailability && renderAvailabilityPanel()}
      </div>
    </div>
  )
}

