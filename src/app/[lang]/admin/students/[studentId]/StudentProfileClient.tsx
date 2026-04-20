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

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'rgba(251,191,36,0.15)', color: '#B45309', label: 'Pending' },
  confirmed: { bg: 'rgba(59,130,246,0.15)', color: '#1D4ED8', label: 'Confirmed' },
  completed: { bg: 'rgba(52,211,153,0.15)', color: '#059669', label: 'Completed' },
  cancelled: { bg: 'rgba(156,163,175,0.15)', color: '#6B7280', label: 'Cancelled' },
}

const TABS = ['Overview', 'Classes', 'Payments', 'Profile & Preferences', 'Admin Tools'] as const
type Tab = typeof TABS[number]

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
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showScheduler, setShowScheduler] = useState(false)

  // Sidebar state
  const [addClassCount, setAddClassCount] = useState(1)
  const [showAddClasses, setShowAddClasses] = useState(false)

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

  function run(fn: () => Promise<void>, successMsg: string) {
    startTransition(async () => {
      try {
        await fn()
        showToast(successMsg)
        router.refresh()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'An error occurred', 'error')
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
            {student.profile?.full_name || 'Unknown'}
          </p>
          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: 2 }}>
            {student.profile?.email || '—'}
          </p>
          <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: 6 }}>
            Member since {new Date(student.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Stats */}
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Completed', value: completedCount },
              { label: 'Classes Left', value: student.classes_remaining, red: student.classes_remaining === 0 },
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
          <span style={labelStyle}>Primary Teacher</span>
          <p style={{ fontSize: '13px', color: student.primary_teacher_name ? '#111' : '#9CA3AF', margin: '0 0 4px' }}>
            {student.primary_teacher_name || 'Unassigned'}
          </p>
          <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 10px' }}>
            Student&apos;s usual teacher. Reference only — each booking is still assigned manually.
          </p>
          {student.teachers.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="">Unassigned</option>
                {student.teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                style={btnSecondary}
                disabled={isPending || selectedTeacher === (student.primary_teacher_id || '')}
                onClick={() => run(
                  () => setPrimaryTeacher(student.id, selectedTeacher || null),
                  'Primary teacher updated'
                )}
              >
                Save
              </button>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={cardStyle}>
          <span style={labelStyle}>Quick Actions</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button style={btnSecondary} onClick={() => setShowScheduler(true)}>
              Schedule a call
            </button>
            {student.profile?.email && (
              <a
                href={`mailto:${student.profile.email}`}
                style={{ ...btnSecondary, textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                Send email
              </a>
            )}
            {!showAddClasses ? (
              <button style={btnSecondary} onClick={() => setShowAddClasses(true)}>
                Add classes
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={addClassCount}
                  onChange={(e) => setAddClassCount(Number(e.target.value))}
                  style={{ ...inputStyle, width: 60, flex: '0 0 60px' }}
                />
                <button
                  style={btnPrimary}
                  disabled={isPending}
                  onClick={() => {
                    run(() => addStudentClasses(student.id, addClassCount), `${addClassCount} class${addClassCount > 1 ? 'es' : ''} added`)
                    setShowAddClasses(false)
                  }}
                >
                  Confirm
                </button>
                <button style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 13 }} onClick={() => setShowAddClasses(false)}>
                  Cancel
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
            { label: 'Classes Remaining', value: student.classes_remaining, red: student.classes_remaining === 0 },
            { label: 'Completed Classes', value: completedCount },
            { label: 'Upcoming Classes', value: upcomingCount },
            { label: 'Est. Total Paid', value: `$${totalPaidApprox}` },
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
            <span style={labelStyle}>CEFR Level</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={selectedLevel}
                onChange={(e) => {
                  setSelectedLevel(e.target.value)
                  run(() => updateStudentLevel(student.id, e.target.value), 'Level updated')
                }}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="">Not set</option>
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
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
            <span style={labelStyle}>Assigned Teacher</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="">Unassigned</option>
                {student.teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                style={btnSecondary}
                disabled={!selectedTeacher || isPending}
                onClick={() => run(() => setPrimaryTeacher(student.id, selectedTeacher || null), 'Primary teacher updated')}
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Admin notes */}
        <div style={cardStyle}>
          <span style={labelStyle}>Admin Notes</span>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            onBlur={() => run(() => saveAdminNotes(student.id, adminNotes), 'Notes saved')}
            placeholder="Internal notes about this student..."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: 4 }}>Auto-saves on blur</p>
        </div>
      </div>
    )
  }

  // ── Tab: Classes ───────────────────────────────────────────────────────────
  function renderClasses() {
    const classBookings = student.bookings.filter((b) => b.type === 'class' || b.type === 'placement')

    return (
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Date', 'Type', 'Teacher', 'Status', 'Duration', 'Actions'].map((h) => (
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
                    No class bookings yet.
                  </td>
                </tr>
              ) : classBookings.map((b) => {
                const ss = STATUS_STYLES[b.status] || STATUS_STYLES['pending']
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                      {new Date(b.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' '}
                      <span style={{ color: '#9CA3AF', fontSize: 12 }}>
                        {new Date(b.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>
                      {b.type}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: b.teacherName ? '#374151' : '#9CA3AF' }}>
                      {b.teacherName || 'Unassigned'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: ss.bg, color: ss.color, padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {ss.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {b.duration_minutes ? `${b.duration_minutes} min` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {b.status === 'confirmed' && (
                          <button
                            onClick={() => run(() => completeBooking(b.id), 'Booking marked complete')}
                            disabled={isPending}
                            style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', color: '#059669', border: '1px solid rgba(52,211,153,0.3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Complete
                          </button>
                        )}
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <button
                            onClick={() => setCancelConfirmBookingId(b.id)}
                            disabled={isPending}
                            style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(196,30,58,0.08)', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Cancel
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
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 10px' }}>Cancel this booking?</h3>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>
                If this is a class booking, 1 class credit will be returned to the student.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => setCancelConfirmBookingId(null)}>Keep booking</button>
                <button
                  style={btnPrimary}
                  onClick={() => {
                    const id = cancelConfirmBookingId
                    setCancelConfirmBookingId(null)
                    run(() => cancelBookingWithRefund(id), 'Booking cancelled')
                  }}
                >
                  Yes, cancel
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
            Payment tracking coming soon. Purchase history will appear here once the payments integration is connected.
          </p>
        </div>

        {/* Manual add classes */}
        <div style={cardStyle}>
          <span style={labelStyle}>Add Classes Manually</span>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 12px' }}>Use this to credit classes without a payment transaction.</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              max={100}
              value={addClassCount}
              onChange={(e) => setAddClassCount(Number(e.target.value))}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ fontSize: 13, color: '#6B7280' }}>class{addClassCount !== 1 ? 'es' : ''}</span>
            <button
              style={btnPrimary}
              disabled={isPending}
              onClick={() => run(() => addStudentClasses(student.id, addClassCount), `${addClassCount} class${addClassCount > 1 ? 'es' : ''} added`)}
            >
              Add
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
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>Basic Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { key: 'full_name', label: 'Full Name' },
              { key: 'timezone', label: 'Timezone' },
              { key: 'preferred_language', label: 'Preferred Language' },
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
              <span style={labelStyle}>Email</span>
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
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>Intake Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { key: 'learning_goal', label: 'Learning Goal' },
              { key: 'work_description', label: 'Work Description' },
              { key: 'learning_style', label: 'Learning Style' },
              { key: 'age_range', label: 'Age Range' },
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
                Survey Answers
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
                'Profile saved'
              )
            }
          >
            Save Profile
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
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>Password Reset</h3>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
            Send a password reset link to {student.profile?.email || 'this student'}.
          </p>
          <button
            style={btnPrimary}
            disabled={isPending || !student.profile?.email}
            onClick={() =>
              run(
                () => resetStudentPassword(student.profile!.email!),
                'Reset email sent'
              )
            }
          >
            Send reset email
          </button>
        </div>

        {/* Change role */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>Change Role</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{ ...inputStyle, maxWidth: 200 }}
            >
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="admin">admin</option>
            </select>
            <button
              style={btnPrimary}
              disabled={isPending}
              onClick={() => run(() => updateStudentRole(student.profile?.id || '', selectedRole), 'Role updated')}
            >
              Save role
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ ...cardStyle, border: '1px solid rgba(196,30,58,0.3)', background: 'rgba(196,30,58,0.02)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#C41E3A', margin: '0 0 8px' }}>Danger Zone</h3>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
            This action will deactivate access for this student. Use with caution.
          </p>
          {!showCancelConfirm ? (
            <button
              style={{ ...btnPrimary, background: '#fff', color: '#C41E3A', border: '1px solid #C41E3A' }}
              onClick={() => setShowCancelConfirm(true)}
            >
              Deactivate account
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#374151' }}>Are you sure?</span>
              <button
                style={btnPrimary}
                onClick={() => {
                  setShowCancelConfirm(false)
                  run(() => updateStudentRole(student.profile?.id || '', 'deactivated'), 'Account deactivated')
                }}
              >
                Yes, deactivate
              </button>
              <button style={btnSecondary} onClick={() => setShowCancelConfirm(false)}>
                Cancel
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
          allTeachers={student.teachers.map(t => ({ id: t.id, name: t.name }))}
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
          ← Back to Students
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
                {tab}
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
