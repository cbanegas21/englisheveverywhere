'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { assignAndConfirmBooking, cancelBookingWithRefund, completeBooking, adminRescheduleBooking, createAdminBooking } from '../actions'
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
interface AvailSlot { teacher_id: string; day_of_week: number; start_time: string; end_time: string; is_active?: boolean }
interface PendingEntry {
  id: string
  student_id: string
  scheduled_at: string
  duration_minutes: number | null
  type: string
  student_name: string | null
}
interface StudentEntry { id: string; name: string; email: string | null; level: string | null; classesRemaining: number }

interface MonthBooking {
  id: string
  scheduled_at: string
  status: string
  type: string
  teacher_id: string | null
  student_name: string | null
}

interface Props {
  lang: string
  timezone: string
  weekStart: string // Monday of the visible week, as a zoned 'YYYY-MM-DD'
  initialView: 'week' | 'day' | 'month'
  initialDay: string | null // a zoned 'YYYY-MM-DD' to open in Day view (drill from Month)
  monthGridStart: string // Monday on/before the 1st of the displayed month
  monthYear: number
  monthIndex: number // 0-indexed month of the displayed month
  monthBookings: MonthBooking[]
  bookings: BookingEntry[]
  teachers: TeacherEntry[]
  availSlots: AvailSlot[]
  pendingBookings: PendingEntry[]
  allStudents: StudentEntry[]
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

// Duration presets offered by the click-to-create modal (server allows 15–240).
const CREATE_DURATIONS = [30, 45, 60, 90]
const BOOKING_TYPES = ['class', 'placement_test', 'teacher_interview', 'admin_checkin'] as const

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
    dragHint: 'Drag to reschedule · click a slot to add',
    // unassigned inbox rail
    inboxHint: 'Drag onto the calendar to place · click to assign',
    inboxEmpty: 'No bookings waiting on a teacher.',
    availabilityOf: (n: string) => `Showing ${n}'s available hours`,
    // create-booking modal (click an empty slot)
    createKicker: '↳ New booking',
    createTitle: 'Schedule a booking',
    createStudent: 'Student',
    createSelectStudent: 'Select student…',
    createTeacher: 'Teacher (optional)',
    createUnassigned: '— Unassigned —',
    createWhen: 'When',
    createNotes: 'Notes (optional)',
    createNotesPlaceholder: 'Optional note for this booking…',
    createSubmit: 'Create booking',
    creating: 'Creating…',
    created: 'Booking created',
    noCredits: (n: string) => `${n} has no class credits — pick another student or type.`,
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
    viewMonth: 'Month',
    more: (n: number) => `+${n} more`,
    // stats
    statToday: 'Bookings Today',
    statPending: 'Pending Assignment',
    statConfirmed: 'Confirmed This Week',
    statLive: 'Live Now',
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
    dragHint: 'Arrastra para reprogramar · clic en un hueco para agregar',
    inboxHint: 'Arrastra al calendario para ubicar · clic para asignar',
    inboxEmpty: 'No hay reservas esperando maestro.',
    availabilityOf: (n: string) => `Mostrando las horas disponibles de ${n}`,
    createKicker: '↳ Nueva reserva',
    createTitle: 'Agendar una reserva',
    createStudent: 'Estudiante',
    createSelectStudent: 'Seleccionar estudiante…',
    createTeacher: 'Maestro (opcional)',
    createUnassigned: '— Sin asignar —',
    createWhen: 'Cuándo',
    createNotes: 'Notas (opcional)',
    createNotesPlaceholder: 'Nota opcional para esta reserva…',
    createSubmit: 'Crear reserva',
    creating: 'Creando…',
    created: 'Reserva creada',
    noCredits: (n: string) => `${n} no tiene créditos de clase — elige otro estudiante o tipo.`,
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
    viewMonth: 'Mes',
    more: (n: number) => `+${n} más`,
    statToday: 'Reservas de hoy',
    statPending: 'Pendientes de asignar',
    statConfirmed: 'Confirmadas esta semana',
    statLive: 'En vivo ahora',
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
function mondayOf(d: ZDay): ZDay {
  const wd = weekdayOf(d)
  return addDays(d, wd === 0 ? -6 : 1 - wd)
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
  initialView,
  initialDay,
  monthGridStart,
  monthYear,
  monthIndex,
  monthBookings,
  bookings,
  teachers,
  availSlots,
  pendingBookings,
  allStudents,
  stats,
}: Props) {
  const router = useRouter()
  const [view, setView] = useState<'week' | 'day' | 'month'>(initialView)
  const [selectedBooking, setSelectedBooking] = useState<BookingEntry | null>(null)
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set(teachers.map(t => t.id)))
  const [selectedDay, setSelectedDay] = useState(() => {
    // Drill from Month: open the requested day's column within the loaded week.
    if (!initialDay) return 0
    const mon = parseZDay(weekStart)
    const d = parseZDay(initialDay)
    const idx = Math.round((Date.UTC(d.year, d.month, d.day) - Date.UTC(mon.year, mon.month, mon.day)) / 86400000)
    return idx >= 0 && idx <= 6 ? idx : 0
  })
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
  // Click-empty-cell → create (P5)
  const [createOpen, setCreateOpen] = useState(false)
  const [cStudent, setCStudent] = useState('')
  const [cTeacher, setCTeacher] = useState('')
  const [cDate, setCDate] = useState('')
  const [cTime, setCTime] = useState('')
  const [cType, setCType] = useState('class')
  const [cDuration, setCDuration] = useState(60)
  const [cNotes, setCNotes] = useState('')
  const [cError, setCError] = useState('')
  const [cForceable, setCForceable] = useState(false)
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
    router.push(`/${lang}/admin/bookings?weekStart=${target.year}-${pad2(target.month + 1)}-${pad2(target.day)}`)
  }
  const goToday = () => router.push(`/${lang}/admin/bookings${view === 'month' ? '?view=month' : ''}`)
  const navigateMonth = (dir: 'prev' | 'next') => {
    const m = monthIndex + (dir === 'next' ? 1 : -1)
    const y = monthYear + Math.floor(m / 12)
    const mi = ((m % 12) + 12) % 12
    router.push(`/${lang}/admin/bookings?weekStart=${y}-${pad2(mi + 1)}-01&view=month`)
  }
  const openDayFromMonth = (d: ZDay) => {
    const mon = mondayOf(d)
    router.push(`/${lang}/admin/bookings?weekStart=${mon.year}-${pad2(mon.month + 1)}-${pad2(mon.day)}&day=${d.year}-${pad2(d.month + 1)}-${pad2(d.day)}`)
  }

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

  // Month grid: 42 zoned days from the Monday on/before the 1st, each day's
  // lightweight bookings bucketed by the admin's zoned day.
  const monthDays = useMemo(() => {
    const start = parseZDay(monthGridStart)
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [monthGridStart])
  const monthByDay = useMemo(() => {
    const m = new Map<string, MonthBooking[]>()
    for (const mb of monthBookings) {
      const p = getZonedParts(new Date(mb.scheduled_at), timezone)
      const key = `${p.year}-${p.month}-${p.day}`
      const arr = m.get(key)
      if (arr) arr.push(mb); else m.set(key, [mb])
    }
    return m
  }, [monthBookings, timezone])

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

  // ── Availability overlay (shade ONE teacher's stated hours behind the grid) ────
  // Only when exactly one teacher is selected in the filter — overlapping shades
  // for several teachers would be noise. availability_slots store Honduras
  // wall-clock + day_of_week 0=Sun; we materialize each slot occurrence to an
  // absolute UTC interval, then intersect it with each admin-zoned day column so
  // the band lands in the viewer's timezone (DST-safe), not Honduras's.
  const soloTeacher = useMemo<TeacherEntry | null>(
    () => (selectedTeachers.size === 1 ? teachers.find(t => selectedTeachers.has(t.id)) ?? null : null),
    [selectedTeachers, teachers],
  )
  type Band = { dayIdx: number; topPx: number; heightPx: number }
  const availBands = useMemo<Band[]>(() => {
    if (!soloTeacher) return []
    const slots = availSlots.filter(s => s.teacher_id === soloTeacher.id && s.is_active !== false)
    if (!slots.length) return []
    const HN = 'America/Tegucigalpa'
    // Absolute bounds of the visible week in the admin's zone (± a day of slack
    // so a slot whose HN day differs from the admin day still gets considered).
    const sun = addDays(weekDays[6], 1)
    const winStart = zonedWallTimeToUtc(weekDays[0].year, weekDays[0].month, weekDays[0].day, 0, 0, timezone).getTime()
    const winEnd = zonedWallTimeToUtc(sun.year, sun.month, sun.day, 0, 0, timezone).getTime()
    // Enumerate the HN calendar dates spanning that window.
    const hnDates: ZDay[] = []
    const sp = getZonedParts(new Date(winStart - 86_400_000), HN)
    const ep = getZonedParts(new Date(winEnd + 86_400_000), HN)
    let cur: ZDay = { year: sp.year, month: sp.month, day: sp.day }
    const endZ: ZDay = { year: ep.year, month: ep.month, day: ep.day }
    for (let i = 0; i < 14; i++) {
      hnDates.push(cur)
      if (sameDay(cur, endZ)) break
      cur = addDays(cur, 1)
    }
    // Materialize each (HN date × matching slot) to an absolute UTC interval.
    const intervals: { start: number; end: number }[] = []
    for (const hd of hnDates) {
      const dow = weekdayOf(hd) // 0=Sun — matches availability_slots.day_of_week
      for (const s of slots) {
        if (s.day_of_week !== dow) continue
        const [sh, sm] = s.start_time.split(':').map(Number)
        const [eh, em] = s.end_time.split(':').map(Number)
        const st = zonedWallTimeToUtc(hd.year, hd.month, hd.day, sh, sm || 0, HN).getTime()
        const en = zonedWallTimeToUtc(hd.year, hd.month, hd.day, eh, em || 0, HN).getTime()
        if (en > st) intervals.push({ start: st, end: en })
      }
    }
    // Intersect each interval with each admin-day column, clip to the visible hours.
    const bands: Band[] = []
    weekDays.forEach((zday, dayIdx) => {
      const next = addDays(zday, 1)
      const colStart = zonedWallTimeToUtc(zday.year, zday.month, zday.day, 0, 0, timezone).getTime()
      const colEnd = zonedWallTimeToUtc(next.year, next.month, next.day, 0, 0, timezone).getTime()
      for (const iv of intervals) {
        const s = Math.max(colStart, iv.start)
        const e = Math.min(colEnd, iv.end)
        if (s >= e) continue
        const ps = getZonedParts(new Date(s), timezone)
        let topHr = ps.hour + ps.minute / 60
        let botHr: number
        if (e >= colEnd) botHr = 24
        else {
          const pe = getZonedParts(new Date(e), timezone)
          botHr = pe.hour + pe.minute / 60
          if (botHr === 0) botHr = 24 // exact midnight reads as next-day 00:00
        }
        topHr = Math.max(topHr, startHour)
        botHr = Math.min(botHr, endHour)
        if (botHr <= topHr) continue
        bands.push({ dayIdx, topPx: (topHr - startHour) * ROW_HEIGHT, heightPx: (botHr - topHr) * ROW_HEIGHT })
      }
    })
    return bands
  }, [soloTeacher, availSlots, weekDays, timezone, startHour, endHour])
  // Fallback matches --ek-border-mid (warm muted) — a hex literal so the '22'
  // alpha suffix stays valid CSS (you can't append alpha to a var()).
  const availTint = soloTeacher ? `${teacherTint.get(soloTeacher.id) ?? '#D4CDB8'}22` : 'transparent'

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

  // ── Unassigned inbox rail ─────────────────────────────────────────────────────
  // Cards reuse the grid's drag machinery: a drag-start arms draggingIdRef, then
  // the day columns' existing dragover/drop reschedule the booking into the slot.
  // grabPx=0 so the drop lands at the cursor (the card has no on-grid origin).
  function onInboxDragStart(e: React.DragEvent, pb: PendingEntry) {
    dragGrabPx.current = 0
    draggingIdRef.current = pb.id
    setDraggingId(pb.id)
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', pb.id) } catch { /* some engines require setData to start a drag */ }
  }
  // Open the detail Drawer (where assignment lives) for an inbox card. Prefer the
  // richer in-week entry if it's already loaded; otherwise synthesize a minimal
  // pending entry — the missing fields are all assignment-irrelevant for a
  // teacherless booking and their Drawer rows hide when null.
  function openInbox(pb: PendingEntry) {
    const full = bookings.find(x => x.id === pb.id)
    setSelectedBooking(full ?? {
      id: pb.id, student_id: pb.student_id, teacher_id: null, conductor_profile_id: null,
      scheduled_at: pb.scheduled_at, duration_minutes: pb.duration_minutes, status: 'pending',
      type: pb.type, meeting_notes: null, video_room_url: null,
      student_name: pb.student_name, student_email: null, student_level: null,
      teacher_name: null, conductor_name: null, ai_summary: null, student_rating: null,
    })
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

  // ── Click-empty-cell → create booking (P5) ───────────────────────────────────
  function resetCreateError() { setCError(''); setCForceable(false) }
  // Open the create modal prefilled with the clicked slot (admin-zone wall-clock).
  function openCreate(zday: ZDay, hour: number, minute: number) {
    setCDate(`${zday.year}-${pad2(zday.month + 1)}-${pad2(zday.day)}`)
    setCTime(`${pad2(hour)}:${pad2(minute)}`)
    setCStudent(''); setCTeacher(''); setCType('class'); setCDuration(60); setCNotes('')
    resetCreateError()
    setCreateOpen(true)
  }
  function closeCreate() { setCreateOpen(false); resetCreateError() }
  // Snap a click in a day column to a 15-min slot within the visible hour range.
  function slotFromClick(e: React.MouseEvent): { hour: number; minute: number } {
    const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - colRect.top
    let totalMin = Math.round((startHour * 60 + (y / ROW_HEIGHT) * 60) / 15) * 15
    totalMin = Math.max(startHour * 60, Math.min(totalMin, endHour * 60 - 15))
    return { hour: Math.floor(totalMin / 60), minute: totalMin % 60 }
  }
  // The prospective UTC instant for the create form (admin-zone wall-clock → UTC,
  // DST-safe). Empty until both date + time are set.
  const createIso = useMemo(() => {
    if (!cDate || !cTime) return ''
    const [y, m, d] = cDate.split('-').map(Number)
    const [h, mi] = cTime.split(':').map(Number)
    return zonedWallTimeToUtc(y, (m || 1) - 1, d || 1, h || 0, mi || 0, timezone).toISOString()
  }, [cDate, cTime, timezone])
  const createStudentObj = useMemo(() => allStudents.find(s => s.id === cStudent) ?? null, [allStudents, cStudent])
  const creditWarn = cType === 'class' && !!createStudentObj && createStudentObj.classesRemaining <= 0
  function submitCreate(force = false) {
    if (!cStudent || !createIso) return
    startTransition(async () => {
      try {
        await createAdminBooking(cStudent, cTeacher || null, createIso, cType, cDuration, cNotes, { force })
        showToast(tx.created)
        closeCreate()
        router.refresh()
      } catch (e) {
        const msg = e instanceof Error ? e.message : tx.error
        // Same forceable set as assign/reschedule — availability + primary-teacher
        // continuity instruct "retry with force=true". Hard guards (paused teacher,
        // slot taken, no credits, out-of-bounds) never carry it → no override offered.
        const forceable = msg.toLowerCase().includes('force=true')
        setCForceable(forceable && !force)
        setCError(msg)
      }
    })
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
              onClick={(e) => {
                // Empty-slot click → create. Events stopPropagation (open the
                // Drawer instead); a just-finished drag is guarded out.
                if (draggingIdRef.current) return
                const { hour, minute } = slotFromClick(e)
                openCreate(weekDays[dayIdx], hour, minute)
              }}
              style={{
                position: 'relative',
                height: calHeight,
                borderLeft: '1px solid var(--ek-border-soft)',
                background: isToday ? 'var(--ek-red-tint)' : 'transparent',
              }}
            >
              {/* Availability shade (one selected teacher) — painted first so it
                  sits behind the gridlines + event blocks */}
              {availBands.filter(bd => bd.dayIdx === dayIdx).map((bd, i) => (
                <div key={`av${i}`} style={{ position: 'absolute', left: 0, right: 0, top: bd.topPx, height: bd.heightPx, background: availTint, pointerEvents: 'none' }} />
              ))}

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
                    onClick={(e) => { e.stopPropagation(); setSelectedBooking(b) }}
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

  // Shared field styling for the create modal (mirrors the Drawer's selects).
  const inputStyle: React.CSSProperties = {
    boxSizing: 'border-box', borderRadius: 'var(--ek-radius-sm)', padding: '8px 10px',
    fontSize: 13, color: 'var(--ek-text)', background: 'var(--ek-card)', fontFamily: 'var(--ek-font-sans)',
  }

  const cols = view === 'week' ? [0, 1, 2, 3, 4, 5, 6] : [selectedDay]
  const weekRangeLabel = `${formatZDay(weekDays[0], DLOC, { month: 'long', day: 'numeric' })} – ${formatZDay(weekDays[6], DLOC, { month: 'long', day: 'numeric', year: 'numeric' })}`
  const monthLabelRaw = new Date(Date.UTC(monthYear, monthIndex, 1, 12)).toLocaleDateString(DLOC, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const monthLabel = monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1)

  // ── Month grid render ─────────────────────────────────────────────────────────
  function renderMonth() {
    return (
      <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 640 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ek-border-soft)', background: 'var(--ek-paper)' }}>
          {monthDays.slice(0, 7).map((d, i) => (
            <div key={i} style={{ padding: '8px 0', textAlign: 'center', fontFamily: 'var(--ek-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ek-text-muted)', borderLeft: i ? '1px solid var(--ek-border-soft)' : 'none' }}>
              {formatZDay(d, DLOC, { weekday: 'short' })}
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, w) => (
          <div key={w} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: w < 5 ? '1px solid var(--ek-border-soft)' : 'none' }}>
            {monthDays.slice(w * 7, w * 7 + 7).map((d, i) => {
              const inMonth = d.month === monthIndex
              const isToday = sameDay(d, today)
              const items = (monthByDay.get(`${d.year}-${d.month}-${d.day}`) || []).filter(mb => mb.teacher_id === null || selectedTeachers.has(mb.teacher_id))
              const unassigned = items.filter(mb => !mb.teacher_id).length
              return (
                <button
                  key={i}
                  data-ek-monthcell={`${d.year}-${d.month}-${d.day}`}
                  aria-label={`${formatZDay(d, DLOC, { weekday: 'long', month: 'long', day: 'numeric' })}, ${tx.bookingsCount(items.length)}${unassigned ? `, ${unassigned} ${tx.unassigned}` : ''}`}
                  onClick={() => openDayFromMonth(d)}
                  style={{
                    textAlign: 'left', border: 0, borderLeft: i ? '1px solid var(--ek-border-soft)' : 'none',
                    background: isToday ? 'var(--ek-red-tint)' : (inMonth ? 'transparent' : 'var(--ek-paper)'),
                    minHeight: 104, padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3,
                    fontFamily: 'var(--ek-font-sans)', overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 12, fontWeight: isToday ? 800 : 600, fontFeatureSettings: '"tnum"',
                      color: isToday ? 'var(--ek-on-dark)' : (inMonth ? 'var(--ek-text)' : 'var(--ek-text-faint)'),
                      background: isToday ? 'var(--ek-red)' : 'transparent', borderRadius: 999,
                      minWidth: 20, height: 20, lineHeight: '20px', textAlign: 'center', padding: '0 5px',
                    }}>{d.day}</span>
                    {unassigned > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ek-red)' }} />}
                  </div>
                  {items.slice(0, 3).map(mb => {
                    const tint = mb.teacher_id ? (teacherTint.get(mb.teacher_id) ?? 'var(--ek-border-mid)') : 'var(--ek-red)'
                    return (
                      <div key={mb.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: mb.status === 'completed' ? 'var(--ek-text-muted)' : 'var(--ek-text-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ width: 4, height: 12, borderRadius: 1, background: tint, flexShrink: 0 }} />
                        <span style={{ fontFeatureSettings: '"tnum"', color: 'var(--ek-text-muted)', flexShrink: 0 }}>{timeOf(mb.scheduled_at)}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{mb.student_name?.split(' ')[0] || tx.studentFallback}</span>
                      </div>
                    )
                  })}
                  {items.length > 3 && <span style={{ fontSize: 9.5, color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)' }}>{tx.more(items.length - 3)}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      </div>
    )
  }

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
          {/* Week/Day toggles stay instant within a loaded week, but LEAVING month
              view re-grounds to today's week (the month has no "selected week", so a
              plain setView would otherwise show the week of the 1st). */}
          <button onClick={() => (view === 'month' ? router.push(`/${lang}/admin/bookings`) : setView('week'))} style={filterBtn(view === 'week')}>{tx.viewWeek}</button>
          <button onClick={() => { if (view === 'month') { const t = todayInZone(timezone); router.push(`/${lang}/admin/bookings?day=${t.year}-${pad2(t.month + 1)}-${pad2(t.day)}`) } else setView('day') }} style={filterBtn(view === 'day')}>{tx.viewDay}</button>
          <button onClick={() => setView('month')} style={filterBtn(view === 'month')}>{tx.viewMonth}</button>
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

      {/* Responsive: on narrow screens stack the three columns (calendar first,
          then the unassigned rail, then the teacher filter) and let the week grid
          scroll horizontally instead of crushing 7 columns. */}
      <style>{`
        @media (max-width: 980px) {
          .ad03-main { flex-direction: column; }
          .ad03-filter, .ad03-inbox { width: 100% !important; }
          .ad03-calendar { order: 1; }
          .ad03-inbox { order: 2; }
          .ad03-filter { order: 3; }
          .ad03-inbox-list { max-height: 320px !important; }
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

          {soloTeacher && view !== 'month' && (
            <div style={{ marginTop: 11, display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 10.5, lineHeight: 1.4, color: 'var(--ek-text-muted)' }}>
              <span style={{ width: 11, height: 11, borderRadius: 2, background: availTint, border: `1px solid ${teacherTint.get(soloTeacher.id) ?? 'var(--ek-border-mid)'}`, flexShrink: 0, marginTop: 1 }} />
              <span>{tx.availabilityOf(soloTeacher.name.split(' ')[0])}</span>
            </div>
          )}

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
        <div className="ad03-calendar" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)', overflow: 'hidden' }}>
            {/* Nav row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--ek-border)', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => (view === 'month' ? navigateMonth('prev') : navigate('prev'))} aria-label={tx.prev} className="ek-btn ek-btn-ghost ek-btn-square" style={{ padding: '6px 11px', fontSize: 13 }}>‹</button>
                <button onClick={goToday} className="ek-btn ek-btn-ghost ek-btn-square" style={{ padding: '6px 14px', fontSize: 12 }}>{tx.today}</button>
                <button onClick={() => (view === 'month' ? navigateMonth('next') : navigate('next'))} aria-label={tx.next} className="ek-btn ek-btn-ghost ek-btn-square" style={{ padding: '6px 11px', fontSize: 13 }}>›</button>
                {view !== 'month' && (
                  <span className="ad03-draghint" style={{ marginLeft: 6, fontFamily: 'var(--ek-font-mono)', fontSize: 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ek-text-faint)' }}>{tx.dragHint}</span>
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ek-text)', letterSpacing: '-0.01em' }}>{view === 'month' ? monthLabel : weekRangeLabel}</span>
              {view === 'month' ? (
                <span style={{ width: 1 }} />
              ) : (
                <button onClick={() => setShowAllHours(v => !v)} style={{ fontSize: 11, fontWeight: 700, color: 'var(--ek-red)', background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'var(--ek-font-sans)', letterSpacing: '0.03em' }}>
                  {showAllHours ? tx.showBusinessHours : tx.showAllHours}
                </button>
              )}
            </div>
            {view === 'month' ? renderMonth() : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: cols.length > 1 ? 600 : undefined }}>
                  {renderDayHeaders(cols)}
                  {renderGrid(cols)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Unassigned inbox rail — persistent queue of teacherless pending
            bookings. Drag a card onto the grid to place it in a slot; click to
            open the Drawer and assign a teacher. Replaces the old kanban + the
            top pending-assignments table. */}
        <section className="ad03-inbox" aria-labelledby="ek-inbox-title" aria-describedby="ek-inbox-hint" style={{ width: 238, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 id="ek-inbox-title" className="ek-microlabel" style={{ margin: 0, color: 'var(--ek-red)' }}>{tx.unassigned}</h2>
            <span style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--ek-text-muted)', fontFeatureSettings: '"tnum"' }}>{pendingBookings.length}</span>
          </div>
          <p id="ek-inbox-hint" style={{ margin: '0 0 10px', fontSize: 10.5, lineHeight: 1.45, color: 'var(--ek-text-faint)' }}>{tx.inboxHint}</p>
          <div className="ad03-inbox-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 560, overflowY: 'auto', paddingRight: 2 }}>
            {pendingBookings.length === 0 ? (
              <div style={{ padding: '20px 14px', textAlign: 'center', fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ek-text-muted)', border: '1px dashed var(--ek-border-mid)', borderRadius: 'var(--ek-radius-md)' }}>
                {tx.inboxEmpty}
              </div>
            ) : pendingBookings.map(pb => (
              <button
                key={pb.id}
                data-ek-inbox={pb.id}
                draggable
                onDragStart={(e) => onInboxDragStart(e, pb)}
                onDragEnd={endDrag}
                onClick={() => openInbox(pb)}
                style={{
                  position: 'relative', textAlign: 'left', cursor: 'grab',
                  background: 'var(--ek-card)', border: '1px dashed var(--ek-red-tint-3)',
                  borderRadius: 'var(--ek-radius-md)', padding: '9px 11px 9px 13px',
                  fontFamily: 'var(--ek-font-sans)', opacity: draggingId === pb.id ? 0.4 : 1,
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}
              >
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--ek-red)', borderRadius: '3px 0 0 3px' }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ek-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pb.student_name || tx.studentFallback}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ek-text-soft)', fontFeatureSettings: '"tnum"', textTransform: 'capitalize' }}>
                  {new Date(pb.scheduled_at).toLocaleString(DLOC, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timezone })}
                </span>
                <span style={{ display: 'flex', gap: 5, fontSize: 10, color: 'var(--ek-text-muted)' }}>
                  <span>{typeLabel(pb.type)}</span>
                  {pb.duration_minutes ? <span style={{ fontFeatureSettings: '"tnum"' }}>· {tx.minTight(pb.duration_minutes)}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </section>
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

      {/* Create booking — opens from clicking an empty grid slot (P5). On-brand
          Modal; force-overridable guards (availability / primary-teacher) surface
          inline as a "Continue anyway" button rather than a stacked dialog. */}
      <Modal
        open={createOpen}
        onClose={closeCreate}
        kicker={tx.createKicker}
        title={tx.createTitle}
        maxWidth={470}
        labelledBy="ek-create-title"
        footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={closeCreate} className="ek-btn ek-btn-ghost ek-btn-square" style={{ flex: 1, justifyContent: 'center', padding: '11px 0' }}>{tx.cancel}</button>
            {cForceable ? (
              <button onClick={() => submitCreate(true)} disabled={isPending} className="ek-btn ek-btn-red ek-btn-square" style={{ flex: 1, justifyContent: 'center', padding: '11px 0', opacity: isPending ? 0.6 : 1 }}>{tx.continueAnyway}</button>
            ) : (
              <button onClick={() => submitCreate(false)} disabled={isPending || !cStudent || !createIso} className="ek-btn ek-btn-primary ek-btn-square" style={{ flex: 1, justifyContent: 'center', padding: '11px 0', opacity: (isPending || !cStudent || !createIso) ? 0.6 : 1 }}>{isPending ? tx.creating : tx.createSubmit}</button>
            )}
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
          <div>
            <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 6 }}>{tx.createStudent}</div>
            <select id="ek-create-student" aria-describedby={creditWarn ? 'ek-create-student-help' : undefined} value={cStudent} onChange={e => { setCStudent(e.target.value); resetCreateError() }} disabled={isPending} className="ek-input" style={{ ...inputStyle, width: '100%' }}>
              <option value="">{tx.createSelectStudent}</option>
              {allStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.email ? ` · ${s.email}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 6 }}>{tx.createTeacher}</div>
            <select value={cTeacher} onChange={e => { setCTeacher(e.target.value); resetCreateError() }} disabled={isPending} className="ek-input" style={{ ...inputStyle, width: '100%' }}>
              <option value="">{tx.createUnassigned}</option>
              {teachers.map(t => {
                const ok = createIso ? isTeacherAvailableClient(t.id, availSlots, createIso, cDuration) : true
                const paused = !t.accepting
                const label = paused
                  ? tx.pausedOption(t.name)
                  : (createIso && cType === 'class') ? (ok ? tx.okOption(t.name) : tx.offHoursOption(t.name)) : t.name
                return <option key={t.id} value={t.id} disabled={paused}>{label}</option>
              })}
            </select>
          </div>

          <div>
            <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 6 }}>{tx.createWhen} · {zoneLabel}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="date" value={cDate} onChange={e => { setCDate(e.target.value); resetCreateError() }} className="ek-input" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
              <input type="time" value={cTime} step={900} onChange={e => { setCTime(e.target.value); resetCreateError() }} className="ek-input" style={{ ...inputStyle, width: 118, flexShrink: 0 }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 6 }}>{tx.type}</div>
              <select value={cType} onChange={e => { setCType(e.target.value); resetCreateError() }} disabled={isPending} className="ek-input" style={{ ...inputStyle, width: '100%' }}>
                {BOOKING_TYPES.map(ty => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
              </select>
            </div>
            <div>
              <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 6 }}>{tx.duration}</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {CREATE_DURATIONS.map(d => (
                  <button key={d} type="button" aria-label={tx.minShort(d)} aria-pressed={cDuration === d} onClick={() => { setCDuration(d); resetCreateError() }} style={{
                    padding: '8px 9px', borderRadius: 'var(--ek-radius-sm)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--ek-font-mono)',
                    border: `1px solid ${cDuration === d ? 'var(--ek-ink)' : 'var(--ek-border-mid)'}`,
                    background: cDuration === d ? 'var(--ek-ink)' : 'transparent', color: cDuration === d ? '#fff' : 'var(--ek-text-soft)',
                  }}>{d}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="ek-microlabel" style={{ color: 'var(--ek-text-muted)', marginBottom: 6 }}>{tx.createNotes}</div>
            <textarea value={cNotes} onChange={e => setCNotes(e.target.value)} placeholder={tx.createNotesPlaceholder} rows={2} className="ek-input" style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
          </div>

          {creditWarn && !cError && createStudentObj && (
            <p id="ek-create-student-help" role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--ek-red)', lineHeight: 1.5 }}>{tx.noCredits(createStudentObj.name.split(' ')[0])}</p>
          )}
          {cError && (
            <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--ek-red)', lineHeight: 1.5 }}>{cError}</p>
          )}
        </div>
      </Modal>

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
