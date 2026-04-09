'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import { approveTeacher, rejectTeacher, toggleTeacherActive, setTeacherRate } from '../actions'

// ── Approve / Reject (for pending applications) ───────────────────────────────

export function ApproveRejectButtons({
  teacherId,
  profileId,
}: {
  teacherId: string
  profileId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState('')

  function handleApprove() {
    setError('')
    startTransition(async () => {
      try {
        await approveTeacher(teacherId)
        setDone('approved')
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleReject() {
    if (!confirm('Reject this application? The teacher record will be deleted and the user will revert to student.')) return
    setError('')
    startTransition(async () => {
      try {
        await rejectTeacher(teacherId, profileId)
        setDone('rejected')
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  if (done === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#059669' }}>
        <CheckCircle className="h-3.5 w-3.5" /> Approved
      </span>
    )
  }
  if (done === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#6B7280' }}>
        <XCircle className="h-3.5 w-3.5" /> Rejected
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px]" style={{ color: '#DC2626' }}>{error}</span>}
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-all disabled:opacity-50"
        style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}
        onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = 'rgba(5,150,105,0.2)' }}
        onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = 'rgba(5,150,105,0.1)' }}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        {isPending ? '…' : 'Approve'}
      </button>
      <button
        onClick={handleReject}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-all disabled:opacity-50"
        style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
        onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = 'rgba(220,38,38,0.16)' }}
        onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = 'rgba(220,38,38,0.08)' }}
      >
        <XCircle className="h-3.5 w-3.5" />
        Reject
      </button>
    </div>
  )
}

// ── Rate editor (for active teachers) ────────────────────────────────────────

export function RateEditor({
  teacherId,
  initialRate,
}: {
  teacherId: string
  initialRate: number
}) {
  const [isPending, startTransition] = useTransition()
  const [rate, setRate] = useState(String(initialRate || 0))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function handleSave() {
    const parsed = parseFloat(rate)
    if (isNaN(parsed) || parsed < 0) { setError('Invalid'); return }
    setError('')
    setSaved(false)
    startTransition(async () => {
      try {
        await setTeacherRate(teacherId, parsed)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: '#9CA3AF' }}>$</span>
        <input
          type="number"
          value={rate}
          onChange={e => { setRate(e.target.value); setSaved(false) }}
          min="0"
          className="w-20 rounded pl-5 pr-2 py-1 text-[12px] outline-none"
          style={{ border: '1px solid #E5E7EB', color: '#111111' }}
          onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
          onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
        />
      </div>
      <button
        onClick={handleSave}
        disabled={isPending}
        className="px-2 py-1 rounded text-[11px] font-semibold transition-all disabled:opacity-50"
        style={{
          background: saved ? 'rgba(5,150,105,0.1)' : 'rgba(196,30,58,0.08)',
          color: saved ? '#059669' : '#C41E3A',
        }}
      >
        {isPending ? '…' : saved ? '✓' : 'Save'}
      </button>
      {error && <span className="text-[11px]" style={{ color: '#DC2626' }}>{error}</span>}
    </div>
  )
}

// ── Toggle active / inactive (for active teachers) ────────────────────────────

export function ActiveToggle({
  teacherId,
  initialActive,
}: {
  teacherId: string
  initialActive: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [active, setActive] = useState(initialActive)
  const [error, setError] = useState('')

  function handleToggle() {
    const next = !active
    setError('')
    startTransition(async () => {
      try {
        await toggleTeacherActive(teacherId, next)
        setActive(next)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px]" style={{ color: '#DC2626' }}>{error}</span>}
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="flex items-center gap-1.5 text-[12px] font-medium transition-all disabled:opacity-50"
        style={{ color: active ? '#059669' : '#9CA3AF' }}
      >
        {active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
        {isPending ? '…' : active ? 'Active' : 'Inactive'}
      </button>
    </div>
  )
}
