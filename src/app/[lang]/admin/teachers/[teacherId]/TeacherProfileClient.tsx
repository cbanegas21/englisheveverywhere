'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TeacherDetail } from './page'
import {
  toggleTeacherActive,
  setTeacherRate,
  saveTeacherAdminNotes,
  adminUpdateTeacherProfile,
  deleteTeacher,
  resetStudentPassword,
  getTeacherCvSignedUrl,
} from '../../actions'
import MeetingScheduler from '@/components/admin/MeetingScheduler'

type Lang = 'es' | 'en'

// Stable tab keys decouple state/logic from the displayed (localized) label.
const TAB_KEYS = ['overview', 'schedule', 'students', 'history', 'profile', 'tools'] as const
type Tab = typeof TAB_KEYS[number]

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'rgba(251,191,36,0.15)', color: '#B45309', label: 'Pending' },
  confirmed: { bg: 'rgba(59,130,246,0.15)', color: '#1D4ED8', label: 'Confirmed' },
  completed: { bg: 'rgba(52,211,153,0.15)', color: '#059669', label: 'Completed' },
  cancelled: { bg: 'rgba(156,163,175,0.15)', color: '#6B7280', label: 'Cancelled' },
}

const STR = {
  en: {
    locale: 'en-US',
    tabs: { overview: 'Overview', schedule: 'Schedule', students: 'Students', history: 'Session History', profile: 'Profile', tools: 'Admin Tools' },
    dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    unknown: 'Unknown',
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    error: 'An error occurred',
    // toasts
    rateSaved: 'Rate saved',
    rateUpdated: 'Rate updated',
    notesSaved: 'Notes saved',
    profileSaved: 'Profile saved',
    teacherActivated: 'Teacher activated',
    teacherDeactivated: 'Teacher deactivated',
    resetEmailSent: 'Reset email sent',
    teacherDeleted: 'Teacher deleted',
    // sidebar
    memberSince: 'Member since',
    totalSessions: 'Total Sessions',
    activeStudents: 'Active Students',
    quickActions: 'Quick Actions',
    scheduleCall: 'Schedule a call',
    viewAllBookings: 'View all bookings',
    // overview
    thisMonth: 'This Month',
    rating: 'Rating',
    hourlyRate: 'Hourly Rate',
    save: 'Save',
    status: 'Status',
    clickToToggle: 'click to toggle',
    availability: 'Availability',
    slots: 'slots',
    noAvailability: 'No availability slots configured.',
    adminNotes: 'Admin Notes',
    notesPlaceholder: 'Internal notes about this teacher…',
    autoSaves: 'Auto-saves on blur',
    // schedule
    prevWeek: '← Prev week',
    nextWeek: 'Next week →',
    scheduleNew: '+ Schedule new',
    // students tab
    noStudents: 'No active students assigned.',
    colStudent: 'Student',
    colLevel: 'Level',
    colClassesLeft: 'Classes Left',
    colNextClass: 'Next Class',
    // history
    totalHoursTaught: 'Total Hours Taught',
    sessionsCompleted: 'Sessions Completed',
    noCompletedSessions: 'No completed sessions yet.',
    colDate: 'Date',
    colDuration: 'Duration',
    colType: 'Type',
    min: 'min',
    // profile tab
    basicInfo: 'Basic Info',
    fullName: 'Full Name',
    timezone: 'Timezone',
    email: 'Email',
    bio: 'Bio',
    bioPlaceholder: 'Teacher bio…',
    cv: 'CV / Résumé',
    uploadedCv: 'Uploaded CV',
    uploaded: 'Uploaded',
    openNewTab: 'Open in new tab',
    noCv: 'No CV uploaded — teacher applied before the file requirement was added.',
    specializations: 'Specializations',
    addSpec: 'Add specialization…',
    certifications: 'Certifications',
    addCert: 'Add certification…',
    add: 'Add',
    saveProfile: 'Save Profile',
    // admin tools
    passwordReset: 'Password Reset',
    sendResetCopy: (email: string) => `Send a password reset link to ${email}.`,
    thisTeacher: 'this teacher',
    sendResetEmail: 'Send reset email',
    update: 'Update',
    saved: '✓ Saved',
    accountStatus: 'Account Status',
    activeClickDeactivate: 'Active — click to deactivate',
    inactiveClickActivate: 'Inactive — click to activate',
    dangerZone: 'Danger Zone',
    deleteCopy: 'Permanently delete this teacher record. Their profile will revert to student.',
    deleteTeacher: 'Delete teacher',
    areYouSure: 'Are you sure? This cannot be undone.',
    yesDelete: 'Yes, delete',
    cancel: 'Cancel',
    // back link
    backToTeachers: '← Back to Teachers',
  },
  es: {
    locale: 'es-HN',
    tabs: { overview: 'Resumen', schedule: 'Agenda', students: 'Estudiantes', history: 'Historial de sesiones', profile: 'Perfil', tools: 'Herramientas de admin' },
    dayNames: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    unknown: 'Desconocido',
    active: 'Activo',
    inactive: 'Inactivo',
    pending: 'Pendiente',
    error: 'Ocurrió un error',
    // toasts
    rateSaved: 'Tarifa guardada',
    rateUpdated: 'Tarifa actualizada',
    notesSaved: 'Notas guardadas',
    profileSaved: 'Perfil guardado',
    teacherActivated: 'Maestro activado',
    teacherDeactivated: 'Maestro desactivado',
    resetEmailSent: 'Correo de restablecimiento enviado',
    teacherDeleted: 'Maestro eliminado',
    // sidebar
    memberSince: 'Miembro desde',
    totalSessions: 'Sesiones totales',
    activeStudents: 'Estudiantes activos',
    quickActions: 'Acciones rápidas',
    scheduleCall: 'Agendar una llamada',
    viewAllBookings: 'Ver todas las reservas',
    // overview
    thisMonth: 'Este mes',
    rating: 'Calificación',
    hourlyRate: 'Tarifa por hora',
    save: 'Guardar',
    status: 'Estado',
    clickToToggle: 'clic para cambiar',
    availability: 'Disponibilidad',
    slots: 'horarios',
    noAvailability: 'No hay horarios de disponibilidad configurados.',
    adminNotes: 'Notas de admin',
    notesPlaceholder: 'Notas internas sobre este maestro…',
    autoSaves: 'Se guarda automáticamente al salir',
    // schedule
    prevWeek: '← Semana anterior',
    nextWeek: 'Semana siguiente →',
    scheduleNew: '+ Agendar nuevo',
    // students tab
    noStudents: 'No hay estudiantes activos asignados.',
    colStudent: 'Estudiante',
    colLevel: 'Nivel',
    colClassesLeft: 'Clases restantes',
    colNextClass: 'Próxima clase',
    // history
    totalHoursTaught: 'Horas impartidas',
    sessionsCompleted: 'Sesiones completadas',
    noCompletedSessions: 'Aún no hay sesiones completadas.',
    colDate: 'Fecha',
    colDuration: 'Duración',
    colType: 'Tipo',
    min: 'min',
    // profile tab
    basicInfo: 'Información básica',
    fullName: 'Nombre completo',
    timezone: 'Zona horaria',
    email: 'Correo',
    bio: 'Biografía',
    bioPlaceholder: 'Biografía del maestro…',
    cv: 'CV / Currículum',
    uploadedCv: 'CV cargado',
    uploaded: 'Cargado',
    openNewTab: 'Abrir en nueva pestaña',
    noCv: 'No se cargó CV — el maestro aplicó antes de que se agregara el requisito del archivo.',
    specializations: 'Especialidades',
    addSpec: 'Agregar especialidad…',
    certifications: 'Certificaciones',
    addCert: 'Agregar certificación…',
    add: 'Agregar',
    saveProfile: 'Guardar perfil',
    // admin tools
    passwordReset: 'Restablecer contraseña',
    sendResetCopy: (email: string) => `Enviar un enlace para restablecer la contraseña a ${email}.`,
    thisTeacher: 'este maestro',
    sendResetEmail: 'Enviar correo de restablecimiento',
    update: 'Actualizar',
    saved: '✓ Guardado',
    accountStatus: 'Estado de la cuenta',
    activeClickDeactivate: 'Activo — clic para desactivar',
    inactiveClickActivate: 'Inactivo — clic para activar',
    dangerZone: 'Zona de peligro',
    deleteCopy: 'Eliminar permanentemente el registro de este maestro. Su perfil volverá a ser estudiante.',
    deleteTeacher: 'Eliminar maestro',
    areYouSure: '¿Estás seguro? Esta acción no se puede deshacer.',
    yesDelete: 'Sí, eliminar',
    cancel: 'Cancelar',
    // back link
    backToTeachers: '← Volver a Maestros',
  },
} as const

interface Props {
  teacher: TeacherDetail
  lang: string
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      padding: '12px 20px', borderRadius: 10,
      background: type === 'success' ? '#059669' : '#C41E3A',
      color: '#fff', fontSize: 13, fontWeight: 600,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      {msg}
    </div>
  )
}

export default function TeacherProfileClient({ teacher, lang }: Props) {
  const t = STR[(lang as Lang) === 'en' ? 'en' : 'es']
  const DAY_NAMES = t.dayNames
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showScheduler, setShowScheduler] = useState(false)

  // Overview state
  const [adminNotes, setAdminNotes] = useState(teacher.admin_notes || '')
  const [rate, setRate] = useState(String(teacher.hourly_rate || 0))
  const [rateSaved, setRateSaved] = useState(false)

  // Profile tab state
  const [bio, setBio] = useState(teacher.bio || '')
  const [specs, setSpecs] = useState<string[]>(teacher.specializations || [])
  const [certs, setCerts] = useState<string[]>(teacher.certifications || [])
  const [timezone, setTimezone] = useState(teacher.profile?.timezone || '')
  const [fullName, setFullName] = useState(teacher.profile?.full_name || '')
  const [newSpec, setNewSpec] = useState('')
  const [newCert, setNewCert] = useState('')

  // Admin tools state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isActive, setIsActive] = useState(teacher.is_active)

  // Schedule state
  const [weekOffset, setWeekOffset] = useState(0)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function run(fn: () => Promise<void>, successMsg: string) {
    startTransition(async () => {
      try {
        await fn()
        showToast(successMsg)
        router.refresh()
      } catch (e) {
        showToast(e instanceof Error ? e.message : t.error, 'error')
      }
    })
  }

  const initials = (teacher.profile?.full_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const statusBadge = teacher.is_active ? { bg: 'rgba(5,150,105,0.1)', color: '#059669', label: t.active }
    : { bg: 'rgba(245,158,11,0.1)', color: '#D97706', label: t.pending }

  const sessionsThisMonth = teacher.bookings.filter(b => {
    if (b.status !== 'completed') return false
    const d = new Date(b.scheduled_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: 6, display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8,
    border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#111', outline: 'none',
  }
  const btnPrimary: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, background: '#C41E3A', color: '#fff',
    fontSize: 13, fontWeight: 600, border: 'none',
    cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1,
  }
  const btnSecondary: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8, background: '#F3F4F6', color: '#374151',
    fontSize: 13, fontWeight: 500, border: '1px solid #E5E7EB',
    cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1,
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  function renderSidebar() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Avatar + name */}
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: '#C41E3A',
            color: '#fff', fontSize: 22, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            {initials}
          </div>
          <p style={{ fontWeight: 700, fontSize: 16, color: '#111', margin: 0 }}>
            {teacher.profile?.full_name || t.unknown}
          </p>
          <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{teacher.profile?.email || '—'}</p>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
            {t.memberSince} {new Date(teacher.created_at).toLocaleDateString(t.locale, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <div style={{ marginTop: 10 }}>
            <span style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 20,
              background: statusBadge.bg, color: statusBadge.color,
              fontSize: 12, fontWeight: 700,
            }}>
              {statusBadge.label}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: t.totalSessions, value: teacher.total_sessions ?? 0 },
              { label: t.activeStudents, value: teacher.activeStudentCount },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>{stat.value}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={cardStyle}>
          <span style={labelStyle}>{t.quickActions}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              style={{ ...btnSecondary, textAlign: 'center' }}
              onClick={() => setShowScheduler(true)}
            >
              {t.scheduleCall}
            </button>
            <a
              href={`/${lang}/admin/bookings`}
              style={{ ...btnSecondary, textAlign: 'center', textDecoration: 'none', display: 'block' }}
            >
              {t.viewAllBookings}
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: Overview ──────────────────────────────────────────────────────────
  function renderOverview() {
    const uniqueDays = [...new Set(teacher.availSlots.map(s => s.day_of_week))].sort()

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: t.totalSessions, value: teacher.total_sessions ?? 0 },
            { label: t.thisMonth, value: sessionsThisMonth },
            { label: t.activeStudents, value: teacher.activeStudentCount },
            { label: t.rating, value: teacher.rating ? Number(teacher.rating).toFixed(1) : '—' },
          ].map(c => (
            <div key={c.label} style={cardStyle}>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{c.label}</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: '#111', margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Rate + Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={cardStyle}>
            <span style={labelStyle}>{t.hourlyRate}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9CA3AF' }}>$</span>
                <input
                  type="number"
                  value={rate}
                  onChange={e => { setRate(e.target.value); setRateSaved(false) }}
                  min="0"
                  style={{ ...inputStyle, width: 100, paddingLeft: 22 }}
                />
              </div>
              <button
                style={{ ...btnPrimary, padding: '8px 12px' }}
                disabled={isPending}
                onClick={() => {
                  const parsed = parseFloat(rate)
                  if (!isNaN(parsed)) {
                    run(() => setTeacherRate(teacher.id, parsed), t.rateSaved)
                    setRateSaved(true)
                    setTimeout(() => setRateSaved(false), 2000)
                  }
                }}
              >
                {rateSaved ? '✓' : t.save}
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <span style={labelStyle}>{t.status}</span>
            <button
              onClick={() => {
                const next = !isActive
                setIsActive(next)
                run(() => toggleTeacherActive(teacher.id, next), next ? t.teacherActivated : t.teacherDeactivated)
              }}
              disabled={isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 8,
                background: isActive ? 'rgba(5,150,105,0.1)' : 'rgba(156,163,175,0.1)',
                color: isActive ? '#059669' : '#6B7280',
                border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#059669' : '#9CA3AF' }} />
              {isActive ? t.active : t.inactive} — {t.clickToToggle}
            </button>
          </div>
        </div>

        {/* Availability summary */}
        <div style={cardStyle}>
          <span style={labelStyle}>{t.availability} ({teacher.availSlots.length} {t.slots})</span>
          {teacher.availSlots.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>{t.noAvailability}</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {uniqueDays.map(d => (
                <span key={d} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(196,30,58,0.07)', color: '#C41E3A', fontSize: 12, fontWeight: 600 }}>
                  {DAY_NAMES[d]}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Admin notes */}
        <div style={cardStyle}>
          <span style={labelStyle}>{t.adminNotes}</span>
          <textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            onBlur={() => run(() => saveTeacherAdminNotes(teacher.id, adminNotes), t.notesSaved)}
            placeholder={t.notesPlaceholder}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{t.autoSaves}</p>
        </div>
      </div>
    )
  }

  // ── Tab: Schedule (Week Calendar) ──────────────────────────────────────────
  function renderSchedule() {
    const now = new Date()
    const startOfWeek = new Date(now)
    const day = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - day + 1 + weekOffset * 7) // Monday
    startOfWeek.setHours(0, 0, 0, 0)

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek)
      d.setDate(d.getDate() + i)
      return d
    })

    const relevantTypes = new Set(['class', 'placement_test', 'teacher_interview', 'admin_checkin'])
    const weekBookings = teacher.bookings.filter(b => {
      if (b.status === 'cancelled') return false
      if (!relevantTypes.has(b.type)) return false
      const d = new Date(b.scheduled_at)
      return d >= weekDays[0] && d < new Date(weekDays[6].getTime() + 86400000)
    })

    // Group bookings by day
    const byDay = new Map<number, typeof weekBookings>()
    for (const b of weekBookings) {
      const d = new Date(b.scheduled_at).getDay()
      if (!byDay.has(d)) byDay.set(d, [])
      byDay.get(d)!.push(b)
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Week nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {t.prevWeek}
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
            {weekDays[0].toLocaleDateString(t.locale, { month: 'short', day: 'numeric' })} –{' '}
            {weekDays[6].toLocaleDateString(t.locale, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {t.nextWeek}
          </button>
        </div>

        <button
          style={{ ...btnPrimary, alignSelf: 'flex-start' }}
          onClick={() => setShowScheduler(true)}
        >
          {t.scheduleNew}
        </button>

        {/* Day columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {weekDays.map((d, idx) => {
            const jsDay = d.getDay()
            const dayBookings = byDay.get(jsDay) || []
            const isToday = d.toDateString() === new Date().toDateString()

            return (
              <div key={idx}>
                <div style={{
                  textAlign: 'center', padding: '6px 4px 8px',
                  borderRadius: '8px 8px 0 0',
                  background: isToday ? '#C41E3A' : '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderBottom: 'none',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: isToday ? 'rgba(255,255,255,0.8)' : '#6B7280', margin: 0 }}>
                    {DAY_NAMES[jsDay]}
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: isToday ? '#fff' : '#111', margin: 0 }}>
                    {d.getDate()}
                  </p>
                </div>
                <div style={{
                  border: '1px solid #E5E7EB', borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  minHeight: 80, padding: 6,
                  background: '#fff',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  {dayBookings.length === 0 ? (
                    <p style={{ fontSize: 10, color: '#D1D5DB', textAlign: 'center', marginTop: 12 }}>—</p>
                  ) : dayBookings.map(b => {
                    const isConfirmed = b.status === 'confirmed'
                    return (
                      <div
                        key={b.id}
                        title={`${b.studentName || 'Unknown'} · ${b.type} · ${b.status}`}
                        style={{
                          padding: '4px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: isConfirmed ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
                          color: isConfirmed ? '#059669' : '#B45309',
                          cursor: 'default',
                        }}
                      >
                        {new Date(b.scheduled_at).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit', timeZone: 'America/Tegucigalpa' })}
                        <br />
                        <span style={{ fontWeight: 400 }}>{b.studentName || '—'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Tab: Students ──────────────────────────────────────────────────────────
  function renderStudents() {
    return (
      <div style={cardStyle}>
        {teacher.students.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '32px 0' }}>
            {t.noStudents}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {[t.colStudent, t.colLevel, t.colClassesLeft, t.colNextClass].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teacher.students.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/${lang}/admin/students/${s.id}`)}
                    style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                    className="hover:bg-gray-50"
                  >
                    <td style={{ padding: '11px 14px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: 0 }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{s.email}</p>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {s.level ? (
                        <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(196,30,58,0.08)', color: '#C41E3A', fontSize: 12, fontWeight: 700 }}>
                          {s.level}
                        </span>
                      ) : <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: s.classes_remaining === 0 ? '#C41E3A' : '#374151', fontWeight: s.classes_remaining === 0 ? 700 : 400 }}>
                      {s.classes_remaining}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {s.nextClassDate
                        ? new Date(s.nextClassDate).toLocaleDateString(t.locale, { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── Tab: Session History ───────────────────────────────────────────────────
  function renderHistory() {
    const completed = teacher.bookings.filter(b => b.status === 'completed')
    const totalHours = completed.reduce((acc, b) => acc + (b.duration_minutes || 60), 0) / 60

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={cardStyle}>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{t.totalHoursTaught}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#111', margin: 0 }}>{totalHours.toFixed(1)}</p>
          </div>
          <div style={cardStyle}>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{t.sessionsCompleted}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#111', margin: 0 }}>{completed.length}</p>
          </div>
        </div>

        <div style={cardStyle}>
          {completed.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '32px 0' }}>{t.noCompletedSessions}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {[t.colDate, t.colStudent, t.colDuration, t.colType].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {completed.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                        {new Date(b.scheduled_at).toLocaleDateString(t.locale, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151' }}>{b.studentName || '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#6B7280' }}>
                        {b.duration_minutes ? `${b.duration_minutes} ${t.min}` : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#6B7280', textTransform: 'capitalize' }}>{b.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Tab: Profile ───────────────────────────────────────────────────────────
  function renderProfile() {
    function addSpec() {
      const v = newSpec.trim()
      if (v && !specs.includes(v)) setSpecs(s => [...s, v])
      setNewSpec('')
    }
    function addCert() {
      const v = newCert.trim()
      if (v && !certs.includes(v)) setCerts(s => [...s, v])
      setNewCert('')
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>{t.basicInfo}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <span style={labelStyle}>{t.fullName}</span>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <span style={labelStyle}>{t.timezone}</span>
              <input type="text" value={timezone} onChange={e => setTimezone(e.target.value)} style={inputStyle} placeholder="America/Tegucigalpa" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={labelStyle}>{t.email}</span>
              <input type="email" value={teacher.profile?.email || ''} readOnly style={{ ...inputStyle, background: '#F3F4F6', color: '#6B7280' }} />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <span style={labelStyle}>{t.bio}</span>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={5}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder={t.bioPlaceholder}
          />
        </div>

        <div style={cardStyle}>
          <span style={labelStyle}>{t.cv}</span>
          {teacher.cv_storage_path ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {teacher.cv_original_filename || t.uploadedCv}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>
                  {teacher.cv_uploaded_at
                    ? `${t.uploaded} ${new Date(teacher.cv_uploaded_at).toLocaleDateString(t.locale)}`
                    : t.uploaded}
                </p>
              </div>
              <button
                style={btnSecondary}
                onClick={async () => {
                  const res = await getTeacherCvSignedUrl(teacher.id)
                  if (res.success) {
                    window.open(res.url, '_blank', 'noopener,noreferrer')
                  } else {
                    setToast({ msg: res.error, type: 'error' })
                  }
                }}
              >
                {t.openNewTab}
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>
              {t.noCv}
            </p>
          )}
        </div>

        <div style={cardStyle}>
          <span style={labelStyle}>{t.specializations}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {specs.map(s => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'rgba(196,30,58,0.08)', color: '#C41E3A', fontSize: 12, fontWeight: 600 }}>
                {s}
                <button onClick={() => setSpecs(prev => prev.filter(x => x !== s))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C41E3A', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newSpec}
              onChange={e => setNewSpec(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSpec()}
              placeholder={t.addSpec}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button style={btnSecondary} onClick={addSpec}>{t.add}</button>
          </div>
        </div>

        <div style={cardStyle}>
          <span style={labelStyle}>{t.certifications}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {certs.map(c => (
              <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'rgba(59,130,246,0.08)', color: '#2563EB', fontSize: 12, fontWeight: 600 }}>
                {c}
                <button onClick={() => setCerts(prev => prev.filter(x => x !== c))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newCert}
              onChange={e => setNewCert(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCert()}
              placeholder={t.addCert}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button style={btnSecondary} onClick={addCert}>{t.add}</button>
          </div>
        </div>

        <div>
          <button
            style={btnPrimary}
            disabled={isPending}
            onClick={() => run(
              () => adminUpdateTeacherProfile(teacher.id, teacher.profile_id, { bio, specializations: specs, certifications: certs, timezone, full_name: fullName }),
              t.profileSaved
            )}
          >
            {t.saveProfile}
          </button>
        </div>
      </div>
    )
  }

  // ── Tab: Admin Tools ───────────────────────────────────────────────────────
  function renderAdminTools() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Password reset */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>{t.passwordReset}</h3>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
            {t.sendResetCopy(teacher.profile?.email || t.thisTeacher)}
          </p>
          <button
            style={btnPrimary}
            disabled={isPending || !teacher.profile?.email}
            onClick={() => run(() => resetStudentPassword(teacher.profile!.email!), t.resetEmailSent)}
          >
            {t.sendResetEmail}
          </button>
        </div>

        {/* Rate editor */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>{t.hourlyRate}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9CA3AF' }}>$</span>
              <input
                type="number" min="0" value={rate}
                onChange={e => { setRate(e.target.value); setRateSaved(false) }}
                style={{ ...inputStyle, width: 100, paddingLeft: 22 }}
              />
            </div>
            <button
              style={btnPrimary}
              disabled={isPending}
              onClick={() => {
                const parsed = parseFloat(rate)
                if (!isNaN(parsed)) run(() => setTeacherRate(teacher.id, parsed), t.rateUpdated)
              }}
            >
              {rateSaved ? t.saved : t.update}
            </button>
          </div>
        </div>

        {/* Toggle active */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>{t.accountStatus}</h3>
          <button
            onClick={() => {
              const next = !isActive
              setIsActive(next)
              run(() => toggleTeacherActive(teacher.id, next), next ? t.teacherActivated : t.teacherDeactivated)
            }}
            disabled={isPending}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: isActive ? 'rgba(5,150,105,0.1)' : 'rgba(156,163,175,0.1)',
              color: isActive ? '#059669' : '#6B7280',
            }}
          >
            {isActive ? t.activeClickDeactivate : t.inactiveClickActivate}
          </button>
        </div>

        {/* Delete teacher */}
        <div style={{ ...cardStyle, border: '1px solid rgba(196,30,58,0.3)', background: 'rgba(196,30,58,0.02)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#C41E3A', margin: '0 0 8px' }}>{t.dangerZone}</h3>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
            {t.deleteCopy}
          </p>
          {!showDeleteConfirm ? (
            <button
              style={{ ...btnPrimary, background: '#fff', color: '#C41E3A', border: '1px solid #C41E3A' }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t.deleteTeacher}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#374151' }}>{t.areYouSure}</span>
              <button
                style={btnPrimary}
                onClick={() => {
                  setShowDeleteConfirm(false)
                  run(
                    () => deleteTeacher(teacher.id, teacher.profile_id),
                    t.teacherDeleted
                  )
                  router.push(`/${lang}/admin/teachers`)
                }}
              >
                {t.yesDelete}
              </button>
              <button style={btnSecondary} onClick={() => setShowDeleteConfirm(false)}>{t.cancel}</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const statusStyles = STATUS_STYLES

  void statusStyles

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {showScheduler && (
        <MeetingScheduler
          type="teacher_call"
          teacherId={teacher.id}
          teacherName={teacher.profile?.full_name || ''}
          allStudents={teacher.allStudents}
          allTeachers={teacher.allTeachers}
          existingBookings={teacher.bookings.map(b => ({
            scheduled_at: b.scheduled_at,
            teacher_id: teacher.id,
            student_id: b.student_id,
          }))}
          onClose={() => setShowScheduler(false)}
          onSuccess={() => { setShowScheduler(false); router.refresh() }}
          lang={lang}
        />
      )}

      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => router.push(`/${lang}/admin/teachers`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
        >
          {t.backToTeachers}
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Left: tabs (70%) */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          {/* Tab navigation */}
          <div style={{
            display: 'flex', gap: 2, background: '#F3F4F6',
            borderRadius: 10, padding: 4, marginBottom: 20, overflowX: 'auto',
          }}>
            {TAB_KEYS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
                  background: activeTab === tab ? '#fff' : 'transparent',
                  color: activeTab === tab ? '#111' : '#6B7280',
                  boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                {t.tabs[tab]}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'schedule' && renderSchedule()}
          {activeTab === 'students' && renderStudents()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'tools' && renderAdminTools()}
        </div>

        {/* Right: sidebar (30%) */}
        <div style={{ width: 300, flexShrink: 0 }}>
          {renderSidebar()}
        </div>
      </div>
    </>
  )
}
