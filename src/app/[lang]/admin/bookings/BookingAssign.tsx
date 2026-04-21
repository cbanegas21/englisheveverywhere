'use client'

import { useMemo, useState, useTransition } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { assignAndConfirmBooking, cancelBooking } from '../actions'
import { isTeacherAvailableClient, type AvailabilitySlot } from './availability'

interface Teacher {
  id: string
  name: string
}

interface Props {
  bookingId: string
  currentTeacherId: string | null
  teachers: Teacher[]
  // Optional — when provided, the dropdown annotates each teacher with an
  // availability dot so admins can avoid force-assigning off-hours.
  scheduledAt?: string
  durationMinutes?: number | null
  availSlots?: AvailabilitySlot[]
}

export default function BookingAssign({
  bookingId, currentTeacherId, teachers,
  scheduledAt, durationMinutes, availSlots,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [selectedTeacherId, setSelectedTeacherId] = useState(currentTeacherId || '')
  const [done, setDone] = useState<'confirmed' | 'cancelled' | null>(null)
  const [error, setError] = useState('')

  // Availability map — {teacherId: boolean}. Computed once per render of the
  // teachers + booking window. When availSlots/scheduledAt aren't supplied
  // we skip the hints entirely (back-compat with callers that don't pass them).
  const availabilityByTeacher = useMemo(() => {
    if (!availSlots || !scheduledAt) return null
    const map = new Map<string, boolean>()
    for (const t of teachers) {
      map.set(t.id, isTeacherAvailableClient(t.id, availSlots, scheduledAt, durationMinutes ?? 60))
    }
    return map
  }, [teachers, availSlots, scheduledAt, durationMinutes])

  function handleConfirm(force = false) {
    if (!selectedTeacherId) { setError('Select a teacher first'); return }
    setError('')
    startTransition(async () => {
      try {
        await assignAndConfirmBooking(bookingId, selectedTeacherId, { force })
        setDone('confirmed')
      } catch (e: any) {
        const msg: string = e.message || 'Something went wrong'
        const lower = msg.toLowerCase()
        // Guard prompts — admin can force-override availability OR primary-teacher continuity.
        const overridable = lower.includes('not available') || lower.includes('primary teacher')
        if (overridable && !force) {
          if (confirm(`${msg}\n\nAssign anyway?`)) {
            handleConfirm(true)
            return
          }
        }
        setError(msg)
      }
    })
  }

  function handleCancel() {
    if (!confirm('Cancel this booking?')) return
    setError('')
    startTransition(async () => {
      try {
        await cancelBooking(bookingId)
        setDone('cancelled')
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  if (done === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#059669' }}>
        <CheckCircle className="h-3.5 w-3.5" /> Confirmed
      </span>
    )
  }
  if (done === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#6B7280' }}>
        <XCircle className="h-3.5 w-3.5" /> Cancelled
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {error && <span className="text-[11px] w-full" style={{ color: '#DC2626' }}>{error}</span>}
      <select
        value={selectedTeacherId}
        onChange={e => setSelectedTeacherId(e.target.value)}
        disabled={isPending}
        className="rounded px-2 py-1.5 text-[12px] outline-none"
        style={{ border: '1px solid #E5E7EB', color: '#111111', background: '#fff', minWidth: '140px' }}
      >
        <option value="">Select teacher…</option>
        {teachers.map(t => {
          const ok = availabilityByTeacher?.get(t.id)
          const label = availabilityByTeacher == null
            ? t.name
            : ok ? `✓ ${t.name}` : `✗ ${t.name} (off-hours)`
          return <option key={t.id} value={t.id}>{label}</option>
        })}
      </select>
      <button
        onClick={() => handleConfirm(false)}
        disabled={isPending || !selectedTeacherId}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-all disabled:opacity-50"
        style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}
        onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = 'rgba(5,150,105,0.2)' }}
        onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = 'rgba(5,150,105,0.1)' }}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        {isPending ? '…' : 'Confirm'}
      </button>
      <button
        onClick={handleCancel}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] font-medium transition-all disabled:opacity-50"
        style={{ color: '#9CA3AF' }}
        onMouseEnter={e => { if (!isPending) { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.06)' }}}
        onMouseLeave={e => { if (!isPending) { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent' }}}
      >
        <XCircle className="h-3.5 w-3.5" />
        Cancel
      </button>
    </div>
  )
}
