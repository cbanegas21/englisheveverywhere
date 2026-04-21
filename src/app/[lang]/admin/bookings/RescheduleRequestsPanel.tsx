'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Check, X, ArrowRight, MessageSquare } from 'lucide-react'
import { approveRescheduleRequest, rejectRescheduleRequest } from '../actions'

interface Request {
  id: string
  bookingId: string
  originalAt: string
  proposedAt: string
  reason: string | null
  createdAt: string
  studentName: string | null
  teacherName: string | null
}

interface Props {
  lang: string
  requests: Request[]
}

const t = {
  en: {
    title: 'Reschedule requests',
    subtitle: 'Teachers have asked to move these classes.',
    from: 'From',
    to: 'To',
    reason: 'Reason',
    noReason: 'No reason given',
    approve: 'Approve',
    reject: 'Reject',
    student: 'Student',
    teacher: 'Teacher',
    adminNote: 'Admin note (optional)',
    adminNotePlaceholder: 'Shown to the teacher on their agenda.',
    cancel: 'Cancel',
    confirmReject: 'Reject request?',
    confirmApprove: 'Approve and move the class?',
    errorGeneric: 'Something went wrong',
  },
  es: {
    title: 'Solicitudes de reagendar',
    subtitle: 'Los maestros piden mover estas clases.',
    from: 'De',
    to: 'A',
    reason: 'Motivo',
    noReason: 'Sin motivo',
    approve: 'Aprobar',
    reject: 'Rechazar',
    student: 'Estudiante',
    teacher: 'Maestro',
    adminNote: 'Nota del admin (opcional)',
    adminNotePlaceholder: 'Se muestra al maestro en su agenda.',
    cancel: 'Cancelar',
    confirmReject: '¿Rechazar solicitud?',
    confirmApprove: '¿Aprobar y mover la clase?',
    errorGeneric: 'Ocurrió un error',
  },
}

function formatDateTime(iso: string, lang: string) {
  return new Date(iso).toLocaleString(lang === 'es' ? 'es-HN' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Tegucigalpa',
  })
}

export default function RescheduleRequestsPanel({ lang, requests }: Props) {
  const tx = lang === 'es' ? t.es : t.en
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actingOn, setActingOn] = useState<{ id: string; mode: 'approve' | 'reject' } | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [err, setErr] = useState('')

  function openAction(id: string, mode: 'approve' | 'reject') {
    setActingOn({ id, mode })
    setAdminNote('')
    setErr('')
  }

  function close() {
    setActingOn(null)
    setAdminNote('')
    setErr('')
  }

  function submit() {
    if (!actingOn) return
    setErr('')
    startTransition(async () => {
      try {
        if (actingOn.mode === 'approve') {
          await approveRescheduleRequest(actingOn.id, adminNote)
        } else {
          await rejectRescheduleRequest(actingOn.id, adminNote)
        }
        close()
        router.refresh()
      } catch (e) {
        setErr(e instanceof Error ? e.message : tx.errorGeneric)
      }
    })
  }

  return (
    <div className="px-6 md:px-8 pt-6">
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid #FCD34D' }}
      >
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #FEF3C7', background: '#FFFBEB' }}>
          <div
            className="flex h-7 w-7 items-center justify-center rounded"
            style={{ background: '#FEF3C7', border: '1px solid #FCD34D' }}
          >
            <CalendarClock className="h-3.5 w-3.5" style={{ color: '#92400E' }} />
          </div>
          <div>
            <h2 className="text-[13px] font-bold" style={{ color: '#111111' }}>{tx.title}</h2>
            <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
          </div>
          <span
            className="ml-auto text-[10px] font-bold rounded px-2 py-0.5"
            style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}
          >
            {requests.length}
          </span>
        </div>

        <ul>
          {requests.map((r) => (
            <li
              key={r.id}
              className="px-5 py-4"
              style={{ borderBottom: '1px solid #F3F4F6' }}
            >
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="text-[13px] font-semibold" style={{ color: '#111111' }}>
                    {r.teacherName || tx.teacher} → {r.studentName || tx.student}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: '#4B5563' }}>
                    <span>{tx.from}: <strong>{formatDateTime(r.originalAt, lang)}</strong></span>
                    <ArrowRight className="h-3 w-3" style={{ color: '#9CA3AF' }} />
                    <span>{tx.to}: <strong style={{ color: '#C41E3A' }}>{formatDateTime(r.proposedAt, lang)}</strong></span>
                  </div>
                  {r.reason ? (
                    <div className="flex items-start gap-1.5 mt-2 text-[11px]" style={{ color: '#4B5563' }}>
                      <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                      <span>{r.reason}</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] italic" style={{ color: '#9CA3AF' }}>{tx.noReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAction(r.id, 'approve')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded font-semibold text-[12px] transition-all"
                    style={{ background: '#C41E3A', color: '#fff' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#9E1830')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#C41E3A')}
                  >
                    <Check className="h-3 w-3" />
                    {tx.approve}
                  </button>
                  <button
                    onClick={() => openAction(r.id, 'reject')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded font-semibold text-[12px] transition-all"
                    style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#fff' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#DC2626' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#4B5563' }}
                  >
                    <X className="h-3 w-3" />
                    {tx.reject}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <AnimatePresence>
        {actingOn && (
          <motion.div
            key="resched-admin-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-xl"
              style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
                <h3 className="text-[15px] font-black" style={{ color: '#111111' }}>
                  {actingOn.mode === 'approve' ? tx.confirmApprove : tx.confirmReject}
                </h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                <label className="text-[11px] font-semibold block" style={{ color: '#4B5563' }}>{tx.adminNote}</label>
                <textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  placeholder={tx.adminNotePlaceholder}
                  rows={3}
                  className="w-full rounded px-2 py-1.5 text-[13px] outline-none resize-none"
                  style={{ border: '1px solid #E5E7EB', color: '#111111' }}
                />
                {err && <p className="text-[12px]" style={{ color: '#DC2626' }}>{err}</p>}
              </div>
              <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                <button
                  onClick={close}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded font-semibold text-[12px]"
                  style={{ color: '#4B5563', background: '#fff', border: '1px solid #E5E7EB' }}
                >
                  {tx.cancel}
                </button>
                <button
                  onClick={submit}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded font-semibold text-[12px] disabled:opacity-50"
                  style={{
                    background: actingOn.mode === 'approve' ? '#C41E3A' : '#DC2626',
                    color: '#fff',
                  }}
                >
                  {isPending ? '…' : actingOn.mode === 'approve' ? tx.approve : tx.reject}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
