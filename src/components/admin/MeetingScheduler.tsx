'use client'

import { useState, useTransition } from 'react'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { createAdminBooking } from '@/app/[lang]/admin/actions'

export interface ExistingBooking {
  scheduled_at: string
  teacher_id: string | null
  student_id: string
}

export interface Props {
  type: 'student_call' | 'teacher_call' | 'class'
  studentId?: string
  teacherId?: string
  studentName?: string
  teacherName?: string
  allStudents: { id: string; name: string; email: string }[]
  allTeachers: { id: string; name: string }[]
  existingBookings: ExistingBooking[]
  onClose: () => void
  onSuccess: () => void
  lang: string
}

type MeetingType = 'placement_test' | 'class' | 'teacher_interview' | 'admin_checkin'

const MEETING_TYPES: { value: MeetingType; label: string; description: string }[] = [
  { value: 'placement_test', label: 'Diagnostic call', description: 'Evaluate student level' },
  { value: 'class', label: 'Regular class', description: 'Standard tutoring session' },
  { value: 'teacher_interview', label: 'Teacher interview', description: 'Onboarding interview' },
  { value: 'admin_checkin', label: 'Admin check-in', description: 'Internal review call' },
]

const DURATIONS = [30, 45, 60, 90]

const HONDURAS_OFFSET = -6 // UTC-6

function getHondurasMidnight(date: Date): Date {
  // Get midnight in Honduras time (UTC-6) as a UTC timestamp
  const utcY = date.getUTCFullYear()
  const utcM = date.getUTCMonth()
  const utcD = date.getUTCDate()
  // midnight UTC-6 = 06:00 UTC
  return new Date(Date.UTC(utcY, utcM, utcD, -HONDURAS_OFFSET, 0, 0, 0))
}

function getNext14BusinessDays(): Date[] {
  const days: Date[] = []
  const now = new Date()
  let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  while (days.length < 14) {
    const dayOfWeek = d.getUTCDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(new Date(d))
    }
    d = new Date(d.getTime() + 86400000)
  }
  return days
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function slotToUTC(day: Date, hour: number): Date {
  // day is UTC midnight, hour is Honduras local hour (UTC-6)
  return new Date(day.getTime() + (hour - HONDURAS_OFFSET) * 3600000)
}

function isSlotTaken(
  slotUTC: Date,
  durationMin: number,
  selectedStudentId: string | null,
  selectedTeacherId: string | null,
  existingBookings: ExistingBooking[]
): boolean {
  const slotEnd = new Date(slotUTC.getTime() + durationMin * 60000)
  for (const b of existingBookings) {
    const bStart = new Date(b.scheduled_at)
    const bEnd = new Date(bStart.getTime() + 60 * 60000) // assume 60 min for conflict check
    const overlaps = slotUTC < bEnd && slotEnd > bStart
    if (!overlaps) continue
    if (selectedTeacherId && b.teacher_id === selectedTeacherId) return true
    if (selectedStudentId && b.student_id === selectedStudentId) return true
  }
  return false
}

export default function MeetingScheduler({
  type,
  studentId,
  teacherId,
  studentName,
  teacherName,
  allStudents,
  allTeachers,
  existingBookings,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Step 1
  const [selStudentId, setSelStudentId] = useState(studentId || (allStudents[0]?.id ?? ''))
  const [selTeacherId, setSelTeacherId] = useState(teacherId || '')

  // Step 2
  const days = getNext14BusinessDays()
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  // Step 3
  const [meetingType, setMeetingType] = useState<MeetingType>('class')
  const [duration, setDuration] = useState(60)

  // Step 4
  const [notes, setNotes] = useState('')

  const selectedDay = days[selectedDayIdx]

  const hours = Array.from({ length: 17 }, (_, i) => i + 6) // 6AM to 10PM

  function getSlotUTC(hour: number) {
    return slotToUTC(selectedDay, hour)
  }

  function isTaken(hour: number) {
    return isSlotTaken(getSlotUTC(hour), duration, selStudentId || null, selTeacherId || null, existingBookings)
  }

  const studentLabel = type === 'teacher_call'
    ? (studentName ? `Student: ${studentName}` : null)
    : null

  const teacherLabel = type === 'student_call'
    ? (teacherName ? `Teacher: ${teacherName}` : null)
    : null

  function buildScheduledAt(): string {
    if (!selectedDay || selectedHour === null) return ''
    const utc = getSlotUTC(selectedHour)
    return utc.toISOString()
  }

  function canGoNext() {
    if (step === 1) {
      if (!selStudentId) return false
      return true
    }
    if (step === 2) return selectedHour !== null
    if (step === 3) return true
    return true
  }

  function handleSubmit() {
    setError('')
    const scheduledAt = buildScheduledAt()
    if (!scheduledAt) { setError('No time selected'); return }
    if (!selStudentId) { setError('Select a student'); return }

    startTransition(async () => {
      try {
        await createAdminBooking(
          selStudentId,
          selTeacherId || null,
          scheduledAt,
          meetingType,
          duration,
          notes
        )
        onSuccess()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error creating booking')
      }
    })
  }

  const stepLabels = ['Participants', 'Date & Time', 'Meeting Type', 'Confirm']

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: 0 }}>Schedule a Meeting</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div style={{ padding: '16px 24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {stepLabels.map((label, i) => {
            const stepNum = i + 1
            const isActive = stepNum === step
            const isDone = stepNum < step
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: stepNum < 4 ? '1' : 'none' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: isDone ? '#059669' : isActive ? '#C41E3A' : '#E5E7EB',
                  color: isDone || isActive ? '#fff' : '#6B7280',
                }}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : stepNum}
                </div>
                <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#111' : '#6B7280', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
                {stepNum < 4 && <div style={{ flex: 1, height: 1, background: '#E5E7EB', marginLeft: 8 }} />}
              </div>
            )
          })}
        </div>

        {/* Step content */}
        <div style={{ padding: '8px 24px 24px' }}>
          {/* Step 1 — Participants */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {type === 'teacher_call' && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Teacher (pre-filled)
                  </p>
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F3F4F6', fontSize: 14, color: '#374151', fontWeight: 500 }}>
                    {teacherName || 'Selected teacher'}
                  </div>
                </div>
              )}
              {type === 'student_call' && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Student (pre-filled)
                  </p>
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F3F4F6', fontSize: 14, color: '#374151', fontWeight: 500 }}>
                    {studentLabel || studentName || 'Selected student'}
                  </div>
                </div>
              )}

              {/* Student selector (for teacher_call or class) */}
              {(type === 'teacher_call' || type === 'class') && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Select Student *
                  </p>
                  <select
                    value={selStudentId}
                    onChange={e => setSelStudentId(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 14, color: '#111', background: '#fff', outline: 'none' }}
                  >
                    <option value="">— Select student —</option>
                    {allStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
                  </select>
                </div>
              )}

              {/* Teacher selector (for student_call or class) */}
              {(type === 'student_call' || type === 'class') && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    {type === 'student_call' ? 'Select Teacher (optional)' : 'Select Teacher *'}
                  </p>
                  {type === 'student_call' && teacherLabel ? (
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F3F4F6', fontSize: 14, color: '#374151', fontWeight: 500 }}>
                      {teacherLabel}
                    </div>
                  ) : (
                    <select
                      value={selTeacherId}
                      onChange={e => setSelTeacherId(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 14, color: '#111', background: '#fff', outline: 'none' }}
                    >
                      <option value="">— Unassigned —</option>
                      {allTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Date & Time */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Day selector */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Select Day
                </p>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {days.map((d, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setSelectedDayIdx(idx); setSelectedHour(null) }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid',
                        borderColor: selectedDayIdx === idx ? '#C41E3A' : '#E5E7EB',
                        background: selectedDayIdx === idx ? '#C41E3A' : '#fff',
                        color: selectedDayIdx === idx ? '#fff' : '#374151',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {formatDayLabel(d)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Select Time (Honduras, UTC-6)
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {hours.map(h => {
                    const taken = isTaken(h)
                    const isSelected = selectedHour === h
                    const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`
                    return (
                      <button
                        key={h}
                        disabled={taken}
                        onClick={() => setSelectedHour(h)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 8,
                          border: '1px solid',
                          borderColor: isSelected ? '#C41E3A' : taken ? '#F3F4F6' : '#E5E7EB',
                          background: isSelected ? '#C41E3A' : taken ? '#F9FAFB' : '#fff',
                          color: isSelected ? '#fff' : taken ? '#D1D5DB' : '#374151',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: taken ? 'not-allowed' : 'pointer',
                          textDecoration: taken ? 'line-through' : 'none',
                          transition: 'all 0.15s',
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Meeting Type */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Meeting Type
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {MEETING_TYPES.map(mt => (
                    <label
                      key={mt.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: '1px solid',
                        borderColor: meetingType === mt.value ? '#C41E3A' : '#E5E7EB',
                        background: meetingType === mt.value ? 'rgba(196,30,58,0.04)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="radio"
                        name="meetingType"
                        value={mt.value}
                        checked={meetingType === mt.value}
                        onChange={() => setMeetingType(mt.value)}
                        style={{ accentColor: '#C41E3A' }}
                      />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: 0 }}>{mt.label}</p>
                        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{mt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Duration
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DURATIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid',
                        borderColor: duration === d ? '#C41E3A' : '#E5E7EB',
                        background: duration === d ? '#C41E3A' : '#fff',
                        color: duration === d ? '#fff' : '#374151',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Confirm */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Summary card */}
              <div style={{ padding: '16px', borderRadius: 12, background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: '0 0 12px' }}>Meeting Summary</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Student', value: allStudents.find(s => s.id === selStudentId)?.name || 'Not selected' },
                    { label: 'Teacher', value: selTeacherId ? (allTeachers.find(t => t.id === selTeacherId)?.name || 'Unknown') : 'Unassigned' },
                    { label: 'Date', value: selectedDay ? formatDayLabel(selectedDay) : '—' },
                    { label: 'Time', value: selectedHour !== null ? (selectedHour < 12 ? `${selectedHour}:00 AM` : selectedHour === 12 ? '12:00 PM' : `${selectedHour - 12}:00 PM`) + ' (Honduras)' : '—' },
                    { label: 'Type', value: MEETING_TYPES.find(m => m.value === meetingType)?.label || meetingType },
                    { label: 'Duration', value: `${duration} minutes` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                      <span style={{ color: '#6B7280', width: 80, flexShrink: 0 }}>{label}:</span>
                      <span style={{ color: '#111', fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Notes (optional)
                </p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any notes for this meeting…"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    fontSize: 13,
                    color: '#111',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: '#C41E3A', margin: 0 }}>{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              background: '#fff',
              color: '#374151',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canGoNext()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: canGoNext() ? '#C41E3A' : '#E5E7EB',
                color: canGoNext() ? '#fff' : '#9CA3AF',
                fontSize: 13,
                fontWeight: 600,
                cursor: canGoNext() ? 'pointer' : 'not-allowed',
              }}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: isPending ? '#E5E7EB' : '#C41E3A',
                color: isPending ? '#9CA3AF' : '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Scheduling…' : 'Schedule meeting'}
              {!isPending && <Check className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
