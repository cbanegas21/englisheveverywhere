'use client'

import { useState, useTransition } from 'react'
import { ClipboardList, Plus, X, Check, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createAssignment, cancelAssignment, gradeSubmission } from '@/app/actions/assignments'
import type { Locale } from '@/lib/i18n/translations'

const SCORES = ['A1','A2','B1','B2','C1','C2','needs_work','good','excellent'] as const

const t = {
  en: {
    title: 'Homework',
    subtitle: 'Assign and grade homework for your students.',
    empty: 'No assignments yet.',
    emptySub: 'Create your first homework below.',
    newBtn: 'New assignment',
    newTitle: 'New assignment',
    studentLabel: 'Student',
    studentPlaceholder: 'Choose a student…',
    titleLabel: 'Title',
    instructionsLabel: 'Instructions',
    dueLabel: 'Due date',
    dueOptional: 'Optional',
    create: 'Create',
    creating: 'Creating…',
    cancel: 'Cancel',
    open: 'Open',
    cancelled: 'Cancelled',
    submitted: 'Submitted',
    graded: 'Graded',
    waiting: 'Waiting for submission',
    due: 'Due',
    noDue: 'No due date',
    viewSubmission: 'Submission',
    feedback: 'Feedback',
    score: 'Score',
    noScore: 'No score',
    gradeBtn: 'Save feedback',
    grading: 'Saving…',
    cancelAssignment: 'Cancel assignment',
    noStudents: 'You have no students yet. Once a booking is confirmed with a student, you can assign homework to them.',
  },
  es: {
    title: 'Tareas',
    subtitle: 'Asigna y califica tareas para tus estudiantes.',
    empty: 'Todavía no hay tareas.',
    emptySub: 'Crea tu primera tarea abajo.',
    newBtn: 'Nueva tarea',
    newTitle: 'Nueva tarea',
    studentLabel: 'Estudiante',
    studentPlaceholder: 'Elige un estudiante…',
    titleLabel: 'Título',
    instructionsLabel: 'Instrucciones',
    dueLabel: 'Fecha límite',
    dueOptional: 'Opcional',
    create: 'Crear',
    creating: 'Creando…',
    cancel: 'Cancelar',
    open: 'Abierta',
    cancelled: 'Cancelada',
    submitted: 'Enviada',
    graded: 'Calificada',
    waiting: 'Esperando entrega',
    due: 'Vence',
    noDue: 'Sin fecha límite',
    viewSubmission: 'Entrega',
    feedback: 'Retroalimentación',
    score: 'Calificación',
    noScore: 'Sin calificación',
    gradeBtn: 'Guardar',
    grading: 'Guardando…',
    cancelAssignment: 'Cancelar tarea',
    noStudents: 'Aún no tienes estudiantes. Cuando una reserva sea confirmada con un estudiante, podrás asignarle tareas.',
  },
}

interface Student { id: string; name: string }

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
  student_id: string
  student_name: string
  submission: Submission | null
}

interface Props {
  lang: Locale
  students: Student[]
  assignments: Assignment[]
}

function formatDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function TeacherTareasClient({ lang, students, assignments }: Props) {
  const tx = t[lang]
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<Assignment | null>(null)

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div
        className="px-8 py-6 flex items-center justify-between"
        style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}
      >
        <div>
          <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={students.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded text-[12px] font-semibold transition-all disabled:opacity-50"
          style={{ background: '#C41E3A', color: '#fff' }}
        >
          <Plus className="h-3.5 w-3.5" />
          {tx.newBtn}
        </button>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-5">

        {students.length === 0 && (
          <div
            className="rounded-xl p-5"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <p className="text-[13px]" style={{ color: '#4B5563' }}>{tx.noStudents}</p>
          </div>
        )}

        {/* Assignments list */}
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
                const statusBadge = getStatusBadge(a, tx)
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
                        <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{a.student_name}</span>
                        <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
                          {a.due_at ? `${tx.due}: ${formatDate(a.due_at, lang)}` : tx.noDue}
                        </span>
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded flex-shrink-0"
                      style={{ background: statusBadge.bg, color: statusBadge.fg }}
                    >
                      {statusBadge.icon}
                      {statusBadge.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Create assignment modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            lang={lang}
            students={students}
            onClose={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>

      {/* Detail / grade modal */}
      <AnimatePresence>
        {detail && (
          <DetailModal
            lang={lang}
            assignment={detail}
            onClose={() => setDetail(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function getStatusBadge(a: Assignment, tx: typeof t['en']) {
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

function CreateModal({
  lang, students, onClose,
}: { lang: Locale; students: Student[]; onClose: () => void }) {
  const tx = t[lang]
  const [studentId, setStudentId] = useState('')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!studentId || !title.trim()) {
      setError(lang === 'es' ? 'Estudiante y título son requeridos' : 'Student and title are required')
      return
    }
    setError('')
    startTransition(async () => {
      const res = await createAssignment({
        studentId,
        title: title.trim(),
        instructions: instructions.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      })
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
        initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[440px] z-50 rounded-xl"
        style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 20px 60px rgba(0,0,0,0.16)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <h3 className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.newTitle}</h3>
          <button onClick={onClose} style={{ color: '#9CA3AF' }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Field label={tx.studentLabel}>
            <select
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              disabled={isPending}
              className="w-full rounded px-3 py-2 text-[13px] outline-none"
              style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
            >
              <option value="">{tx.studentPlaceholder}</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label={tx.titleLabel}>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={isPending}
              maxLength={120}
              className="w-full rounded px-3 py-2 text-[13px] outline-none"
              style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
            />
          </Field>
          <Field label={tx.instructionsLabel}>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              disabled={isPending}
              rows={5}
              className="w-full rounded px-3 py-2 text-[13px] outline-none resize-none"
              style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
            />
          </Field>
          <Field label={`${tx.dueLabel} · ${tx.dueOptional}`}>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={e => setDueAt(e.target.value)}
              disabled={isPending}
              className="w-full rounded px-3 py-2 text-[13px] outline-none"
              style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
            />
          </Field>
          {error && <p className="text-[12px]" style={{ color: '#DC2626' }}>{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #E5E7EB' }}>
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-3 py-1.5 rounded text-[12px] font-semibold"
            style={{ color: '#6B7280' }}
          >
            {tx.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-3 py-1.5 rounded text-[12px] font-semibold disabled:opacity-50"
            style={{ background: '#C41E3A', color: '#fff' }}
          >
            {isPending ? tx.creating : tx.create}
          </button>
        </div>
      </motion.div>
    </>
  )
}

function DetailModal({
  lang, assignment, onClose,
}: { lang: Locale; assignment: Assignment; onClose: () => void }) {
  const tx = t[lang]
  const [feedback, setFeedback] = useState(assignment.submission?.feedback || '')
  const [score, setScore] = useState<string>(assignment.submission?.score || '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isCancelPending, startCancelTransition] = useTransition()

  function handleGrade() {
    if (!assignment.submission) return
    setError('')
    startTransition(async () => {
      const res = await gradeSubmission({
        assignmentId: assignment.id,
        feedback,
        score: score || null,
      })
      if ('error' in res && res.error) {
        setError(res.error)
        return
      }
      onClose()
    })
  }

  function handleCancel() {
    if (!confirm(lang === 'es' ? '¿Cancelar esta tarea?' : 'Cancel this assignment?')) return
    setError('')
    startCancelTransition(async () => {
      const res = await cancelAssignment(assignment.id)
      if ('error' in res && res.error) {
        setError(res.error)
        return
      }
      onClose()
    })
  }

  const badge = getStatusBadge(assignment, tx)

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
            <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{assignment.student_name}</p>
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
                {tx.instructionsLabel}
              </div>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#4B5563' }}>
                {assignment.instructions}
              </p>
            </div>
          )}

          {assignment.submission ? (
            <>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>
                  {tx.viewSubmission}
                </div>
                <div
                  className="rounded-xl p-4"
                  style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
                >
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#111111' }}>
                    {assignment.submission.text}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-2 block" style={{ color: '#9CA3AF' }}>
                  {tx.feedback}
                </label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  disabled={isPending}
                  rows={4}
                  className="w-full rounded px-3 py-2 text-[13px] outline-none resize-none"
                  style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-2 block" style={{ color: '#9CA3AF' }}>
                  {tx.score}
                </label>
                <select
                  value={score}
                  onChange={e => setScore(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded px-3 py-2 text-[13px] outline-none"
                  style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
                >
                  <option value="">{tx.noScore}</option>
                  {SCORES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-[12px]" style={{ color: '#DC2626' }}>{error}</p>}

              <button
                onClick={handleGrade}
                disabled={isPending}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[12px] font-semibold disabled:opacity-50"
                style={{ background: '#C41E3A', color: '#fff' }}
              >
                {isPending ? tx.grading : tx.gradeBtn}
              </button>
            </>
          ) : (
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
            >
              <p className="text-[12px]" style={{ color: '#9CA3AF' }}>{tx.waiting}</p>
            </div>
          )}

          {assignment.status !== 'cancelled' && (
            <button
              onClick={handleCancel}
              disabled={isCancelPending}
              className="w-full text-[12px] font-medium py-2 rounded transition-colors disabled:opacity-50"
              style={{ color: '#9CA3AF' }}
              onMouseEnter={e => { if (!isCancelPending) e.currentTarget.style.color = '#DC2626' }}
              onMouseLeave={e => { if (!isCancelPending) e.currentTarget.style.color = '#9CA3AF' }}
            >
              {tx.cancelAssignment}
            </button>
          )}
        </div>
      </motion.div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: '#9CA3AF' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
