'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { submitAssignment } from '@/app/actions/assignments'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { StatLedger } from '@/components/ui/StatLedger'
import { StatusBadge } from '@/components/ui/StatusBadge'

const t = {
  en: {
    title: 'Homework',
    subtitle: 'Assignments from your teacher',
    pendingBadge: (n: number) => `${n} pending`,
    philosophyKicker: '↳ A note on homework',
    philosophy: 'Homework is an invitation, not an obligation.',
    philosophyBody: 'No grades you can fail. No streaks you can lose. Your teacher sends what helps your specific goals, and you choose when to do it.',
    stats: {
      pending: 'Pending',
      pendingSub: 'awaiting submission',
      completed: 'Completed',
      completedSub: 'all-time',
      avgResponse: 'Avg. response',
      avgResponseSub: 'time to submit',
    },
    sectionPending: 'Pending',
    sectionCompleted: 'Completed',
    empty: 'No assignments yet.',
    emptySub: 'Your teacher will send homework here.',
    open: 'Open',
    cancelled: 'Cancelled',
    submitted: 'Submitted',
    graded: 'Graded',
    overdue: 'Overdue',
    due: 'Due',
    noDue: 'No due date',
    from: 'From',
    start: 'Start',
    view: 'View',
    instructions: 'Instructions',
    yourSubmission: 'Your submission',
    submissionPlaceholder: 'Type your answer here…',
    submitBtn: 'Submit',
    updateBtn: 'Update submission',
    submitting: 'Submitting…',
    feedback: 'Teacher feedback',
    score: 'Score',
    noFeedback: 'The teacher has not left written feedback.',
    cannotEdit: 'This assignment has been graded and can no longer be edited.',
  },
  es: {
    title: 'Tareas',
    subtitle: 'Tareas asignadas por tu maestro',
    pendingBadge: (n: number) => `${n} pendiente${n !== 1 ? 's' : ''}`,
    philosophyKicker: '↳ Una nota sobre tareas',
    philosophy: 'Las tareas son invitaciones, no obligaciones.',
    philosophyBody: 'No hay calificaciones que perder. No hay rachas que romper. Tu maestro envía lo que ayuda a tus metas específicas, y tú eliges cuándo hacerlo.',
    stats: {
      pending: 'Pendientes',
      pendingSub: 'sin enviar',
      completed: 'Completadas',
      completedSub: 'históricas',
      avgResponse: 'Promedio respuesta',
      avgResponseSub: 'tiempo en enviar',
    },
    sectionPending: 'Pendientes',
    sectionCompleted: 'Completadas',
    empty: 'Todavía no tienes tareas.',
    emptySub: 'Tu maestro te enviará tareas aquí.',
    open: 'Abierta',
    cancelled: 'Cancelada',
    submitted: 'Enviada',
    graded: 'Calificada',
    overdue: 'Atrasada',
    due: 'Vence',
    noDue: 'Sin fecha límite',
    from: 'De',
    start: 'Empezar',
    view: 'Ver',
    instructions: 'Instrucciones',
    yourSubmission: 'Tu entrega',
    submissionPlaceholder: 'Escribe tu respuesta aquí…',
    submitBtn: 'Enviar',
    updateBtn: 'Actualizar entrega',
    submitting: 'Enviando…',
    feedback: 'Retroalimentación del maestro',
    score: 'Calificación',
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
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
    month: 'short', day: 'numeric',
  })
}

function getStatusVariant(a: Assignment): 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'neutral' {
  if (a.status === 'cancelled') return 'cancelled'
  if (a.submission?.graded_at) return 'completed'
  if (a.submission) return 'confirmed'
  if (a.due_at && new Date(a.due_at).getTime() < Date.now()) return 'pending'
  return 'pending'
}

function getStatusLabel(a: Assignment, tx: typeof t['en']): string {
  if (a.status === 'cancelled') return tx.cancelled
  if (a.submission?.graded_at) return tx.graded
  if (a.submission) return tx.submitted
  if (a.due_at && new Date(a.due_at).getTime() < Date.now()) return tx.overdue
  return tx.open
}

export default function StudentTareasClient({ lang, assignments }: Props) {
  const tx = t[lang]
  const accent = 'var(--ek-red)'
  const [detail, setDetail] = useState<Assignment | null>(null)

  const pending = assignments.filter((a) => !a.submission && a.status !== 'cancelled')
  // "Completed" = anything the student actually submitted. A cancelled assignment
  // the student never submitted is a retracted task — it shows in neither list
  // (mirrors `pending` already excluding cancelled). This keeps the section count
  // identical to the "Completed" stat tile, which only counts submissions (HOMEWORK-02).
  const completed = assignments.filter((a) => a.submission)

  // Average response time (days) for completed submissions
  const avgDays = (() => {
    const withTimes = assignments.filter((a) => a.submission?.submitted_at && a.created_at)
    if (withTimes.length === 0) return null
    const total = withTimes.reduce((sum, a) => {
      const created = new Date(a.created_at).getTime()
      const submitted = new Date(a.submission!.submitted_at).getTime()
      return sum + (submitted - created) / (1000 * 60 * 60 * 24)
    }, 0)
    return (total / withTimes.length).toFixed(1)
  })()

  return (
    <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
      <DashTopBar
        title={tx.title}
        sub={tx.subtitle}
        right={
          pending.length > 0 && (
            <span
              style={{
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: accent,
              }}
            >
              {tx.pendingBadge(pending.length)}
            </span>
          )
        }
      />

      <div style={{ padding: '28px 36px', maxWidth: 1280, margin: '0 auto' }}>
        {/* Philosophy quote — editorial: quiet 3px red hairline left-rule, no icon chip */}
        <div
          style={{
            background: 'var(--ek-card)',
            border: '1px solid var(--ek-border)',
            borderRadius: 14,
            padding: '24px 28px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'stretch',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              alignSelf: 'stretch',
              width: 3,
              flexShrink: 0,
              borderRadius: 2,
              background: accent,
            }}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: accent,
                marginBottom: 12,
              }}
            >
              {tx.philosophyKicker}
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'italic',
                fontSize: 24,
                fontWeight: 400,
                letterSpacing: '-0.015em',
                lineHeight: 1.3,
                color: 'var(--ek-text)',
              }}
            >
              &ldquo;{tx.philosophy}&rdquo;
            </p>
            <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--ek-text-soft)', lineHeight: 1.55 }}>
              {tx.philosophyBody}
            </p>
          </div>
        </div>

        {/* Stats — editorial ledger: big numbers + hairline rules, no boxes. */}
        <div style={{ marginBottom: 28 }}>
          <StatLedger
            items={[
              {
                kicker: tx.stats.pending,
                value: pending.length,
                sub: tx.stats.pendingSub,
                accent: true,
              },
              {
                kicker: tx.stats.completed,
                value: completed.length,
                sub: tx.stats.completedSub,
              },
              {
                kicker: tx.stats.avgResponse,
                value: avgDays ? `${avgDays}d` : '—',
                sub: tx.stats.avgResponseSub,
              },
            ]}
          />
        </div>

        {/* Empty state — also covers the case where every assignment was cancelled
            before submission (filtered out of both lists), so the page never shows
            stats with no explanation (HOMEWORK-02). */}
        {pending.length === 0 && completed.length === 0 && (
          <div
            style={{
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-border)',
              borderRadius: 14,
              padding: '60px 24px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ek-text)' }}>{tx.empty}</p>
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--ek-text-muted)' }}>{tx.emptySub}</p>
          </div>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <section
            style={{
              marginBottom: 28,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-muted)',
                marginBottom: 12,
              }}
            >
              {tx.sectionPending} ({pending.length})
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {pending.map((a) => (
                <TaskCard key={a.id} a={a} tx={tx} lang={lang} onOpen={() => setDetail(a)} />
              ))}
            </div>
          </section>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <section>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-muted)',
                marginBottom: 12,
              }}
            >
              {tx.sectionCompleted} ({completed.length})
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {completed.map((a) => (
                <TaskCard key={a.id} a={a} tx={tx} lang={lang} onOpen={() => setDetail(a)} />
              ))}
            </div>
          </section>
        )}
      </div>

      <AnimatePresence>
        {detail && (
          <DetailPanel lang={lang} assignment={detail} onClose={() => setDetail(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function TaskCard({
  a,
  tx,
  lang,
  onOpen,
}: {
  a: Assignment
  tx: typeof t['en']
  lang: Locale
  onOpen: () => void
}) {
  const variant = getStatusVariant(a)
  const label = getStatusLabel(a, tx)
  const hasSubmission = !!a.submission

  return (
    <button
      onClick={onOpen}
      style={{
        background: 'var(--ek-card)',
        border: '1px solid var(--ek-border)',
        borderRadius: 12,
        padding: '18px 22px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--ek-font-sans)',
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 16,
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--ek-text)',
            marginBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {a.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'var(--ek-text-muted)' }}>
            {tx.from}: {a.teacher_name}
          </span>
          <span style={{ color: 'var(--ek-border-mid)', fontSize: 11 }}>·</span>
          <span style={{ fontSize: 11.5, color: 'var(--ek-text-muted)', fontFeatureSettings: '"tnum"' }}>
            {a.due_at ? `${tx.due} ${formatDate(a.due_at, lang)}` : tx.noDue}
          </span>
        </div>
      </div>
      <StatusBadge variant={variant}>{label}</StatusBadge>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: '8px 14px',
          borderRadius: 6,
          background: hasSubmission ? 'var(--ek-paper)' : 'var(--ek-ink)',
          color: hasSubmission ? 'var(--ek-text)' : '#fff',
          border: hasSubmission ? '1px solid var(--ek-border-mid)' : 0,
        }}
      >
        {hasSubmission ? tx.view : tx.start}
      </span>
    </button>
  )
}

function DetailPanel({
  lang,
  assignment,
  onClose,
}: {
  lang: Locale
  assignment: Assignment
  onClose: () => void
}) {
  const tx = t[lang]
  const [text, setText] = useState(assignment.submission?.text || '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const variant = getStatusVariant(assignment)
  const label = getStatusLabel(assignment, tx)
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
      const res = await submitAssignment({ assignmentId: assignment.id, text: text.trim(), lang })
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', zIndex: 40 }}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100%',
          width: '100%',
          maxWidth: 440,
          zIndex: 50,
          overflowY: 'auto',
          background: 'var(--ek-card)',
          boxShadow: '-4px 0 40px rgba(0,0,0,0.12)',
          fontFamily: 'var(--ek-font-sans)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            position: 'sticky',
            top: 0,
            background: 'var(--ek-card)',
            borderBottom: '1px solid var(--ek-border)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--ek-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {assignment.title}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ek-text-muted)' }}>
              {tx.from}: {assignment.teacher_name}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 0, color: 'var(--ek-text-muted)', cursor: 'pointer' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <StatusBadge variant={variant}>{label}</StatusBadge>
            <span style={{ fontSize: 11, color: 'var(--ek-text-muted)' }}>
              {assignment.due_at ? `${tx.due}: ${formatDate(assignment.due_at, lang)}` : tx.noDue}
            </span>
          </div>

          {assignment.instructions && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                  marginBottom: 8,
                }}
              >
                {tx.instructions}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ek-text-soft)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {assignment.instructions}
              </p>
            </div>
          )}

          {isGraded && assignment.submission && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                  marginBottom: 8,
                }}
              >
                {tx.feedback}
              </div>
              <div
                style={{
                  borderRadius: 12,
                  padding: 16,
                  background: 'var(--ek-success-bg)',
                  border: '1px solid var(--ek-success-border)',
                }}
              >
                {assignment.submission.feedback ? (
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--ek-success-text)' }}>
                    {assignment.submission.feedback}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ek-text-soft)' }}>{tx.noFeedback}</p>
                )}
                {assignment.submission.score && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid var(--ek-success-border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--ek-success-text)',
                      }}
                    >
                      {tx.score}:
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: 'var(--ek-success-text)',
                        color: '#fff',
                      }}
                    >
                      {assignment.submission.score}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isCancelled && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--ek-text-muted)',
                  marginBottom: 8,
                }}
              >
                {tx.yourSubmission}
              </div>
              {canEdit ? (
                <>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={isPending}
                    placeholder={tx.submissionPlaceholder}
                    rows={7}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 13,
                      outline: 'none',
                      resize: 'none',
                      border: '1px solid var(--ek-border)',
                      background: 'var(--ek-card)',
                      color: 'var(--ek-text)',
                      fontFamily: 'var(--ek-font-sans)',
                    }}
                  />
                  {error && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--ek-red)' }}>{error}</p>}
                  <button
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="ek-btn ek-btn-red ek-btn-square"
                    style={{
                      width: '100%',
                      marginTop: 12,
                      padding: '11px 0',
                      fontSize: 12,
                      justifyContent: 'center',
                      opacity: isPending ? 0.6 : 1,
                    }}
                  >
                    {isPending ? tx.submitting : assignment.submission ? tx.updateBtn : tx.submitBtn}
                  </button>
                </>
              ) : (
                <>
                  <div
                    style={{
                      borderRadius: 12,
                      padding: 16,
                      background: 'var(--ek-paper)',
                      border: '1px solid var(--ek-border)',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--ek-text)' }}>
                      {assignment.submission?.text || ''}
                    </p>
                  </div>
                  <p style={{ marginTop: 8, fontSize: 11, color: 'var(--ek-text-muted)' }}>{tx.cannotEdit}</p>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
