'use client'

import { useState, useTransition } from 'react'
import { ClipboardList, X, Clock, CheckCircle2, Check, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { submitAssignment } from '@/app/actions/assignments'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    title: 'Homework',
    subtitle: 'Assignments from your teacher.',
    empty: 'No assignments yet.',
    emptySub: 'Your teacher will send homework here.',
    open: 'Open',
    cancelled: 'Cancelled',
    submitted: 'Submitted',
    graded: 'Graded',
    due: 'Due',
    noDue: 'No due date',
    from: 'From',
    instructions: 'Instructions',
    yourSubmission: 'Your submission',
    submissionPlaceholder: 'Type your answer here…',
    submitBtn: 'Submit',
    updateBtn: 'Update submission',
    submitting: 'Submitting…',
    feedback: 'Teacher feedback',
    score: 'Score',
    gradedAt: 'Graded',
    noFeedback: 'The teacher has not left written feedback.',
    cannotEdit: 'This assignment has been graded and can no longer be edited.',
  },
  es: {
    title: 'Tareas',
    subtitle: 'Tareas asignadas por tu maestro.',
    empty: 'Todavía no tienes tareas.',
    emptySub: 'Tu maestro te enviará tareas aquí.',
    open: 'Abierta',
    cancelled: 'Cancelada',
    submitted: 'Enviada',
    graded: 'Calificada',
    due: 'Vence',
    noDue: 'Sin fecha límite',
    from: 'De',
    instructions: 'Instrucciones',
    yourSubmission: 'Tu entrega',
    submissionPlaceholder: 'Escribe tu respuesta aquí…',
    submitBtn: 'Enviar',
    updateBtn: 'Actualizar entrega',
    submitting: 'Enviando…',
    feedback: 'Retroalimentación del maestro',
    score: 'Calificación',
    gradedAt: 'Calificada',
    noFeedback: 'El maestro no ha dejado retroalimentación escrita.',
    cannotEdit: 'Esta tarea ya fue calificada y no puede editarse.',
  },
}

interface Submission {
  id: string
  text: string
  submitted_at: string
  feedback: string | null
  score: string | null
  graded_at: string | null
}

interface Assignment {
  id: string
  title: string
  instructions: string
  due_at: string | null
  status: string
  created_at: string
  teacher_name: string
  submission: Submission | null
}

interface Props { lang: Locale; assignments: Assignment[] }

function formatDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function statusBadge(a: Assignment, tx: typeof t['en']) {
  if (a.status === 'cancelled') {
    return { bg: '#F3F4F6', fg: '#6B7280', label: tx.cancelled, icon: <XCircle className="h-3 w-3" /> }
  }
  if (a.submission?.graded_at) {
    return { bg: 'rgba(5,150,105,0.1)', fg: '#059669', label: tx.graded, icon: <CheckCircle2 className="h-3 w-3" /> }
  }
  if (a.submission) {
    return { bg: 'rgba(245,158,11,0.1)', fg: '#B45309', label: tx.submitted, icon: <Check className="h-3 w-3" /> }
  }
  return { bg: 'rgba(196,30,58,0.08)', fg: '#C41E3A', label: tx.open, icon: <Clock className="h-3 w-3" /> }
}

export default function StudentTareasClient({ lang, assignments }: Props) {
  const tx = t[lang]
  const [detail, setDetail] = useState<Assignment | null>(null)

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-5">
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                style={{ background: 'rgba(196,30,58,0.08)' }}
              >
                <ClipboardList className="h-6 w-6" style={{ color: '#C41E3A' }} />
              </div>
              <p className="text-[13px] font-semibold mb-1" style={{ color: '#111111' }}>{tx.empty}</p>
              <p className="text-[12px]" style={{ color: '#9CA3AF' }}>{tx.emptySub}</p>
            </div>
          ) : (
            <ul>
              {assignments.map((a, idx) => {
                const badge = statusBadge(a, tx)
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors"
                    style={{ borderBottom: idx < assignments.length - 1 ? '1px solid #E5E7EB' : 'none' }}
                    onClick={() => setDetail(a)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate" style={{ color: '#111111' }}>{a.title}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
                          {tx.from}: {a.teacher_name}
                        </span>
                        <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
                          {a.due_at ? `${tx.due}: ${formatDate(a.due_at, lang)}` : tx.noDue}
                        </span>
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded flex-shrink-0"
                      style={{ background: badge.bg, color: badge.fg }}
                    >
                      {badge.icon}{badge.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <AnimatePresence>
        {detail && (
          <DetailPanel lang={lang} assignment={detail} onClose={() => setDetail(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function DetailPanel({
  lang, assignment, onClose,
}: { lang: Locale; assignment: Assignment; onClose: () => void }) {
  const tx = t[lang]
  const [text, setText] = useState(assignment.submission?.text || '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const badge = statusBadge(assignment, tx)
  const isGraded = !!assignment.submission?.graded_at
  const isCancelled = assignment.status === 'cancelled'
  const canEdit = !isGraded && !isCancelled

  function handleSubmit() {
    if (!text.trim()) {
      setError(lang === 'es' ? 'La entrega no puede estar vacía' : 'Submission cannot be empty')
      return
    }
    setError('')
    startTransition(async () => {
      const res = await submitAssignment({ assignmentId: assignment.id, text: text.trim() })
      if ('error' in res && res.error) {
        setError(res.error)
        return
      }
      onClose()
    })
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(17,17,17,0.4)' }}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        className="fixed right-0 top-0 h-full w-full max-w-[420px] z-50 overflow-y-auto"
        style={{ background: '#fff', boxShadow: '-4px 0 40px rgba(0,0,0,0.12)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-5 sticky top-0"
          style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}
        >
          <div>
            <p className="text-[14px] font-bold" style={{ color: '#111111' }}>{assignment.title}</p>
            <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.from}: {assignment.teacher_name}</p>
          </div>
          <button onClick={onClose} style={{ color: '#9CA3AF' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded"
              style={{ background: badge.bg, color: badge.fg }}
            >
              {badge.icon}{badge.label}
            </span>
            <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
              {assignment.due_at ? `${tx.due}: ${formatDate(assignment.due_at, lang)}` : tx.noDue}
            </span>
          </div>

          {assignment.instructions && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>
                {tx.instructions}
              </div>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#4B5563' }}>
                {assignment.instructions}
              </p>
            </div>
          )}

          {isGraded && assignment.submission && (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>
                  {tx.feedback}
                </div>
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)' }}
                >
                  {assignment.submission.feedback ? (
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#065F46' }}>
                      {assignment.submission.feedback}
                    </p>
                  ) : (
                    <p className="text-[12px]" style={{ color: '#6B7280' }}>{tx.noFeedback}</p>
                  )}
                  {assignment.submission.score && (
                    <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(5,150,105,0.2)' }}>
                      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#065F46' }}>
                        {tx.score}:
                      </span>
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded"
                        style={{ background: '#059669', color: '#fff' }}
                      >
                        {assignment.submission.score}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isCancelled && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>
                {tx.yourSubmission}
              </div>
              {canEdit ? (
                <>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    disabled={isPending}
                    placeholder={tx.submissionPlaceholder}
                    rows={7}
                    className="w-full rounded px-3 py-2 text-[13px] outline-none resize-none"
                    style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
                  />
                  {error && <p className="text-[12px] mt-2" style={{ color: '#DC2626' }}>{error}</p>}
                  <button
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="w-full mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[12px] font-semibold disabled:opacity-50"
                    style={{ background: '#C41E3A', color: '#fff' }}
                  >
                    {isPending ? tx.submitting : assignment.submission ? tx.updateBtn : tx.submitBtn}
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="rounded-xl p-4"
                    style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
                  >
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#111111' }}>
                      {assignment.submission?.text || ''}
                    </p>
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: '#9CA3AF' }}>{tx.cannotEdit}</p>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
