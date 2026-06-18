'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import { approveTeacherWithEmail, rejectTeacherWithEmail, toggleTeacherActive, setTeacherRate } from '../actions'
import { Spinner } from '@/components/ui/Spinner'

type Lang = 'es' | 'en'

const STR = {
  en: {
    approved: 'Approved',
    rejected: 'Rejected',
    approve: 'Approve',
    approving: 'Approving…',
    reject: 'Reject',
    rejecting: 'Rejecting…',
    rejectConfirm: 'Reject this application? The teacher record will be deleted and the user will revert to student.',
    error: 'Error',
    noRate: 'Set the rate first',
    invalid: 'Invalid',
    save: 'Save',
    saving: 'Saving…',
    working: 'Working…',
    active: 'Active',
    inactive: 'Inactive',
  },
  es: {
    approved: 'Aprobado',
    rejected: 'Rechazado',
    approve: 'Aprobar',
    approving: 'Aprobando…',
    reject: 'Rechazar',
    rejecting: 'Rechazando…',
    rejectConfirm: '¿Rechazar esta solicitud? El registro del maestro se eliminará y el usuario volverá a ser estudiante.',
    error: 'Error',
    noRate: 'Asigna la tarifa primero',
    invalid: 'Inválido',
    save: 'Guardar',
    saving: 'Guardando…',
    working: 'Procesando…',
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
  // Which of the two actions is mid-flight. Both buttons stay disabled while either
  // runs (isPending), but only the clicked one shows a spinner + working label.
  const [pendingKey, setPendingKey] = useState<'approve' | 'reject' | null>(null)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState('')

  void teacherName
  void teacherEmail

  function handleApprove() {
    setError('')
    setPendingKey('approve')
    startTransition(async () => {
      try {
        const res = await approveTeacherWithEmail(teacherId, profileId)
        if (res && !res.ok) { setError(res.code === 'no-rate' ? t.noRate : t.error); return }
        setDone('approved')
      } catch {
        // Thrown server-action messages are redacted in prod → show friendly generic.
        setError(t.error)
      } finally {
        setPendingKey(null)
      }
    })
  }

  function handleReject() {
    if (!confirm(t.rejectConfirm)) return
    setError('')
    setPendingKey('reject')
    startTransition(async () => {
      try {
        const res = await rejectTeacherWithEmail(teacherId, profileId)
        if (res && !res.ok) { setError(res.error || t.error); return }
        setDone('rejected')
      } catch {
        // Thrown server-action messages are redacted in prod → show friendly generic.
        setError(t.error)
      } finally {
        setPendingKey(null)
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
        {pendingKey === 'approve' ? <Spinner size={14} stroke="#fff" /> : <CheckCircle className="h-3.5 w-3.5" />}
        {pendingKey === 'approve' ? t.approving : t.approve}
      </button>
      <button
        onClick={handleReject}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-all disabled:opacity-50"
        style={{ background: 'var(--ek-card)', color: 'var(--ek-red)', border: '1px solid var(--ek-border-mid)', borderRadius: 'var(--ek-radius-sm)' }}
      >
        {pendingKey === 'reject' ? <Spinner size={14} stroke="currentColor" /> : <XCircle className="h-3.5 w-3.5" />}
        {pendingKey === 'reject' ? t.rejecting : t.reject}
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
        const res = await setTeacherRate(teacherId, parsed)
        if (res && !res.ok) { setError(res.error || t.error); return }
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch {
        // Thrown server-action messages are redacted in prod → show friendly generic.
        setError(t.error)
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
        {isPending ? (
          <span className="inline-flex items-center justify-center gap-1.5"><Spinner size={12} stroke="currentColor" />{t.saving}</span>
        ) : saved ? '✓' : t.save}
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
      let res = await toggleTeacherActive(teacherId, next)
      // Deactivating a teacher with live bookings / unpaid money warns first, then
      // re-queues their classes for a backup (QA §7.2 SB-01/SB-02).
      if (!res.ok && 'needsConfirm' in res) {
        const msg = lang === 'es'
          ? `Este maestro todavía tiene ${res.liveBookings} clase(s) próxima(s) y $${res.pendingUsd.toFixed(2)} en pagos pendientes.\n\nSus clases quedarán sin asignar para reasignar un respaldo; el dinero sigue siendo pagable.\n\n¿Desactivar de todos modos?`
          : `This teacher still has ${res.liveBookings} upcoming class(es) and $${res.pendingUsd.toFixed(2)} in unpaid earnings.\n\nTheir classes will be unassigned for a backup; the money stays payable.\n\nDeactivate anyway?`
        if (!window.confirm(msg)) return
        res = await toggleTeacherActive(teacherId, false, { force: true })
      }
      if (res.ok) setActive(next)
      else setError('error' in res ? res.error : t.error)
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
        {isPending ? <Spinner size={14} stroke="currentColor" /> : active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
        {isPending ? t.working : active ? t.active : t.inactive}
      </button>
    </div>
  )
}
