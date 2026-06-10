'use client'

import { useState, useTransition } from 'react'
import { createAssignment, cancelAssignment, gradeSubmission } from '@/app/actions/assignments'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import Modal from '@/components/dashboard/Modal'
import Drawer from '@/components/dashboard/Drawer'

const SCORES = ['A1','A2','B1','B2','C1','C2','needs_work','good','excellent'] as const

const t = {
  en: {
    title: 'Homework',
    subtitle: 'Assign and grade homework for your students.',
    empty: 'No assignments yet.',
    emptySub: 'Create your first homework below.',
    newBtn: 'New assignment',
    newTitle: 'New assignment',
    listKicker: 'Assignments',
    listTitle: 'Your assignments',
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
    cancelConfirmKicker: 'Cancel assignment',
    cancelConfirmTitle: 'Cancel this assignment?',
    cancelConfirmBody: 'The student will no longer be able to submit it. This cannot be undone.',
    cancelConfirmKeep: 'Keep it',
    cancelConfirmYes: 'Cancel assignment',
    cancelling: 'Cancelling…',
    noStudents: 'You have no students yet. Once a booking is confirmed with a student, you can assign homework to them.',
    detailKicker: 'Assignment',
  },
  es: {
    title: 'Tareas',
    subtitle: 'Asigna y califica tareas para tus estudiantes.',
    empty: 'Todavía no hay tareas.',
    emptySub: 'Crea tu primera tarea abajo.',
    newBtn: 'Nueva tarea',
    newTitle: 'Nueva tarea',
    listKicker: 'Tareas',
    listTitle: 'Tus tareas',
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
    cancelConfirmKicker: 'Cancelar tarea',
    cancelConfirmTitle: '¿Cancelar esta tarea?',
    cancelConfirmBody: 'El estudiante ya no podrá entregarla. Esto no se puede deshacer.',
    cancelConfirmKeep: 'Mantener',
    cancelConfirmYes: 'Cancelar tarea',
    cancelling: 'Cancelando…',
    noStudents: 'Aún no tienes estudiantes. Cuando una reserva sea confirmada con un estudiante, podrás asignarle tareas.',
    detailKicker: 'Tarea',
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

type StatusVariant = 'completed' | 'neutral' | 'cancelled' | 'confirmed'

function formatDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

/** Single source of truth for assignment status — shared by list row + detail drawer. */
function getStatus(a: Assignment, tx: typeof t['en']): { variant: StatusVariant; label: string } {
  if (a.status === 'cancelled') return { variant: 'cancelled', label: tx.cancelled }
  if (a.submission?.graded_at) return { variant: 'completed', label: tx.graded }
  if (a.submission) return { variant: 'neutral', label: tx.submitted }
  return { variant: 'confirmed', label: tx.open }
}

export default function TeacherTareasClient({ lang, students, assignments }: Props) {
  const tx = t[lang]
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<Assignment | null>(null)

  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>

      <DashTopBar
        title={tx.title}
        sub={tx.subtitle}
        right={
          <button
            onClick={() => setShowCreate(true)}
            disabled={students.length === 0}
            className="ek-btn ek-btn-red ek-btn-square"
            style={{ padding: '9px 16px', fontSize: 12, opacity: students.length === 0 ? 0.5 : 1 }}
          >
            {tx.newBtn}
          </button>
        }
      />

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-6">

        {students.length === 0 && (
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}
          >
            <p className="text-[13px]" style={{ color: 'var(--ek-text-soft)' }}>{tx.noStudents}</p>
          </div>
        )}

        {/* Assignments list */}
        <section>
          <SectionHeader kicker={tx.listKicker} title={tx.listTitle} />
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}
          >
            {assignments.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <p
                  className="text-[15px] mb-1"
                  style={{ color: 'var(--ek-text)', fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic' }}
                >
                  {tx.empty}
                </p>
                <p className="text-[12px]" style={{ color: 'var(--ek-text-muted)' }}>{tx.emptySub}</p>
              </div>
            ) : (
              <ul>
                {assignments.map((a, idx) => {
                  const status = getStatus(a, tx)
                  return (
                    <li
                      key={a.id}
                      className="ek-row flex items-center gap-4 px-5 py-4 cursor-pointer"
                      style={{ borderBottom: idx < assignments.length - 1 ? '1px solid var(--ek-border-soft)' : 'none' }}
                      onClick={() => setDetail(a)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ek-text)' }}>{a.title}</div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>{a.student_name}</span>
                          <span className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>
                            {a.due_at ? `${tx.due}: ${formatDate(a.due_at, lang)}` : tx.noDue}
                          </span>
                        </div>
                      </div>
                      <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Create assignment modal */}
      <CreateModal
        lang={lang}
        open={showCreate}
        students={students}
        onClose={() => setShowCreate(false)}
      />

      {/* Detail / grade drawer */}
      <DetailDrawer
        lang={lang}
        assignment={detail}
        onClose={() => setDetail(null)}
      />
    </div>
  )
}

function CreateModal({
  lang, open, students, onClose,
}: { lang: Locale; open: boolean; students: Student[]; onClose: () => void }) {
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
        lang,
      })
      if ('error' in res && res.error) {
        setError(res.error)
        return
      }
      onClose()
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker={tx.newBtn}
      title={tx.newTitle}
      maxWidth={460}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="ek-outline-btn px-3 py-1.5 rounded text-[12px] font-semibold disabled:opacity-50"
            style={{ border: '1px solid var(--ek-border)', color: 'var(--ek-text-soft)', background: 'var(--ek-card)' }}
          >
            {tx.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="ek-red-btn px-3 py-1.5 rounded text-[12px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--ek-red)', color: '#fff' }}
          >
            {isPending ? tx.creating : tx.create}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={tx.studentLabel}>
          <select
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            disabled={isPending}
            className="ek-input w-full rounded px-3 py-2 text-[13px] outline-none"
            style={{ background: 'var(--ek-card)', color: 'var(--ek-text)' }}
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
            className="ek-input w-full rounded px-3 py-2 text-[13px] outline-none"
            style={{ background: 'var(--ek-card)', color: 'var(--ek-text)' }}
          />
        </Field>
        <Field label={tx.instructionsLabel}>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            disabled={isPending}
            rows={5}
            className="ek-input w-full rounded px-3 py-2 text-[13px] outline-none resize-none"
            style={{ background: 'var(--ek-card)', color: 'var(--ek-text)' }}
          />
        </Field>
        <Field label={`${tx.dueLabel} · ${tx.dueOptional}`}>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={e => setDueAt(e.target.value)}
            disabled={isPending}
            className="ek-input w-full rounded px-3 py-2 text-[13px] outline-none"
            style={{ background: 'var(--ek-card)', color: 'var(--ek-text)' }}
          />
        </Field>
        {error && <p className="text-[12px]" style={{ color: 'var(--ek-red)' }}>{error}</p>}
      </div>
    </Modal>
  )
}

function DetailDrawer({
  lang, assignment, onClose,
}: { lang: Locale; assignment: Assignment | null; onClose: () => void }) {
  const tx = t[lang]
  const [feedback, setFeedback] = useState(assignment?.submission?.feedback || '')
  const [score, setScore] = useState<string>(assignment?.submission?.score || '')
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isCancelPending, startCancelTransition] = useTransition()

  // Re-seed the grade form whenever a different assignment opens.
  const [seededId, setSeededId] = useState<string | null>(null)
  if (assignment && assignment.id !== seededId) {
    setSeededId(assignment.id)
    setFeedback(assignment.submission?.feedback || '')
    setScore(assignment.submission?.score || '')
    setError('')
    setConfirmCancel(false)
  }

  function handleGrade() {
    if (!assignment || !assignment.submission) return
    setError('')
    startTransition(async () => {
      const res = await gradeSubmission({
        assignmentId: assignment.id,
        feedback,
        score: score || null,
        lang,
      })
      if ('error' in res && res.error) {
        setError(res.error)
        return
      }
      onClose()
    })
  }

  function handleCancel() {
    if (!assignment) return
    setError('')
    startCancelTransition(async () => {
      const res = await cancelAssignment(assignment.id, lang)
      if ('error' in res && res.error) {
        setError(res.error)
        setConfirmCancel(false)
        return
      }
      onClose()
    })
  }

  const status = assignment ? getStatus(assignment, tx) : null

  return (
    <>
      <Drawer
        open={!!assignment}
        onClose={onClose}
        kicker={tx.detailKicker}
        title={assignment?.title ?? ''}
        width={440}
        footer={
          assignment && assignment.submission ? (
            <button
              onClick={handleGrade}
              disabled={isPending}
              className="ek-red-btn w-full px-3 py-2 rounded text-[12px] font-semibold disabled:opacity-50"
              style={{ background: 'var(--ek-red)', color: '#fff' }}
            >
              {isPending ? tx.grading : tx.gradeBtn}
            </button>
          ) : undefined
        }
      >
        {assignment && status && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
              <span className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>
                {assignment.student_name}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>
                {assignment.due_at ? `${tx.due}: ${formatDate(assignment.due_at, lang)}` : tx.noDue}
              </span>
            </div>

            {assignment.instructions && (
              <div>
                <div className="ek-microlabel" style={{ marginBottom: 8 }}>
                  {tx.instructionsLabel}
                </div>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ek-text-soft)' }}>
                  {assignment.instructions}
                </p>
              </div>
            )}

            {assignment.submission ? (
              <>
                <div>
                  <div className="ek-microlabel" style={{ marginBottom: 8 }}>
                    {tx.viewSubmission}
                  </div>
                  <div
                    className="rounded-xl p-4"
                    style={{ background: 'var(--ek-paper)', border: '1px solid var(--ek-border)' }}
                  >
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ek-text)' }}>
                      {assignment.submission.text}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="ek-microlabel block" style={{ marginBottom: 8 }}>
                    {tx.feedback}
                  </label>
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    disabled={isPending}
                    rows={4}
                    className="ek-input w-full rounded px-3 py-2 text-[13px] outline-none resize-none"
                    style={{ background: 'var(--ek-card)', color: 'var(--ek-text)' }}
                  />
                </div>

                <div>
                  <label className="ek-microlabel block" style={{ marginBottom: 8 }}>
                    {tx.score}
                  </label>
                  <select
                    value={score}
                    onChange={e => setScore(e.target.value)}
                    disabled={isPending}
                    className="ek-input w-full rounded px-3 py-2 text-[13px] outline-none"
                    style={{ background: 'var(--ek-card)', color: 'var(--ek-text)' }}
                  >
                    <option value="">{tx.noScore}</option>
                    {SCORES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {error && <p className="text-[12px]" style={{ color: 'var(--ek-red)' }}>{error}</p>}
              </>
            ) : (
              <>
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ background: 'var(--ek-paper)', border: '1px solid var(--ek-border)' }}
                >
                  <p className="text-[12px]" style={{ color: 'var(--ek-text-muted)' }}>{tx.waiting}</p>
                </div>
                {error && <p className="text-[12px]" style={{ color: 'var(--ek-red)' }}>{error}</p>}
              </>
            )}

            {assignment.status !== 'cancelled' && (
              <button
                onClick={() => setConfirmCancel(true)}
                disabled={isCancelPending}
                className="ek-link-danger w-full text-[12px] font-medium py-2 rounded disabled:opacity-50"
                style={{ color: 'var(--ek-text-muted)' }}
              >
                {tx.cancelAssignment}
              </button>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={confirmCancel}
        onClose={() => { if (!isCancelPending) setConfirmCancel(false) }}
        kicker={tx.cancelConfirmKicker}
        title={tx.cancelConfirmTitle}
        maxWidth={400}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirmCancel(false)}
              disabled={isCancelPending}
              className="ek-outline-btn px-3 py-1.5 rounded text-[12px] font-semibold disabled:opacity-50"
              style={{ border: '1px solid var(--ek-border)', color: 'var(--ek-text-soft)', background: 'var(--ek-card)' }}
            >
              {tx.cancelConfirmKeep}
            </button>
            <button
              onClick={handleCancel}
              disabled={isCancelPending}
              className="ek-red-btn px-3 py-1.5 rounded text-[12px] font-semibold disabled:opacity-50"
              style={{ background: 'var(--ek-red)', color: '#fff' }}
            >
              {isCancelPending ? tx.cancelling : tx.cancelConfirmYes}
            </button>
          </div>
        }
      >
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ek-text-soft)' }}>
          {tx.cancelConfirmBody}
        </p>
      </Modal>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="ek-microlabel block" style={{ marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
