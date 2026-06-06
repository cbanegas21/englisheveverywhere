'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import { approveTeacherWithEmail, rejectTeacherWithEmail, toggleTeacherActive, setTeacherRate } from '../actions'

type Lang = 'es' | 'en'

const STR = {
  en: {
    approved: 'Approved',
    rejected: 'Rejected',
    approve: 'Approve',
    reject: 'Reject',
    rejectConfirm: 'Reject this application? The teacher record will be deleted and the user will revert to student.',
    error: 'Error',
    invalid: 'Invalid',
    save: 'Save',
    active: 'Active',
    inactive: 'Inactive',
  },
  es: {
    approved: 'Aprobado',
    rejected: 'Rechazado',
    approve: 'Aprobar',
    reject: 'Rechazar',
    rejectConfirm: '¿Rechazar esta solicitud? El registro del maestro se eliminará y el usuario volverá a ser estudiante.',
    error: 'Error',
    invalid: 'Inválido',
    save: 'Guardar',
    active: 'Activo',
    inactive: 'Inactivo',
  },
} as const

// ── Approve / Reject (for pending applications) ───────────────────────────────

export function ApproveRejectButtons({
  teacherId,
  profileId,
  teacherName,
  teacherEmail,
  lang,
}: {
  teacherId: string
  profileId: string
  teacherName?: string
  teacherEmail?: string
  lang: Lang
}) {
  const t = STR[lang]
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState('')

  void teacherName
  void teacherEmail

  function handleApprove() {
    setError('')
    startTransition(async () => {
      try {
        await approveTeacherWithEmail(teacherId, profileId)
        setDone('approved')
      } catch (e) {
        setError(e instanceof Error ? e.message : t.error)
      }
    })
  }

  function handleReject() {
    if (!confirm(t.rejectConfirm)) return
    setError('')
    startTransition(async () => {
      try {
        await rejectTeacherWithEmail(teacherId, profileId)
        setDone('rejected')
      } catch (e) {
        setError(e instanceof Error ? e.message : t.error)
      }
    })
  }

  if (done === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--ek-text)' }}>
        <CheckCircle className="h-3.5 w-3.5" /> {t.approved}
      </span>
    )
  }
  if (done === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--ek-text-muted)' }}>
        <XCircle className="h-3.5 w-3.5" /> {t.rejected}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px]" style={{ color: 'var(--ek-red)' }}>{error}</span>}
      {/* Primary affirmative action reads in ink (solid), reject is the crimson
          destructive accent — no green/amber, per the editorial status rule. */}
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-all disabled:opacity-50"
        style={{ background: 'var(--ek-ink)', color: 'var(--ek-on-dark)', borderRadius: 'var(--ek-radius-sm)' }}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        {isPending ? '…' : t.approve}
      </button>
      <button
        onClick={handleReject}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-all disabled:opacity-50"
        style={{ background: 'var(--ek-card)', color: 'var(--ek-red)', border: '1px solid var(--ek-border-mid)', borderRadius: 'var(--ek-radius-sm)' }}
      >
        <XCircle className="h-3.5 w-3.5" />
        {t.reject}
      </button>
    </div>
  )
}

// ── Rate editor (for active teachers) ────────────────────────────────────────

export function RateEditor({
  teacherId,
  initialRate,
  lang,
}: {
  teacherId: string
  initialRate: number
  lang: Lang
}) {
  const t = STR[lang]
  const [isPending, startTransition] = useTransition()
  const [rate, setRate] = useState(String(initialRate || 0))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function handleSave() {
    const parsed = parseFloat(rate)
    if (isNaN(parsed) || parsed < 0) { setError(t.invalid); return }
    setError('')
    setSaved(false)
    startTransition(async () => {
      try {
        await setTeacherRate(teacherId, parsed)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (e) {
        setError(e instanceof Error ? e.message : t.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--ek-text-muted)' }}>$</span>
        <input
          type="number"
          value={rate}
          onChange={e => { setRate(e.target.value); setSaved(false) }}
          min="0"
          className="w-20 pl-5 pr-2 py-1 text-[12px] outline-none"
          style={{ border: '1px solid var(--ek-border-mid)', borderRadius: 'var(--ek-radius-sm)', background: 'var(--ek-card)', color: 'var(--ek-text)' }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--ek-red)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--ek-border-mid)')}
        />
      </div>
      <button
        onClick={handleSave}
        disabled={isPending}
        className="px-2 py-1 text-[11px] font-semibold transition-all disabled:opacity-50"
        style={{
          background: 'var(--ek-red-tint-2)',
          color: 'var(--ek-red)',
          borderRadius: 'var(--ek-radius-sm)',
        }}
      >
        {isPending ? '…' : saved ? '✓' : t.save}
      </button>
      {error && <span className="text-[11px]" style={{ color: 'var(--ek-red)' }}>{error}</span>}
    </div>
  )
}

// ── Toggle active / inactive (for active teachers) ────────────────────────────

export function ActiveToggle({
  teacherId,
  initialActive,
  lang,
}: {
  teacherId: string
  initialActive: boolean
  lang: Lang
}) {
  const t = STR[lang]
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
      } catch (e) {
        setError(e instanceof Error ? e.message : t.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px]" style={{ color: 'var(--ek-red)' }}>{error}</span>}
      {/* Active reads ink (the settled state), inactive reads muted — no green. */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="flex items-center gap-1.5 text-[12px] font-medium transition-all disabled:opacity-50"
        style={{ color: active ? 'var(--ek-text)' : 'var(--ek-text-muted)' }}
      >
        {active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
        {isPending ? '…' : active ? t.active : t.inactive}
      </button>
    </div>
  )
}
