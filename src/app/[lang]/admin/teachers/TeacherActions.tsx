'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import { approveTeacher, rejectTeacher, toggleTeacherActive } from '../actions'

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
