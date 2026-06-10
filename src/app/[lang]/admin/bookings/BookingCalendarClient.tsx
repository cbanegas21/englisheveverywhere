'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { assignAndConfirmBooking, cancelBookingWithRefund, completeBooking, adminRescheduleBooking } from '../actions'
import BookingAssign from './BookingAssign'
import { isTeacherAvailableClient } from './availability'
import JoinSessionButton from '@/components/JoinSessionButton'
import Drawer from '@/components/dashboard/Drawer'
import Modal from '@/components/dashboard/Modal'
import { StatLedger } from '@/components/ui/StatLedger'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { getZonedParts, zonedWallTimeToUtc } from '@/lib/timezone'
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
  timezone: string
  weekStart: string // Monday of the visible week, as a zoned 'YYYY-MM-DD'
  bookings: BookingEntry[]
  teachers: TeacherEntry[]
  availSlots: AvailSlot[]
  pendingBookings: PendingEntry[]
  stats: { todayCount: number; pendingCount: number; weekConfirmed: number }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROW_HEIGHT = 48
const BUSINESS_START = 6   // default top of the visible grid (06:00)
const BUSINESS_END = 22    // default bottom (22:00) — expands to fit out-of-hours bookings
const LIVE_GRACE_MIN = 90  // a confirmed class stays "live" until end + 90m (mirrors getRoomAccess)

// Per-teacher identity tints — muted, warm, brand-harmonized so they sit on the
// cream canvas WITHOUT becoming stoplight status colors. Status is still carried
// by linework (solid/dashed border) + crimson-for-live ONLY. The tint paints a
// thin LEFT-EDGE bar on each event so an admin can scan "whose class is this" at
// a glance (the AD-03 teacher-identity decision).
const TEACHER_TINTS = ['#AD7A55', '#82804F', '#5F6F77', '#856079', '#4F726A', '#9C7A3E']

// ── i18n ──────────────────────────────────────────────────────────────────────
// The whole app (admin included) localizes off the /[lang] segment. Server-action
// error strings stay English by design (admin-facing), so the override-retry
// matching below keys on the English server phrases, not these display strings.

const STR = {
  en: {
    // toasts / prompts
    assigned: 'Assigned and confirmed',
    assignFailed: 'Assignment failed',
    markedComplete: 'Booking marked complete',
    error: 'Error',
    cancelledRefunded: 'Booking cancelled — class credit refunded',
    moved: 'Booking moved',
    conflictTitle: 'Heads up',
    continueAnyway: 'Continue anyway',
    cancel: 'Cancel',
    ok: 'OK',
    rescheduleKicker: '↳ Reschedule',
    assignKicker: '↳ Assign',
    dragHint: 'Drag a class to reschedule',
    // teacher filter + legend
    teachers: 'Teachers',
    allTeachers: 'All teachers',
    legend: 'Status',
    legPending: 'Pending',
    legConfirmed: 'Confirmed',
    legCompleted: 'Completed',
    legLive: 'Live now',
    // nav
    prev: 'Prev',
    next: 'Next',
    today: 'Today',
    bookingsCount: (n: number) => `${n} ${n === 1 ? 'booking' : 'bookings'}`,
    showAllHours: 'All hours',
    showBusinessHours: '6am – 10pm',
    nothingDay: 'Nothing scheduled.',
    // fallbacks
    studentFallback: 'Student',
    unassigned: 'Unassigned',
    unknown: 'Unknown',
    live: 'Live',
    // detail drawer
    bookingDetail: 'Booking',
    student: 'Student',
    teacher: 'Teacher',
    conductor: 'Conductor',
    scheduled: 'When',
    yourZone: (z: string) => `Times in ${z}`,
    duration: 'Duration',
    type: 'Type',
    meetingNotes: 'Meeting notes',
    aiSummary: 'AI summary',
    studentRating: 'Student rating',
    assignTeacher: 'Assign teacher',
    selectTeacher: 'Select teacher…',
    pausedOption: (name: string) => `${name} (paused — not accepting)`,
    okOption: (name: string) => `${name} (available)`,
    offHoursOption: (name: string) => `${name} (off-hours)`,
    assign: 'Assign',
    markComplete: 'Mark complete',
    confirmCancelBtn: 'Confirm cancel',
    no: 'Keep',
    cancelBooking: 'Cancel booking',
    reschedule: 'Reschedule',
    save: 'Save',
    // page header
    kicker: '↳ Admin · Operations',
    bookings: 'Bookings',
    thisWeek: 'this week',
    calendarSub: (z: string) => `Calendar · times in your timezone (${z})`,
    viewWeek: 'Week',
    viewDay: 'Day',
    // stats
    statToday: 'Bookings Today',
    statPending: 'Pending Assignment',
    statConfirmed: 'Confirmed This Week',
    statLive: 'Live Now',
    // pending table
    pendingAssignments: (n: number) => `Pending Assignments (${n})`,
    pendingKicker: '↳ Needs a teacher',
    thStudent: 'Student',
    thScheduled: 'Scheduled',
    thType: 'Type',
    thDuration: 'Duration',
    thAssign: 'Assign Teacher',
    noPending: 'No pending assignments. All caught up.',
    minShort: (m: number) => `${m} min`,
    minTight: (m: number) => `${m}min`,
    status: { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' } as Record<string, string>,
    types: { class: 'Class', placement_test: 'Placement test', teacher_interview: 'Teacher interview', admin_checkin: 'Admin check-in' } as Record<string, string>,
  },
  es: {
    assigned: 'Asignado y confirmado',
    assignFailed: 'Falló la asignación',
    markedComplete: 'Sesión marcada como completada',
    error: 'Error',
    cancelledRefunded: 'Sesión cancelada — crédito de clase reembolsado',
    moved: 'Reserva movida',
    conflictTitle: 'Atención',
    continueAnyway: 'Continuar de todos modos',
    cancel: 'Cancelar',
    ok: 'Entendido',
    rescheduleKicker: '↳ Reprogramar',
    assignKicker: '↳ Asignar',
    dragHint: 'Arrastra una clase para reprogramar',
    teachers: 'Maestros',
    allTeachers: 'Todos los maestros',
    legend: 'Estado',
    legPending: 'Pendiente',
    legConfirmed: 'Confirmada',
    legCompleted: 'Completada',
    legLive: 'En vivo',
    prev: 'Anterior',
    next: 'Siguiente',
    today: 'Hoy',
    bookingsCount: (n: number) => `${n} ${n === 1 ? 'reserva' : 'reservas'}`,
    showAllHours: 'Todas las horas',
    showBusinessHours: '6am – 10pm',
    nothingDay: 'Nada agendado.',
    studentFallback: 'Estudiante',
    unassigned: 'Sin asignar',
    unknown: 'Desconocido',
    live: 'En vivo',
    bookingDetail: 'Reserva',
    student: 'Estudiante',
    teacher: 'Maestro',
    conductor: 'Conductor',
    scheduled: 'Cuándo',
    yourZone: (z: string) => `Horas en ${z}`,
    duration: 'Duración',
    type: 'Tipo',
    meetingNotes: 'Notas de la reunión',
    aiSummary: 'Resumen IA',
    studentRating: 'Calificación del estudiante',
    assignTeacher: 'Asignar maestro',
    selectTeacher: 'Seleccionar maestro…',
    pausedOption: (name: string) => `${name} (en pausa — no acepta)`,
    okOption: (name: string) => `${name} (disponible)`,
    offHoursOption: (name: string) => `${name} (fuera de horario)`,
    assign: 'Asignar',
    markComplete: 'Marcar completada',
    confirmCancelBtn: 'Confirmar cancelación',
    no: 'Conservar',
    cancelBooking: 'Cancelar reserva',
    reschedule: 'Reprogramar',
    save: 'Guardar',
    kicker: '↳ Admin · Operaciones',
    bookings: 'Reservas',
    thisWeek: 'esta semana',
    calendarSub: (z: string) => `Calendario · horas en tu zona (${z})`,
    viewWeek: 'Semana',
    viewDay: 'Día',
    statToday: 'Reservas de hoy',
    statPending: 'Pendientes de asignar',
    statConfirmed: 'Confirmadas esta semana',
    statLive: 'En vivo ahora',
    pendingAssignments: (n: number) => `Asignaciones pendientes (${n})`,
    pendingKicker: '↳ Necesita maestro',
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

// ── Zoned-day helpers (calendar arithmetic in the admin's profile zone) ─────────
// Mirrors the student AgendarClient: build the grid from wall-clock y/m/d in the
// viewer's zone so day boundaries + columns match what the rest of the app shows.

interface ZDay { year: number; month: number; day: number }
function addDays(d: ZDay, n: number): ZDay {
  const dt = new Date(Date.UTC(d.year, d.month, d.day + n))
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth(), day: dt.getUTCDate() }
}
function weekdayOf(d: ZDay): number {
  return new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay()
}
function sameDay(a: ZDay, b: ZDay): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}
function todayInZone(tz: string): ZDay {
  const p = getZonedParts(new Date(), tz)
  return { year: p.year, month: p.month, day: p.day }
}
function parseZDay(ymd: string): ZDay {
  const [y, m, d] = ymd.split('-').map(Number)
  return { year: y, month: (m || 1) - 1, day: d || 1 }
}
const pad2 = (n: number) => String(n).padStart(2, '0')
// Format a zoned calendar day itself: build as UTC noon + read back in UTC so the
// rendered weekday/month/day equals the ZDay exactly (no second tz shift).
function formatZDay(day: ZDay, locale: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(Date.UTC(day.year, day.month, day.day, 12)).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' })
}

// ── Component ───────────────────────────────────────────────────────────────────

export default function BookingCalendarClient({
  lang,
  timezone,
  weekStart,
  bookings,
  teachers,
  availSlots,
  pendingBookings,
  stats,
}: Props) {
  const router = useRouter()
  const [view, setView] = useState<'week' | 'day'>('week')
  const [selectedBooking, setSelectedBooking] = useState<BookingEntry | null>(null)
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set(teachers.map(t => t.id)))
  const [selectedDay, setSelectedDay] = useState(0)
  const [showAllHours, setShowAllHours] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [detailAssignTeacher, setDetailAssignTeacher] = useState('')
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [conflict, setConflict] = useState<{ kicker: string; message: string; force?: () => void } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<{ dayIdx: number; topPx: number; label: string } | null>(null)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rDate, setRDate] = useState('')
  const [rTime, setRTime] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)
  const dragGrabPx = useRef(0)
  // Source of truth for the in-flight drag — a ref so dragover/drop read it
  // synchronously (not gated on a React re-render landing after dragstart).
  const draggingIdRef = useRef<string | null>(null)

  // Refresh "now" every minute so the live/expired state + countdown stay current.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // ── i18n bindings ──────────────────────────────────────────────────────────
  const L: 'en' | 'es' = lang === 'es' ? 'es' : 'en'
  const tx = STR[L]
  const DLOC = L === 'es' ? 'es-HN' : 'en-US'
  const zoneLabel = (timezone.split('/').pop() || timezone).replace(/_/g, ' ')
  function hourLabel(h: number): string {
    // ES uses 24h (natural for Honduras, fits the 60px gutter); EN keeps 12h am/pm.
    if (L === 'es') return `${String(h).padStart(2, '0')}:00`
    return h === 0 ? '12am' : h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`
  }
  function timeOf(iso: string): string {
    return new Date(iso).toLocaleTimeString(DLOC, { hour: '2-digit', minute: '2-digit', timeZone: timezone })
  }
  const typeLabel = (type: string) => tx.types[type] ?? type.replace(/_/g, ' ')
  const statusLabel = (status: string) => tx.status[status] ?? status

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Week model (in the admin's zone) ─────────────────────────────────────────
  const monday = useMemo(() => parseZDay(weekStart), [weekStart])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday])
  const today = useMemo(() => todayInZone(timezone), [timezone, nowMs])

  // Stable per-teacher tint by list order (loader orders teachers by created_at).
  const teacherTint = useMemo(() => {
    const m = new Map<string, string>()
    teachers.forEach((t, i) => m.set(t.id, TEACHER_TINTS[i % TEACHER_TINTS.length]))
    return m
  }, [teachers])

  const navigate = (dir: 'prev' | 'next') => {
    const target = addDays(monday, dir === 'next' ? 7 : -7)
    router.push(`/${lang}/admin/bookings?weekStart=${target.year}-${String(target.month + 1).padStart(2, '0')}-${String(target.day).padStart(2, '0')}`)
  }
  const goToday = () => router.push(`/${lang}/admin/bookings`)

  // ── Booking placement (bucket by zoned day + position by zoned hour) ──────────
  type Placed = { b: BookingEntry; dayIdx: number; hour: number; minute: number }
  const placed = useMemo<Placed[]>(() => {
    const out: Placed[] = []
    for (const b of bookings) {
      const p = getZonedParts(new Date(b.scheduled_at), timezone)
      const dayIdx = weekDays.findIndex(d => d.year === p.year && d.month === p.month && d.day === p.day)
      if (dayIdx < 0) continue
      out.push({ b, dayIdx, hour: p.hour, minute: p.minute })
    }
    return out
  }, [bookings, weekDays, timezone])

  // Hour extent: default business window, EXPANDED so an out-of-hours booking is
  // never hidden. all-hours toggle shows the full 24h.
  const [startHour, endHour] = useMemo<[number, number]>(() => {
    if (showAllHours) return [0, 24]
    let lo = BUSINESS_START
    let hi = BUSINESS_END
    for (const pl of placed) {
      lo = Math.min(lo, pl.hour)
      const dur = pl.b.duration_minutes ?? 60
      const endHourF = pl.hour + (pl.minute + dur) / 60
      hi = Math.max(hi, Math.ceil(endHourF))
    }
    return [Math.max(0, Math.min(lo, 23)), Math.min(24, Math.max(hi, BUSINESS_END))]
  }, [placed, showAllHours])

  const hours = useMemo(() => Array.from({ length: endHour - startHour }, (_, i) => startHour + i), [startHour, endHour])
  const calHeight = (endHour - startHour) * ROW_HEIGHT

  // Auto-scroll the grid to the business start when the week / hour range changes.
  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = Math.max(0, (BUSINESS_START - startHour)) * ROW_HEIGHT
  }, [startHour, weekStart, view])

  const isLive = (b: BookingEntry): boolean => {
    if (b.status !== 'confirmed') return false
    const start = Date.parse(b.scheduled_at)
    const end = start + (b.duration_minutes ?? 60) * 60_000 + LIVE_GRACE_MIN * 60_000
    return nowMs >= start && nowMs <= end
  }
  const liveCount = useMemo(() => bookings.filter(isLive).length, [bookings, nowMs])

  // ── Event visual (status linework + crimson-for-live ONLY) ───────────────────
  function eventStyle(b: BookingEntry, selected: boolean): React.CSSProperties {
    const live = isLive(b)
    let bg = 'var(--ek-card)'
    let borderColor = 'var(--ek-border-mid)'
    let dashed = false
    if (live) { bg = 'var(--ek-red-tint)'; borderColor = 'var(--ek-red)' }
    else if (b.status === 'completed') { bg = 'var(--ek-paper)'; borderColor = 'var(--ek-border)' }
    else if (b.status === 'pending') { dashed = true }
    return {
      background: bg,
      border: `1px ${dashed ? 'dashed' : 'solid'} ${selected ? 'var(--ek-red)' : borderColor}`,
      boxShadow: selected ? '0 0 0 2px var(--ek-red-tint-3)' : 'none',
    }
  }
  function eventTextColor(b: BookingEntry): string {
    if (isLive(b)) return 'var(--ek-red)'
    if (b.status === 'completed') return 'var(--ek-text-soft)'
    if (b.status === 'pending') return 'var(--ek-text-muted)'
    return 'var(--ek-text)'
  }
  const edgeColor = (b: BookingEntry): string => (b.teacher_id ? teacherTint.get(b.teacher_id) ?? 'var(--ek-border-mid)' : 'var(--ek-red)')

  // ── Conflict surfacing (shared by assign + reschedule) ───────────────────────
  // Server guard messages stay English by design (admin-facing) and are matched
  // here to decide whether the failure is force-overridable (off-hours availability
  // / primary-teacher continuity) → offer "Continue anyway"; hard invariants get OK.
  function showConflict(kicker: string, message: string, retry: () => void) {
    const lower = message.toLowerCase()
    const forceable = lower.includes('not available') || lower.includes('primary teacher')
    setConflict({ kicker, message, force: forceable ? retry : undefined })
  }

  function assignWithAvailabilityGuard(bookingId: string, teacherId: string, onSuccess: () => void, force = false) {
    startTransition(async () => {
      try {
        await assignAndConfirmBooking(bookingId, teacherId, { force })
        setConflict(null)
        showToast(tx.assigned)
        onSuccess()
      } catch (e) {
        const msg = e instanceof Error ? e.message : tx.assignFailed
        showConflict(tx.assignKicker, msg, () => assignWithAvailabilityGuard(bookingId, teacherId, onSuccess, true))
      }
    })
  }

  // ── Drag-to-reschedule ───────────────────────────────────────────────────────
  function attemptReschedule(bookingId: string, newIso: string, force = false, onSuccess?: () => void) {
    startTransition(async () => {
      try {
        await adminRescheduleBooking(bookingId, newIso, { force })
        setConflict(null)
        showToast(tx.moved)
        onSuccess?.()
        router.refresh()
      } catch (e) {
        const msg = e instanceof Error ? e.message : tx.error
        showConflict(tx.rescheduleKicker, msg, () => attemptReschedule(bookingId, newIso, true, onSuccess))
      }
    })
  }
  function fmtSlotLabel(hour: number, minute: number): string {
    if (L === 'es') return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    const ap = hour < 12 ? 'am' : 'pm'
    const hh = hour % 12 === 0 ? 12 : hour % 12
    return `${hh}:${String(minute).padStart(2, '0')}${ap}`
  }
  // Snap the cursor (minus where in the block it was grabbed) to a 15-min slot,
  // clamped to the visible hour range. e.currentTarget is the day column.
  function snapFromEvent(e: React.DragEvent): { hour: number; minute: number; topPx: number; label: string } {
    const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - colRect.top - dragGrabPx.current
    let totalMin = Math.round((startHour * 60 + (y / ROW_HEIGHT) * 60) / 15) * 15
    totalMin = Math.max(startHour * 60, Math.min(totalMin, endHour * 60 - 15))
    const hour = Math.floor(totalMin / 60)
    const minute = totalMin % 60
    return { hour, minute, topPx: (totalMin / 60 - startHour) * ROW_HEIGHT, label: fmtSlotLabel(hour, minute) }
  }
  function endDrag() {
    draggingIdRef.current = null
    setDraggingId(null)
    setDropHint(null)
  }
  function onEventDragStart(e: React.DragEvent, b: BookingEntry) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragGrabPx.current = e.clientY - rect.top
    draggingIdRef.current = b.id
    setDraggingId(b.id)
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', b.id) } catch { /* some engines require setData to start a drag */ }
  }
  function onColumnDragOver(e: React.DragEvent, dayIdx: number) {
    if (!draggingIdRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const { topPx, label } = snapFromEvent(e)
    setDropHint({ dayIdx, topPx, label })
  }
  function onColumnDrop(e: React.DragEvent, dayIdx: number) {
    const id = draggingIdRef.current
    if (!id) return
    e.preventDefault()
    const { hour, minute } = snapFromEvent(e)
    const zday = weekDays[dayIdx]
    const newUtc = zonedWallTimeToUtc(zday.year, zday.month, zday.day, hour, minute, timezone)
    endDrag()
    attemptReschedule(id, newUtc.toISOString())
  }

  function handleAssignFromDrawer() {
    if (!selectedBooking || !detailAssignTeacher) return
    assignWithAvailabilityGuard(selectedBooking.id, detailAssignTeacher, () => {
      setSelectedBooking(null)
      setDetailAssignTeacher('')
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

  function closeDrawer() {
    setSelectedBooking(null)
    setConfirmCancel(false)
    setShowAiSummary(false)
    setDetailAssignTeacher('')
    setRescheduleOpen(false)
  }
  // Non-drag reschedule (Drawer): works on touch + keyboard, where HTML5 drag
  // never fires. Prefills the booking's current zoned date/time, converts the
  // edited wall-clock back to UTC in the admin's zone, and runs the same guards.
  function openReschedule() {
    if (!selectedBooking) return
    const p = getZonedParts(new Date(selectedBooking.scheduled_at), timezone)
    setRDate(`${p.year}-${pad2(p.month + 1)}-${pad2(p.day)}`)
    setRTime(`${pad2(p.hour)}:${pad2(p.minute)}`)
    setRescheduleOpen(true)
  }
  function saveReschedule() {
    if (!selectedBooking || !rDate || !rTime) return
    const [y, m, d] = rDate.split('-').map(Number)
    const [h, min] = rTime.split(':').map(Number)
    const iso = zonedWallTimeToUtc(y, (m || 1) - 1, d || 1, h || 0, min || 0, timezone).toISOString()
    attemptReschedule(selectedBooking.id, iso, false, closeDrawer)
  }

  // ── Grid renderer (shared by week + day) ─────────────────────────────────────
  function renderGrid(cols: number[]) {
    const single = cols.length === 1
    return (
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `52px repeat(${cols.length}, minmax(0, 1fr))`,
          overflowY: 'auto',
          maxHeight: 620,
        }}
      >
        {/* Hour gutter */}
        <div style={{ position: 'relative', height: calHeight }}>
          {hours.map(h => (
            <div key={h} style={{ position: 'absolute', top: (h - startHour) * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}>
              <span style={{ fontSize: 10, color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', paddingLeft: 8, paddingTop: 3, display: 'block', userSelect: 'none', fontFeatureSettings: '"tnum"' }}>
                {hourLabel(h)}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {cols.map((dayIdx) => {
          const zday = weekDays[dayIdx]
          const isToday = sameDay(zday, today)
          const dayPlaced = placed.filter(pl => pl.dayIdx === dayIdx && (pl.b.teacher_id === null || selectedTeachers.has(pl.b.teacher_id)))
          return (
            <div
              key={dayIdx}
              data-ek-col={dayIdx}
              onDragOver={(e) => onColumnDragOver(e, dayIdx)}
              onDrop={(e) => onColumnDrop(e, dayIdx)}
              style={{
                position: 'relative',
                height: calHeight,
                borderLeft: '1px solid var(--ek-border-soft)',
                background: isToday ? 'var(--ek-red-tint)' : 'transparent',
              }}
            >
              {/* Hour gridlines */}
              {hours.map(h => (
                <div key={h} style={{ position: 'absolute', top: (h - startHour) * ROW_HEIGHT, left: 0, right: 0, height: 1, background: 'var(--ek-border-soft)' }} />
              ))}

              {/* Drag drop indicator */}
              {dropHint && dropHint.dayIdx === dayIdx && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: dropHint.topPx, height: 0, borderTop: '2px solid var(--ek-red)', zIndex: 6, pointerEvents: 'none' }}>
                  <span style={{ position: 'absolute', top: -8, left: 3, fontFamily: 'var(--ek-font-mono)', fontSize: 9, fontWeight: 700, color: '#fff', background: 'var(--ek-red)', borderRadius: 3, padding: '0 4px' }}>{dropHint.label}</span>
                </div>
              )}

              {single && dayPlaced.length === 0 && (
                <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', color: 'var(--ek-text-muted)', fontSize: 15 }}>
                  {tx.nothingDay}
                </div>
              )}

              {/* Event blocks */}
              {dayPlaced.map(({ b, hour, minute }) => {
                const dur = b.duration_minutes ?? 60
                const topPx = (hour + minute / 60 - startHour) * ROW_HEIGHT
                const heightPx = Math.max((dur / 60) * ROW_HEIGHT, 22)
                const selected = selectedBooking?.id === b.id
                const txtColor = eventTextColor(b)
                const live = isLive(b)
                const canDrag = b.status === 'pending' || b.status === 'confirmed'
                return (
                  <button
                    key={b.id}
                    data-ek-event=""
                    data-ek-id={b.id}
                    draggable={canDrag}
                    onDragStart={canDrag ? (e) => onEventDragStart(e, b) : undefined}
                    onDragEnd={endDrag}
                    onClick={() => setSelectedBooking(b)}
                    style={{
                      position: 'absolute',
                      top: topPx + 1,
                      height: heightPx - 2,
                      left: 3,
                      right: 3,
                      textAlign: 'left',
                      borderRadius: 'var(--ek-radius-sm)',
                      overflow: 'hidden',
                      cursor: canDrag ? 'grab' : 'pointer',
                      opacity: draggingId === b.id ? 0.4 : 1,
                      padding: '3px 6px 3px 9px',
                      fontFamily: 'var(--ek-font-sans)',
                      ...eventStyle(b, selected),
                    }}
                  >
                    {/* Teacher-identity left edge (crimson when unassigned) */}
                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: edgeColor(b) }} />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: txtColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {live && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ek-red)', flexShrink: 0, animation: 'pulse-dot 1.4s ease-in-out infinite' }} />}
                      {b.student_name?.split(' ')[0] || tx.studentFallback}
                      {b.student_level && heightPx > 30 && (
                        <span style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 8.5, color: 'var(--ek-text-muted)', fontWeight: 600 }}>{b.student_level}</span>
                      )}
                    </span>
                    {heightPx > 30 && (
                      <span style={{ display: 'block', fontSize: 9.5, color: b.teacher_id ? 'var(--ek-text-soft)' : 'var(--ek-red)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: b.teacher_id ? 400 : 600 }}>
                        {b.teacher_id ? (b.teacher_name?.split(' ')[0] || tx.unknown) : tx.unassigned}
                      </span>
                    )}
                    {heightPx > 46 && (
                      <span style={{ display: 'block', fontSize: 9.5, color: 'var(--ek-text-muted)', fontFeatureSettings: '"tnum"' }}>{timeOf(b.scheduled_at)}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  // Calendar surface header: week range + day-column labels.
  function renderDayHeaders(cols: number[]) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${cols.length}, minmax(0, 1fr))`, borderBottom: '1px solid var(--ek-border-soft)', background: 'var(--ek-paper)' }}>
        <div />
        {cols.map((dayIdx) => {
          const zday = weekDays[dayIdx]
          const isToday = sameDay(zday, today)
          return (
            <button
              key={dayIdx}
              data-ek-dayhead=""
              onClick={() => { setSelectedDay(dayIdx); setView('day') }}
              style={{ padding: '9px 0', textAlign: 'center', cursor: 'pointer', border: 0, borderLeft: '1px solid var(--ek-border-soft)', background: 'transparent' }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--ek-font-mono)', color: isToday ? 'var(--ek-red)' : 'var(--ek-text-muted)' }}>
                {formatZDay(zday, DLOC, { weekday: 'short' })}
              </div>
              <div style={{ marginTop: 3 }}>
                <span style={{
                  display: 'inline-block', minWidth: 26, height: 26, lineHeight: '26px', borderRadius: '50%',
                  fontSize: 14, fontWeight: 800, fontFeatureSettings: '"tnum"',
                  background: isToday ? 'var(--ek-red)' : 'transparent',
                  color: isToday ? 'var(--ek-on-dark)' : 'var(--ek-text)',
                  padding: '0 6px',
                }}>
                  {zday.day}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  const filterBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 15px',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--ek-ink)' : 'var(--ek-border-mid)'}`,
    background: active ? 'var(--ek-ink)' : 'transparent',
    color: active ? '#fff' : 'var(--ek-text)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--ek-font-sans)',
  })

  const cols = view === 'week' ? [0, 1, 2, 3, 4, 5, 6] : [selectedDay]
  const weekRangeLabel = `${formatZDay(weekDays[0], DLOC, { month: 'long', day: 'numeric' })} – ${formatZDay(weekDays[6], DLOC, { month: 'long', day: 'numeric', year: 'numeric' })}`

  // ── Drawer (booking detail) ──────────────────────────────────────────────────
  const b = selectedBooking
  const drawerFooter = b && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {b.status !== 'completed' && b.status !== 'cancelled' && (
        <div>
          <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 6 }}>{tx.assignTeacher}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={detailAssignTeacher}
              onChange={e => setDetailAssignTeacher(e.target.value)}
              disabled={isPending}
              className="ek-input"
              style={{ flex: 1, borderRadius: 'var(--ek-radius-sm)', padding: '8px 10px', fontSize: 13, color: 'var(--ek-text)', background: 'var(--ek-card)', fontFamily: 'var(--ek-font-sans)' }}
            >
              <option value="">{tx.selectTeacher}</option>
              {teachers.map(t => {
                const ok = isTeacherAvailableClient(t.id, availSlots, b.scheduled_at, b.duration_minutes || 60)
                const isCurrent = b.teacher_id === t.id
                const paused = !t.accepting && !isCurrent
                const label = paused ? tx.pausedOption(t.name) : ok ? tx.okOption(t.name) : tx.offHoursOption(t.name)
                return <option key={t.id} value={t.id} disabled={paused}>{label}</option>
              })}
            </select>
            <button
              onClick={handleAssignFromDrawer}
              disabled={isPending || !detailAssignTeacher}
              className={detailAssignTeacher ? 'ek-btn ek-btn-primary ek-btn-square' : 'ek-btn ek-btn-square'}
              style={{ padding: '8px 14px', fontSize: 13, background: detailAssignTeacher ? undefined : 'var(--ek-border)', color: detailAssignTeacher ? undefined : 'var(--ek-text-muted)' }}
            >
              {isPending ? '…' : tx.assign}
            </button>
          </div>
        </div>
      )}
      {b.status === 'confirmed' && (
        <button onClick={handleComplete} disabled={isPending} className="ek-btn ek-btn-primary ek-btn-square" style={{ justifyContent: 'center', padding: '11px 0', opacity: isPending ? 0.6 : 1 }}>
          {tx.markComplete}
        </button>
      )}
      {b.status === 'confirmed' && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <JoinSessionButton lang={lang as Locale} bookingId={b.id} scheduledAt={b.scheduled_at} variant="secondary" />
        </div>
      )}
      {(b.status === 'pending' || b.status === 'confirmed') && (
        rescheduleOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)' }}>{tx.reschedule}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} className="ek-input" style={{ flex: 1, borderRadius: 'var(--ek-radius-sm)', padding: '8px 10px', fontSize: 13, color: 'var(--ek-text)', background: 'var(--ek-card)', fontFamily: 'var(--ek-font-sans)' }} />
              <input type="time" value={rTime} step={900} onChange={(e) => setRTime(e.target.value)} className="ek-input" style={{ width: 116, borderRadius: 'var(--ek-radius-sm)', padding: '8px 10px', fontSize: 13, color: 'var(--ek-text)', background: 'var(--ek-card)', fontFamily: 'var(--ek-font-sans)' }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setRescheduleOpen(false)} className="ek-btn ek-btn-ghost ek-btn-square" style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }}>{tx.cancel}</button>
              <button onClick={saveReschedule} disabled={isPending || !rDate || !rTime} className="ek-btn ek-btn-primary ek-btn-square" style={{ flex: 1, justifyContent: 'center', padding: '10px 0', opacity: isPending || !rDate || !rTime ? 0.6 : 1 }}>{tx.save}</button>
            </div>
          </div>
        ) : (
          <button onClick={openReschedule} className="ek-btn ek-btn-ghost ek-btn-square" style={{ justifyContent: 'center', padding: '11px 0' }}>{tx.reschedule}</button>
        )
      )}
      {(b.status === 'pending' || b.status === 'confirmed') && (
        confirmCancel ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleCancel} disabled={isPending} className="ek-btn ek-btn-red ek-btn-square" style={{ flex: 1, justifyContent: 'center', padding: '11px 0' }}>{tx.confirmCancelBtn}</button>
            <button onClick={() => setConfirmCancel(false)} className="ek-btn ek-btn-ghost ek-btn-square" style={{ flex: 1, justifyContent: 'center', padding: '11px 0' }}>{tx.no}</button>
          </div>
        ) : (
          <button onClick={() => setConfirmCancel(true)} className="ek-btn ek-btn-square" style={{ justifyContent: 'center', padding: '11px 0', background: 'var(--ek-red-tint)', color: 'var(--ek-red)', border: '1px solid var(--ek-red-tint-3)' }}>{tx.cancelBooking}</button>
        )
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'success' ? 'var(--ek-ink)' : 'var(--ek-red)',
          color: '#fff', padding: '12px 18px', borderRadius: 'var(--ek-radius-md)',
          fontSize: 13, fontWeight: 600, maxWidth: 340, fontFamily: 'var(--ek-font-sans)',
          boxShadow: '0 12px 32px -12px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ek-text-muted)', marginBottom: 6 }}>
            {tx.kicker}
          </div>
          <h1 style={{ fontFamily: 'var(--ek-font-sans)', fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--ek-text)', margin: 0, lineHeight: 1.1 }}>
            {tx.bookings}{' '}
            <span style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--ek-text-muted)' }}>{tx.thisWeek}</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', margin: '6px 0 0' }}>{tx.calendarSub(zoneLabel)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('week')} style={filterBtn(view === 'week')}>{tx.viewWeek}</button>
          <button onClick={() => setView('day')} style={filterBtn(view === 'day')}>{tx.viewDay}</button>
        </div>
      </div>

      {/* Stat ledger */}
      <div style={{ marginBottom: 24 }}>
        <StatLedger items={[
          { kicker: tx.statToday, value: stats.todayCount },
          { kicker: tx.statPending, value: stats.pendingCount, accent: stats.pendingCount > 0 },
          { kicker: tx.statConfirmed, value: stats.weekConfirmed },
          { kicker: tx.statLive, value: liveCount, accent: liveCount > 0 },
        ]} />
      </div>

      {/* Pending assignments — admin's first job, surfaced at top */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ek-red)', marginBottom: 8 }}>
          {tx.pendingKicker}
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ek-text)', margin: '0 0 14px' }}>
          {tx.pendingAssignments(pendingBookings.length)}
        </h2>
        <div style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[tx.thStudent, tx.thScheduled, tx.thType, tx.thDuration, tx.thAssign].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', borderBottom: '1px solid var(--ek-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ek-text-muted)', fontSize: 14, fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic' }}>{tx.noPending}</td>
                </tr>
              ) : pendingBookings.map(pb => (
                <tr key={pb.id} style={{ borderBottom: '1px solid var(--ek-border-soft)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ek-text)' }}>{pb.student_name || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ek-text-soft)', fontFeatureSettings: '"tnum"' }}>
                    {new Date(pb.scheduled_at).toLocaleString(DLOC, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timezone })}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ek-text-muted)' }}>{typeLabel(pb.type)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ek-text-soft)' }}>{pb.duration_minutes ? tx.minShort(pb.duration_minutes) : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <BookingAssign bookingId={pb.id} currentTeacherId={null} teachers={teachers} scheduledAt={pb.scheduled_at} durationMinutes={pb.duration_minutes} availSlots={availSlots} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* Responsive: stack filter under the calendar on narrow screens; let the
          week grid scroll horizontally instead of crushing 7 columns. */}
      <style>{`
        @media (max-width: 860px) {
          .ad03-main { flex-direction: column-reverse; }
          .ad03-filter { width: 100% !important; }
        }
        @media (max-width: 1100px) { .ad03-draghint { display: none; } }
      `}</style>

      {/* Calendar + filter */}
      <div className="ad03-main" style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {/* Teacher filter / legend */}
        <div className="ad03-filter" style={{ width: 184, flexShrink: 0 }}>
          <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 10 }}>{tx.teachers}</div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9, cursor: 'pointer', fontSize: 12.5, color: 'var(--ek-text)' }}>
            <input type="checkbox" checked={selectedTeachers.size === teachers.length}
              onChange={() => setSelectedTeachers(selectedTeachers.size === teachers.length ? new Set() : new Set(teachers.map(t => t.id)))} />
            {tx.allTeachers}
          </label>
          {teachers.map(t => (
            <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--ek-text-soft)' }}>
              <input type="checkbox" checked={selectedTeachers.has(t.id)}
                onChange={() => { const next = new Set(selectedTeachers); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); setSelectedTeachers(next) }} />
              <span style={{ width: 9, height: 9, borderRadius: 2, background: teacherTint.get(t.id), flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name.split(' ')[0]}</span>
            </label>
          ))}

          <div style={{ marginTop: 20, borderTop: '1px solid var(--ek-border)', paddingTop: 16 }}>
            <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 10 }}>{tx.legend}</div>
            {[
              { label: tx.legConfirmed, border: '1px solid var(--ek-border-mid)', bg: 'var(--ek-card)' },
              { label: tx.legPending, border: '1px dashed var(--ek-border-mid)', bg: 'var(--ek-card)' },
              { label: tx.legCompleted, border: '1px solid var(--ek-border)', bg: 'var(--ek-paper)' },
              { label: tx.legLive, border: '1px solid var(--ek-red)', bg: 'var(--ek-red-tint)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ width: 14, height: 11, borderRadius: 2, border: item.border, background: item.bg, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--ek-text-soft)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar surface */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)', overflow: 'hidden' }}>
            {/* Nav row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--ek-border)', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => navigate('prev')} aria-label={tx.prev} className="ek-btn ek-btn-ghost ek-btn-square" style={{ padding: '6px 11px', fontSize: 13 }}>‹</button>
                <button onClick={goToday} className="ek-btn ek-btn-ghost ek-btn-square" style={{ padding: '6px 14px', fontSize: 12 }}>{tx.today}</button>
                <button onClick={() => navigate('next')} aria-label={tx.next} className="ek-btn ek-btn-ghost ek-btn-square" style={{ padding: '6px 11px', fontSize: 13 }}>›</button>
                <span className="ad03-draghint" style={{ marginLeft: 6, fontFamily: 'var(--ek-font-mono)', fontSize: 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ek-text-faint)' }}>{tx.dragHint}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ek-text)', letterSpacing: '-0.01em' }}>{weekRangeLabel}</span>
              <button onClick={() => setShowAllHours(v => !v)} style={{ fontSize: 11, fontWeight: 700, color: 'var(--ek-red)', background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'var(--ek-font-sans)', letterSpacing: '0.03em' }}>
                {showAllHours ? tx.showBusinessHours : tx.showAllHours}
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: cols.length > 1 ? 600 : undefined }}>
                {renderDayHeaders(cols)}
                {renderGrid(cols)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking detail drawer */}
      <Drawer
        open={!!b}
        onClose={closeDrawer}
        kicker={b ? `${tx.bookingDetail} · ${typeLabel(b.type)}` : undefined}
        title={b ? (b.student_name || tx.studentFallback) : undefined}
        footer={drawerFooter}
        width={420}
      >
        {b && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
            <div>
              <StatusBadge variant={isLive(b) ? 'live' : (b.status as 'pending' | 'confirmed' | 'completed' | 'cancelled')} dot={isLive(b)}>
                {isLive(b) ? tx.live : statusLabel(b.status)}
              </StatusBadge>
            </div>

            <DetailRow label={tx.student}>
              <a href={`/${lang}/admin/students/${b.student_id}`} style={{ fontWeight: 700, color: 'var(--ek-text)', textDecoration: 'none' }}>{b.student_name || '—'}</a>
              {b.student_email && <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 2 }}>{b.student_email}</div>}
              {b.student_level && <span style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10, color: 'var(--ek-text-soft)', border: '1px solid var(--ek-border-mid)', borderRadius: 3, padding: '1px 6px', marginTop: 5, display: 'inline-block' }}>{b.student_level}</span>}
            </DetailRow>

            <DetailRow label={tx.teacher}>
              {b.teacher_id ? (
                <a href={`/${lang}/admin/teachers/${b.teacher_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, color: 'var(--ek-text)', textDecoration: 'none' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: teacherTint.get(b.teacher_id), flexShrink: 0 }} />
                  {b.teacher_name || tx.unknown}
                </a>
              ) : <span style={{ color: 'var(--ek-red)', fontWeight: 600 }}>{tx.unassigned}</span>}
            </DetailRow>

            {b.type === 'placement_test' && (
              <DetailRow label={tx.conductor}>
                {b.conductor_name ? <span style={{ fontWeight: 600, color: 'var(--ek-text)' }}>{b.conductor_name}</span> : <span style={{ color: 'var(--ek-red)', fontWeight: 600 }}>{tx.unassigned}</span>}
              </DetailRow>
            )}

            <DetailRow label={tx.scheduled}>
              <span style={{ fontWeight: 600, color: 'var(--ek-text)', textTransform: 'capitalize' }}>
                {new Date(b.scheduled_at).toLocaleString(DLOC, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timezone })}
              </span>
              <div style={{ fontSize: 11, color: 'var(--ek-text-muted)', marginTop: 2 }}>{tx.yourZone(zoneLabel)}</div>
            </DetailRow>

            <div style={{ display: 'flex', gap: 28 }}>
              <DetailRow label={tx.duration}><span style={{ color: 'var(--ek-text-soft)' }}>{b.duration_minutes ? tx.minShort(b.duration_minutes) : '—'}</span></DetailRow>
              <DetailRow label={tx.type}><span style={{ color: 'var(--ek-text-soft)' }}>{typeLabel(b.type)}</span></DetailRow>
            </div>

            {b.meeting_notes && (
              <DetailRow label={tx.meetingNotes}><span style={{ color: 'var(--ek-text-soft)', lineHeight: 1.55 }}>{b.meeting_notes}</span></DetailRow>
            )}

            {b.ai_summary && (
              <div>
                <button onClick={() => setShowAiSummary(v => !v)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'var(--ek-font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ek-text-muted)' }}>
                  {showAiSummary ? '–' : '+'} {tx.aiSummary}
                </button>
                {showAiSummary && (
                  <p style={{ marginTop: 8, padding: '10px 12px', background: 'var(--ek-paper)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-sm)', fontSize: 12.5, color: 'var(--ek-text-soft)', lineHeight: 1.55 }}>{b.ai_summary}</p>
                )}
              </div>
            )}

            {b.student_rating !== null && (
              <DetailRow label={tx.studentRating}>
                <span style={{ fontFeatureSettings: '"tnum"', fontWeight: 700, color: 'var(--ek-text)' }}>{b.student_rating}<span style={{ color: 'var(--ek-text-muted)', fontWeight: 400 }}> / 5</span></span>
              </DetailRow>
            )}
          </div>
        )}
      </Drawer>

      {/* Conflict / override Modal — replaces the old native confirm for both
          assign and drag-to-reschedule guard failures. */}
      <Modal
        open={!!conflict}
        onClose={() => setConflict(null)}
        kicker={conflict?.kicker}
        title={tx.conflictTitle}
        maxWidth={420}
        footer={
          conflict?.force ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConflict(null)} className="ek-btn ek-btn-ghost ek-btn-square" style={{ flex: 1, justifyContent: 'center', padding: '11px 0' }}>{tx.cancel}</button>
              <button onClick={() => conflict.force?.()} disabled={isPending} className="ek-btn ek-btn-red ek-btn-square" style={{ flex: 1, justifyContent: 'center', padding: '11px 0', opacity: isPending ? 0.6 : 1 }}>{tx.continueAnyway}</button>
            </div>
          ) : (
            <button onClick={() => setConflict(null)} className="ek-btn ek-btn-primary ek-btn-square" style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}>{tx.ok}</button>
          )
        }
      >
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ek-text-soft)' }}>{conflict?.message}</p>
      </Modal>
    </div>
  )
}

// Small labeled detail row for the drawer (mono kicker + value).
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 4 }}>{label}</div>
      <div>{children}</div>
    </div>
  )
}
