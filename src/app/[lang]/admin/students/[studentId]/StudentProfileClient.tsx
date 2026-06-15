'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentDetail } from './page'
import {
  updateStudentLevel,
  setPrimaryTeacher,
  addStudentClasses,
  saveAdminNotes,
  completeBooking,
  cancelBookingWithRefund,
  adminUpdateStudentProfile,
  resetStudentPassword,
  updateStudentRole,
  setStudentDeactivated,
} from '../../actions'
import MeetingScheduler from '@/components/admin/MeetingScheduler'

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
  A1: { bg: 'rgba(156,163,175,0.15)', color: '#6B7280' },
  A2: { bg: 'rgba(96,165,250,0.15)', color: '#2563EB' },
  B1: { bg: 'rgba(52,211,153,0.15)', color: '#059669' },
  B2: { bg: 'rgba(167,139,250,0.15)', color: '#7C3AED' },
  C1: { bg: 'rgba(251,146,60,0.15)', color: '#EA580C' },
  C2: { bg: 'rgba(196,30,58,0.15)', color: '#C41E3A' },
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:   { bg: 'rgba(251,191,36,0.15)', color: '#B45309' },
  confirmed: { bg: 'rgba(59,130,246,0.15)', color: '#1D4ED8' },
  completed: { bg: 'rgba(52,211,153,0.15)', color: '#059669' },
  cancelled: { bg: 'rgba(156,163,175,0.15)', color: '#6B7280' },
}

const TABS = ['Overview', 'Classes', 'Payments', 'Profile & Preferences', 'Admin Tools'] as const
type Tab = typeof TABS[number]

const STR = {
  en: {
    statusLabels: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
    } as Record<string, string>,
    typeLabels: {
      class: 'Class',
      placement_test: 'Diagnostic call',
      student_call: 'Call',
    } as Record<string, string>,
    tabLabels: {
      Overview: 'Overview',
      Classes: 'Classes',
      Payments: 'Payments',
      'Profile & Preferences': 'Profile & Preferences',
      'Admin Tools': 'Admin Tools',
    } as Record<Tab, string>,
    genericError: 'An error occurred',
    unknown: 'Unknown',
    dash: '—',
    memberSince: 'Member since',
    completed: 'Completed',
    classesLeft: 'Classes Left',
    primaryTeacher: 'Primary Teacher',
    unassigned: 'Unassigned',
    primaryTeacherHint: "Student's usual teacher. Reference only — each booking is still assigned manually.",
    paused: 'paused',
    save: 'Save',
    quickActions: 'Quick Actions',
    scheduleCall: 'Schedule a call',
    sendEmail: 'Send email',
    addClasses: 'Add classes',
    confirm: 'Confirm',
    cancel: 'Cancel',
    primaryTeacherUpdated: 'Primary teacher updated',
    classesAdded: (n: number) => `${n} ${n === 1 ? 'class' : 'classes'} added`,
    // Overview
    classesRemaining: 'Classes Remaining',
    completedClasses: 'Completed Classes',
    upcomingClasses: 'Upcoming Classes',
    estTotalPaid: 'Est. Total Paid',
    cefrLevel: 'CEFR Level',
    notSet: 'Not set',
    assignedTeacher: 'Assigned Teacher',
    levelUpdated: 'Level updated',
    adminNotes: 'Admin Notes',
    adminNotesPlaceholder: 'Internal notes about this student...',
    notesSaved: 'Notes saved',
    autoSaves: 'Auto-saves on blur',
    // Classes
    classHeaders: {
      date: 'Date',
      type: 'Type',
      teacher: 'Teacher',
      status: 'Status',
      duration: 'Duration',
      actions: 'Actions',
    },
    noClassBookings: 'No class bookings yet.',
    min: 'min',
    complete: 'Complete',
    cancelBtn: 'Cancel',
    bookingMarkedComplete: 'Booking marked complete',
    cancelBookingTitle: 'Cancel this booking?',
    cancelBookingBody: 'If this is a class booking, 1 class credit will be returned to the student.',
    keepBooking: 'Keep booking',
    yesCancel: 'Yes, cancel',
    bookingCancelled: 'Booking cancelled',
    // Payments
    paymentsSoon: 'Payment tracking coming soon. Purchase history will appear here once the payments integration is connected.',
    addClassesManually: 'Add Classes Manually',
    addClassesManuallyHint: 'Use this to credit classes without a payment transaction.',
    classWord: (n: number) => (n !== 1 ? 'classes' : 'class'),
    add: 'Add',
    // Profile
    basicInformation: 'Basic Information',
    fullName: 'Full Name',
    timezone: 'Timezone',
    preferredLanguage: 'Preferred Language',
    email: 'Email',
    intakeInformation: 'Intake Information',
    learningGoal: 'Learning Goal',
    workDescription: 'Work Description',
    learningStyle: 'Learning Style',
    ageRange: 'Age Range',
    surveyAnswers: 'Survey Answers',
    saveProfile: 'Save Profile',
    profileSaved: 'Profile saved',
    // Admin Tools
    passwordReset: 'Password Reset',
    passwordResetHint: (who: string) => `Send a password reset link to ${who}.`,
    thisStudent: 'this student',
    sendResetEmail: 'Send reset email',
    resetEmailSent: 'Reset email sent',
    changeRole: 'Change Role',
    roleStudent: 'student',
    roleTeacher: 'teacher',
    roleAdmin: 'admin',
    saveRole: 'Save role',
    roleUpdated: 'Role updated',
    dangerZone: 'Danger Zone',
    dangerZoneHint: 'This action will deactivate access for this student. Use with caution.',
    deactivateAccount: 'Deactivate account',
    areYouSure: 'Are you sure?',
    yesDeactivate: 'Yes, deactivate',
    accountDeactivated: 'Account deactivated',
    // Footer / nav
    backToStudents: '← Back to Students',
  },
  es: {
    statusLabels: {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      completed: 'Completada',
      cancelled: 'Cancelada',
    } as Record<string, string>,
    typeLabels: {
      class: 'Clase',
      placement_test: 'Llamada de diagnóstico',
      student_call: 'Llamada',
    } as Record<string, string>,
    tabLabels: {
      Overview: 'Resumen',
      Classes: 'Clases',
      Payments: 'Pagos',
      'Profile & Preferences': 'Perfil y preferencias',
      'Admin Tools': 'Herramientas de admin',
    } as Record<Tab, string>,
    genericError: 'Ocurrió un error',
    unknown: 'Desconocido',
    dash: '—',
    memberSince: 'Miembro desde',
    completed: 'Completadas',
    classesLeft: 'Clases restantes',
    primaryTeacher: 'Maestro principal',
    unassigned: 'Sin asignar',
    primaryTeacherHint: 'Maestro habitual del estudiante. Solo de referencia — cada reserva se asigna manualmente.',
    paused: 'en pausa',
    save: 'Guardar',
    quickActions: 'Acciones rápidas',
    scheduleCall: 'Agendar una llamada',
    sendEmail: 'Enviar correo',
    addClasses: 'Agregar clases',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    primaryTeacherUpdated: 'Maestro principal actualizado',
    classesAdded: (n: number) => `${n} ${n === 1 ? 'clase agregada' : 'clases agregadas'}`,
    // Overview
    classesRemaining: 'Clases restantes',
    completedClasses: 'Clases completadas',
    upcomingClasses: 'Clases próximas',
    estTotalPaid: 'Total pagado aprox.',
    cefrLevel: 'Nivel MCER',
    notSet: 'Sin definir',
    assignedTeacher: 'Maestro asignado',
    levelUpdated: 'Nivel actualizado',
    adminNotes: 'Notas de admin',
    adminNotesPlaceholder: 'Notas internas sobre este estudiante...',
    notesSaved: 'Notas guardadas',
    autoSaves: 'Se guarda automáticamente al salir',
    // Classes
    classHeaders: {
      date: 'Fecha',
      type: 'Tipo',
      teacher: 'Maestro',
      status: 'Estado',
      duration: 'Duración',
      actions: 'Acciones',
    },
    noClassBookings: 'Aún no hay clases reservadas.',
    min: 'min',
    complete: 'Completar',
    cancelBtn: 'Cancelar',
    bookingMarkedComplete: 'Reserva marcada como completada',
    cancelBookingTitle: '¿Cancelar esta reserva?',
    cancelBookingBody: 'Si es una reserva de clase, se devolverá 1 crédito de clase al estudiante.',
    keepBooking: 'Mantener reserva',
    yesCancel: 'Sí, cancelar',
    bookingCancelled: 'Reserva cancelada',
    // Payments
    paymentsSoon: 'El seguimiento de pagos llegará pronto. El historial de compras aparecerá aquí una vez que se conecte la integración de pagos.',
    addClassesManually: 'Agregar clases manualmente',
    addClassesManuallyHint: 'Úsalo para acreditar clases sin una transacción de pago.',
    classWord: (n: number) => (n !== 1 ? 'clases' : 'clase'),
    add: 'Agregar',
    // Profile
    basicInformation: 'Información básica',
    fullName: 'Nombre completo',
    timezone: 'Zona horaria',
    preferredLanguage: 'Idioma preferido',
    email: 'Correo',
    intakeInformation: 'Información de ingreso',
    learningGoal: 'Objetivo de aprendizaje',
    workDescription: 'Descripción del trabajo',
    learningStyle: 'Estilo de aprendizaje',
    ageRange: 'Rango de edad',
    surveyAnswers: 'Respuestas de la encuesta',
    saveProfile: 'Guardar perfil',
    profileSaved: 'Perfil guardado',
    // Admin Tools
    passwordReset: 'Restablecer contraseña',
    passwordResetHint: (who: string) => `Enviar un enlace para restablecer la contraseña a ${who}.`,
    thisStudent: 'este estudiante',
    sendResetEmail: 'Enviar correo de restablecimiento',
    resetEmailSent: 'Correo de restablecimiento enviado',
    changeRole: 'Cambiar rol',
    roleStudent: 'estudiante',
    roleTeacher: 'maestro',
    roleAdmin: 'admin',
    saveRole: 'Guardar rol',
    roleUpdated: 'Rol actualizado',
    dangerZone: 'Zona de peligro',
    dangerZoneHint: 'Esta acción desactivará el acceso de este estudiante. Úsala con precaución.',
    deactivateAccount: 'Desactivar cuenta',
    areYouSure: '¿Estás seguro?',
    yesDeactivate: 'Sí, desactivar',
    accountDeactivated: 'Cuenta desactivada',
    // Footer / nav
    backToStudents: '← Volver a Estudiantes',
  },
}

interface Props {
  student: StudentDetail
  lang: string
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        padding: '12px 20px',
        borderRadius: '10px',
        background: type === 'success' ? '#059669' : '#C41E3A',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {msg}
    </div>
  )
}

export default function StudentProfileClient({ student, lang }: Props) {
  const router = useRouter()
  const t = lang === 'es' ? STR.es : STR.en
  const dateLocale = lang === 'es' ? 'es-HN' : 'en-US'
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showScheduler, setShowScheduler] = useState(false)

  // Sidebar state
  const [addClassCount, setAddClassCount] = useState(1)
  const [showAddClasses, setShowAddClasses] = useState(false)
  // Billing-tab "manual add classes" input — kept independent from the Overview
  // sidebar input so editing one never clobbers the other (ADMIN-07).
  const [manualAddCount, setManualAddCount] = useState(1)

  // Overview tab state
  const [selectedLevel, setSelectedLevel] = useState(student.level || '')
  const [selectedTeacher, setSelectedTeacher] = useState(student.primary_teacher_id || '')
  const [adminNotes, setAdminNotes] = useState(student.admin_notes || '')

  // Profile tab state
  const [profileForm, setProfileForm] = useState({
    full_name: student.profile?.full_name || '',
    timezone: student.profile?.timezone || '',
    preferred_language: '',
    learning_goal: student.learning_goal || '',
    work_description: student.work_description || '',
    learning_style: student.learning_style || '',
    age_range: student.age_range || '',
  })

  // Admin tools state
  const [selectedRole, setSelectedRole] = useState(student.profile?.role || 'student')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelConfirmBookingId, setCancelConfirmBookingId] = useState<string | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Coerce a number-input value to a valid class count: an integer in [1,100].
  // A cleared field (Number('') === 0) or garbage (NaN) falls back to 1, so the
  // toast and the server call never use a stale/0 value (ADMIN-07). Matches the
  // 1..100 bounds enforced server-side in addStudentClasses.
  const clampClassCount = (v: string) => Math.max(1, Math.min(100, Math.trunc(Number(v)) || 1))

  function run(fn: () => Promise<void>, successMsg: string) {
    startTransition(async () => {
      try {
        await fn()
        showToast(successMsg)
        router.refresh()
      } catch {
        // Thrown server-action messages are redacted in prod → show friendly generic.
        showToast(t.genericError, 'error')
      }
    })
  }

  const completedCount = student.bookings.filter((b) => b.status === 'completed' && b.type === 'class').length
  const upcomingCount = student.bookings.filter((b) => (b.status === 'confirmed' || b.status === 'pending') && b.type === 'class').length
  const initials = (student.profile?.full_name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    padding: '20px',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#9CA3AF',
    marginBottom: '6px',
    display: 'block',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: '13px',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    background: '#F9FAFB',
    color: '#111',
    outline: 'none',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '8px',
    background: '#C41E3A',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    border: 'none',
    cursor: isPending ? 'not-allowed' : 'pointer',
    opacity: isPending ? 0.7 : 1,
  }

  const btnSecondary: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: '8px',
    background: '#F3F4F6',
    color: '#374151',
    fontSize: '13px',
    fontWeight: 500,
    border: '1px solid #E5E7EB',
    cursor: isPending ? 'not-allowed' : 'pointer',
    opacity: isPending ? 0.7 : 1,
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  function renderSidebar() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Avatar + name */}
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#C41E3A',
              color: '#fff',
              fontSize: '22px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            {initials}
          </div>
          <p style={{ fontWeight: 700, fontSize: '16px', color: '#111', margin: 0 }}>
            {student.profile?.full_name || t.unknown}
          </p>
          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: 2 }}>
            {student.profile?.email || t.dash}
          </p>
          <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: 6 }}>
            {t.memberSince} {new Date(student.created_at).toLocaleDateString(dateLocale, { timeZone: 'America/Tegucigalpa', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Stats */}
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: t.completed, value: completedCount },
              { label: t.classesLeft, value: student.classes_remaining, red: student.classes_remaining === 0 },
            ].map((stat) => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '22px', fontWeight: 800, color: stat.red ? '#C41E3A' : '#111', margin: 0 }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Primary teacher (continuity hint — admin sets manually) */}
        <div style={cardStyle}>
          <span style={labelStyle}>{t.primaryTeacher}</span>
          <p style={{ fontSize: '13px', color: student.primary_teacher_name ? '#111' : '#9CA3AF', margin: '0 0 4px' }}>
            {student.primary_teacher_name || t.unassigned}
          </p>
          <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 10px' }}>
            {t.primaryTeacherHint}
          </p>
          {student.teachers.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="">{t.unassigned}</option>
                {student.teachers.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.accepting || opt.id === student.primary_teacher_id ? opt.name : `⏸ ${opt.name} (${t.paused})`}
                  </option>
                ))}
              </select>
              <button
                style={btnSecondary}
                disabled={isPending || selectedTeacher === (student.primary_teacher_id || '')}
                onClick={() => run(
                  () => setPrimaryTeacher(student.id, selectedTeacher || null),
                  t.primaryTeacherUpdated
                )}
              >
                {t.save}
              </button>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={cardStyle}>
          <span style={labelStyle}>{t.quickActions}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button style={btnSecondary} onClick={() => setShowScheduler(true)}>
              {t.scheduleCall}
            </button>
            {student.profile?.email && (
              <a
                href={`mailto:${student.profile.email}`}
                style={{ ...btnSecondary, textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                {t.sendEmail}
              </a>
            )}
            {!showAddClasses ? (
              <button style={btnSecondary} onClick={() => setShowAddClasses(true)}>
                {t.addClasses}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={addClassCount}
                  onChange={(e) => setAddClassCount(clampClassCount(e.target.value))}
                  style={{ ...inputStyle, width: 60, flex: '0 0 60px' }}
                />
                <button
                  style={btnPrimary}
                  disabled={isPending}
                  onClick={() => {
                    run(() => addStudentClasses(student.id, addClassCount), t.classesAdded(addClassCount))
                    setShowAddClasses(false)
                  }}
                >
                  {t.confirm}
                </button>
                <button style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 13 }} onClick={() => setShowAddClasses(false)}>
                  {t.cancel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: Overview ──────────────────────────────────────────────────────────
  function renderOverview() {
    const lc = LEVEL_COLORS[selectedLevel] || { bg: 'rgba(156,163,175,0.1)', color: '#6B7280' }
    const totalPaidApprox = completedCount * 25

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: t.classesRemaining, value: student.classes_remaining, red: student.classes_remaining === 0 },
            { label: t.completedClasses, value: completedCount },
            { label: t.upcomingClasses, value: upcomingCount },
            { label: t.estTotalPaid, value: `$${totalPaidApprox}` },
          ].map((c) => (
            <div key={c.label} style={cardStyle}>
              <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                {c.label}
              </p>
              <p style={{ fontSize: '26px', fontWeight: 800, color: (c as { red?: boolean }).red ? '#C41E3A' : '#111', margin: 0 }}>
                {c.value}
              </p>
            </div>
          ))}
        </div>

        {/* Level + Teacher row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* CEFR Level */}
          <div style={cardStyle}>
            <span style={labelStyle}>{t.cefrLevel}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="">{t.notSet}</option>
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <button
                style={btnSecondary}
                disabled={isPending}
                onClick={() => run(() => updateStudentLevel(student.id, selectedLevel), t.levelUpdated)}
              >
                {t.save}
              </button>
              {selectedLevel && (
                <span
                  style={{ background: lc.bg, color: lc.color, padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {selectedLevel}
                </span>
              )}
            </div>
          </div>

          {/* Assigned Teacher */}
          <div style={cardStyle}>
            <span style={labelStyle}>{t.assignedTeacher}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="">{t.unassigned}</option>
                {student.teachers.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.accepting || opt.id === student.primary_teacher_id ? opt.name : `⏸ ${opt.name} (${t.paused})`}
                  </option>
                ))}
              </select>
              <button
                style={btnSecondary}
                disabled={!selectedTeacher || isPending}
                onClick={() => run(() => setPrimaryTeacher(student.id, selectedTeacher || null), t.primaryTeacherUpdated)}
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>

        {/* Admin notes */}
        <div style={cardStyle}>
          <span style={labelStyle}>{t.adminNotes}</span>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            onBlur={() => run(() => saveAdminNotes(student.id, adminNotes), t.notesSaved)}
            placeholder={t.adminNotesPlaceholder}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: 4 }}>{t.autoSaves}</p>
        </div>
      </div>
    )
  }

  // ── Tab: Classes ───────────────────────────────────────────────────────────
  function renderClasses() {
    const classBookings = student.bookings.filter((b) => b.type === 'class' || b.type === 'placement_test')

    return (
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {[t.classHeaders.date, t.classHeaders.type, t.classHeaders.teacher, t.classHeaders.status, t.classHeaders.duration, t.classHeaders.actions].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '10px 14px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#6B7280',
                      borderBottom: '1px solid #E5E7EB',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 14px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    {t.noClassBookings}
                  </td>
                </tr>
              ) : classBookings.map((b) => {
                const ss = STATUS_STYLES[b.status] || STATUS_STYLES['pending']
                const statusLabel = t.statusLabels[b.status] || b.status
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                      {new Date(b.scheduled_at).toLocaleDateString(dateLocale, { timeZone: 'America/Tegucigalpa', month: 'short', day: 'numeric', year: 'numeric' })}
                      {' '}
                      <span style={{ color: '#9CA3AF', fontSize: 12 }}>
                        {new Date(b.scheduled_at).toLocaleTimeString(dateLocale, { timeZone: 'America/Tegucigalpa', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>
                      {t.typeLabels[b.type] || b.type}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: b.teacherName ? '#374151' : '#9CA3AF' }}>
                      {b.teacherName || t.unassigned}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: ss.bg, color: ss.color, padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {b.duration_minutes ? `${b.duration_minutes} ${t.min}` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {b.status === 'confirmed' && (
                          <button
                            onClick={() => run(() => completeBooking(b.id), t.bookingMarkedComplete)}
                            disabled={isPending}
                            style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', color: '#059669', border: '1px solid rgba(52,211,153,0.3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {t.complete}
                          </button>
                        )}
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <button
                            onClick={() => setCancelConfirmBookingId(b.id)}
                            disabled={isPending}
                            style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(196,30,58,0.08)', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {t.cancelBtn}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Cancel confirmation modal */}
        {cancelConfirmBookingId && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => setCancelConfirmBookingId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 380, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 10px' }}>{t.cancelBookingTitle}</h3>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>
                {t.cancelBookingBody}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => setCancelConfirmBookingId(null)}>{t.keepBooking}</button>
                <button
                  style={btnPrimary}
                  onClick={() => {
                    const id = cancelConfirmBookingId
                    setCancelConfirmBookingId(null)
                    run(() => cancelBookingWithRefund(id), t.bookingCancelled)
                  }}
                >
                  {t.yesCancel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Tab: Payments ──────────────────────────────────────────────────────────
  function renderPayments() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={cardStyle}>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            {t.paymentsSoon}
          </p>
        </div>

        {/* Manual add classes */}
        <div style={cardStyle}>
          <span style={labelStyle}>{t.addClassesManually}</span>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 12px' }}>{t.addClassesManuallyHint}</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              max={100}
              value={manualAddCount}
              onChange={(e) => setManualAddCount(clampClassCount(e.target.value))}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ fontSize: 13, color: '#6B7280' }}>{t.classWord(manualAddCount)}</span>
            <button
              style={btnPrimary}
              disabled={isPending}
              onClick={() => run(() => addStudentClasses(student.id, manualAddCount), t.classesAdded(manualAddCount))}
            >
              {t.add}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: Profile & Preferences ─────────────────────────────────────────────
  function renderProfileTab() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>{t.basicInformation}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { key: 'full_name', label: t.fullName },
              { key: 'timezone', label: t.timezone },
              { key: 'preferred_language', label: t.preferredLanguage },
            ].map(({ key, label }) => (
              <div key={key}>
                <span style={labelStyle}>{label}</span>
                <input
                  type="text"
                  value={profileForm[key as keyof typeof profileForm]}
                  onChange={(e) => setProfileForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div>
              <span style={labelStyle}>{t.email}</span>
              <input
                type="email"
                value={student.profile?.email || ''}
                readOnly
                style={{ ...inputStyle, background: '#F3F4F6', color: '#6B7280' }}
              />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>{t.intakeInformation}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { key: 'learning_goal', label: t.learningGoal },
              { key: 'work_description', label: t.workDescription },
              { key: 'learning_style', label: t.learningStyle },
              { key: 'age_range', label: t.ageRange },
            ].map(({ key, label }) => (
              <div key={key}>
                <span style={labelStyle}>{label}</span>
                <input
                  type="text"
                  value={profileForm[key as keyof typeof profileForm]}
                  onChange={(e) => setProfileForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>

        {student.survey_answers && Object.keys(student.survey_answers).length > 0 && (
          <div style={cardStyle}>
            <details>
              <summary style={{ fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', padding: '4px 0' }}>
                {t.surveyAnswers}
              </summary>
              <pre
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: '#F9FAFB',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#374151',
                  overflowX: 'auto',
                  border: '1px solid #E5E7EB',
                }}
              >
                {JSON.stringify(student.survey_answers, null, 2)}
              </pre>
            </details>
          </div>
        )}

        <div>
          <button
            style={btnPrimary}
            disabled={isPending}
            onClick={() =>
              run(
                () =>
                  adminUpdateStudentProfile(student.profile?.id || '', student.id, {
                    full_name: profileForm.full_name,
                    timezone: profileForm.timezone,
                    preferred_language: profileForm.preferred_language,
                    learning_goal: profileForm.learning_goal,
                    work_description: profileForm.work_description,
                    learning_style: profileForm.learning_style,
                    age_range: profileForm.age_range,
                  }),
                t.profileSaved
              )
            }
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
        {/* Reset password */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>{t.passwordReset}</h3>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
            {t.passwordResetHint(student.profile?.email || t.thisStudent)}
          </p>
          <button
            style={btnPrimary}
            disabled={isPending || !student.profile?.email}
            onClick={() =>
              run(
                () => resetStudentPassword(student.profile!.email!),
                t.resetEmailSent
              )
            }
          >
            {t.sendResetEmail}
          </button>
        </div>

        {/* Change role */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>{t.changeRole}</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{ ...inputStyle, maxWidth: 200 }}
            >
              <option value="student">{t.roleStudent}</option>
              <option value="teacher">{t.roleTeacher}</option>
              <option value="admin">{t.roleAdmin}</option>
            </select>
            <button
              style={btnPrimary}
              disabled={isPending}
              onClick={() => run(() => updateStudentRole(student.profile?.id || '', selectedRole), t.roleUpdated)}
            >
              {t.saveRole}
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ ...cardStyle, border: '1px solid rgba(196,30,58,0.3)', background: 'rgba(196,30,58,0.02)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#C41E3A', margin: '0 0 8px' }}>{t.dangerZone}</h3>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
            {t.dangerZoneHint}
          </p>
          {!showCancelConfirm ? (
            <button
              style={{ ...btnPrimary, background: '#fff', color: '#C41E3A', border: '1px solid #C41E3A' }}
              onClick={() => setShowCancelConfirm(true)}
            >
              {t.deactivateAccount}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#374151' }}>{t.areYouSure}</span>
              <button
                style={btnPrimary}
                onClick={() => {
                  setShowCancelConfirm(false)
                  run(() => setStudentDeactivated(student.profile?.id || '', true), t.accountDeactivated)
                }}
              >
                {t.yesDeactivate}
              </button>
              <button style={btnSecondary} onClick={() => setShowCancelConfirm(false)}>
                {t.cancel}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {showScheduler && (
        <MeetingScheduler
          type="student_call"
          studentId={student.id}
          studentName={student.profile?.full_name || ''}
          allStudents={[{ id: student.id, name: student.profile?.full_name || '', email: student.profile?.email || '' }]}
          allTeachers={student.teachers.map(t => ({ id: t.id, name: t.name, accepting: t.accepting }))}
          existingBookings={student.bookings.map(b => ({ scheduled_at: b.scheduled_at, teacher_id: b.teacher_id, student_id: student.id }))}
          onClose={() => setShowScheduler(false)}
          onSuccess={() => { setShowScheduler(false); router.refresh() }}
          lang={lang}
        />
      )}

      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => router.push(`/${lang}/admin/students`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
        >
          {t.backToStudents}
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Left: tabs (70%) */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          {/* Tab navigation */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              background: '#F3F4F6',
              borderRadius: 10,
              padding: 4,
              marginBottom: 20,
              overflowX: 'auto',
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeTab === tab ? 600 : 400,
                  background: activeTab === tab ? '#fff' : 'transparent',
                  color: activeTab === tab ? '#111' : '#6B7280',
                  boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {t.tabLabels[tab]}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'Overview' && renderOverview()}
          {activeTab === 'Classes' && renderClasses()}
          {activeTab === 'Payments' && renderPayments()}
          {activeTab === 'Profile & Preferences' && renderProfileTab()}
          {activeTab === 'Admin Tools' && renderAdminTools()}
        </div>

        {/* Right: sidebar (30%) */}
        <div style={{ width: '300px', flexShrink: 0 }}>
          {renderSidebar()}
        </div>
      </div>
    </>
  )
}
