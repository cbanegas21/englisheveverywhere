'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import { Spinner } from '@/components/ui/Spinner'
import { gradeQuizAttempt } from '@/app/actions/lab'

type QType = 'mcq_single' | 'mcq_multi' | 'true_false' | 'short_answer' | 'matching' | 'essay'
interface SOption { text: string; correct?: boolean; feedback?: string }
interface SQuestion {
  id: string
  type: QType
  prompt: string
  guidance?: string
  options?: SOption[]
  lefts?: string[]
  rights?: string[]
  pairs?: { left: string; right: string }[]
  answer?: boolean
  feedback?: string
  accepted?: string[]
}
type RQuestion = SQuestion & { outcome?: string }
interface AttemptRow {
  assignmentId: string
  status: string
  attemptId: string | null
  submitted: boolean
  autoScore: number
  maxScore: number
  graded: boolean
  teacherFeedback: string
  answers: Record<string, unknown>
  questions: RQuestion[]
  studentName: string
}
interface Props { lang: Locale; quizTitle: string; attempts: AttemptRow[] }

const t = {
  en: {
    flourish: 'responses',
    sub: 'Review what your students sent and grade the open answers.',
    back: '← Back to quizzes',
    none: 'No one has been assigned this quiz yet.',
    notSubmitted: 'Not submitted',
    toReview: 'To review',
    graded: 'Graded',
    submitted: 'Submitted',
    tf_true: 'True',
    tf_false: 'False',
    correctAnswer: 'Correct answer',
    studentAnswer: 'Their answer',
    noAnswer: '— left blank —',
    markCorrect: '✓ Correct',
    markIncorrect: '✗ Not yet',
    pending: 'Needs your review',
    feedback: 'A note for your student (optional)',
    feedbackPh: 'Encourage them, point out one thing to practice…',
    save: 'Save grade',
    saving: 'Saving…',
    score: (a: number, b: number) => `${a} of ${b} correct`,
    cancelled: 'Cancelled',
  },
  es: {
    flourish: 'respuestas',
    sub: 'Revisa lo que enviaron tus estudiantes y califica las respuestas abiertas.',
    back: '← Volver a quizzes',
    none: 'Aún no le has asignado este quiz a nadie.',
    notSubmitted: 'Sin enviar',
    toReview: 'Por revisar',
    graded: 'Calificado',
    submitted: 'Enviado',
    tf_true: 'Verdadero',
    tf_false: 'Falso',
    correctAnswer: 'Respuesta correcta',
    studentAnswer: 'Su respuesta',
    noAnswer: '— en blanco —',
    markCorrect: '✓ Correcto',
    markIncorrect: '✗ Aún no',
    pending: 'Necesita tu revisión',
    feedback: 'Una nota para tu estudiante (opcional)',
    feedbackPh: 'Anímalo, señala una cosa para practicar…',
    save: 'Guardar calificación',
    saving: 'Guardando…',
    score: (a: number, b: number) => `${a} de ${b} aciertos`,
    cancelled: 'Cancelado',
  },
}

const card: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--ek-border)',
  background: 'var(--ek-card)',
}

function fmtCorrect(q: SQuestion, tx: (typeof t)['es']): string {
  if (q.type === 'mcq_single' || q.type === 'mcq_multi')
    return (q.options || []).filter((o) => o.correct).map((o) => o.text).join(', ') || '—'
  if (q.type === 'true_false') return q.answer === undefined ? '—' : q.answer ? tx.tf_true : tx.tf_false
  if (q.type === 'short_answer') return (q.accepted || []).join('  /  ') || '—'
  if (q.type === 'matching') return (q.pairs || []).map((p) => `${p.left} → ${p.right}`).join(';  ') || '—'
  return q.guidance || '—'
}

function fmtStudent(q: SQuestion, answer: unknown, tx: (typeof t)['es']): string {
  if (q.type === 'mcq_single') {
    const i = typeof answer === 'number' ? answer : -1
    return (q.options || [])[i]?.text || tx.noAnswer
  }
  if (q.type === 'mcq_multi') {
    const idx = Array.isArray(answer) ? (answer as number[]) : []
    const texts = idx.map((i) => (q.options || [])[i]?.text).filter(Boolean) as string[]
    return texts.length ? texts.join(', ') : tx.noAnswer
  }
  if (q.type === 'true_false') return typeof answer === 'boolean' ? (answer ? tx.tf_true : tx.tf_false) : tx.noAnswer
  if (q.type === 'short_answer' || q.type === 'essay')
    return typeof answer === 'string' && answer.trim() ? answer : tx.noAnswer
  if (q.type === 'matching') {
    const given = Array.isArray(answer) ? (answer as (string | null)[]) : []
    return (q.lefts || []).map((l, i) => `${l} → ${given[i] || '—'}`).join(';  ') || tx.noAnswer
  }
  return tx.noAnswer
}

export default function TeacherReviewClient({ lang, quizTitle, attempts }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [openId, setOpenId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [overrides, setOverrides] = useState<Record<string, 'correct' | 'incorrect'>>({})
  const [error, setError] = useState('')

  const open = (row: AttemptRow) => {
    if (!row.attemptId) return
    setOpenId(row.attemptId === openId ? null : row.attemptId)
    setFeedback(row.teacherFeedback)
    setOverrides({})
    setError('')
  }

  const save = (attemptId: string) => {
    if (pending) return
    setError('')
    startTransition(async () => {
      const res = await gradeQuizAttempt({ attemptId, feedback, overrides, lang })
      if (res && 'error' in res) setError(res.error ?? '')
      else {
        setOpenId(null)
        router.refresh()
      }
    })
  }

  const badge = (row: AttemptRow) => {
    if (!row.submitted) return { label: tx.notSubmitted, color: 'var(--ek-text-muted)' }
    if (row.graded) return { label: `${tx.graded} · ${tx.score(row.autoScore, row.maxScore)}`, color: '#16794d' }
    const hasPending = row.questions.some((q) => q.outcome === 'pending')
    if (hasPending) return { label: tx.toReview, color: 'var(--ek-red)' }
    return { label: `${tx.submitted} · ${tx.score(row.autoScore, row.maxScore)}`, color: 'var(--ek-text)' }
  }

  return (
    <div style={{ background: 'var(--ek-paper)', minHeight: '100%' }}>
      <DashTopBar title={<>{quizTitle} — <TitleFlourish>{tx.flourish}</TitleFlourish></>} sub={tx.sub} />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 'clamp(20px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Link href={`/${lang}/maestro/dashboard/quizzes`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--ek-red)', textDecoration: 'none' }}>{tx.back}</Link>

        {attempts.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ek-text-muted)', fontStyle: 'italic', fontFamily: 'var(--ek-font-serif)' }}>{tx.none}</p>
        ) : (
          attempts.map((row) => {
            const b = badge(row)
            const isOpen = !!row.attemptId && openId === row.attemptId
            return (
              <div key={row.assignmentId} style={card}>
                <button
                  onClick={() => open(row)}
                  disabled={!row.submitted}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 0,
                    padding: '14px 18px',
                    cursor: row.submitted ? 'pointer' : 'default',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-text)' }}>{row.studentName}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: b.color, fontFamily: 'var(--ek-font-mono)' }}>{row.status === 'cancelled' ? tx.cancelled : b.label}</span>
                    {row.submitted && <span aria-hidden style={{ color: 'var(--ek-text-muted)' }}>{isOpen ? '▾' : '▸'}</span>}
                  </span>
                </button>

                {isOpen && row.attemptId && (
                  <div style={{ borderTop: '1px solid var(--ek-border)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {row.questions.map((q, i) => {
                      const ovVal = overrides[q.id] as 'correct' | 'incorrect' | undefined
                      const storedVal = q.outcome as 'correct' | 'incorrect' | 'pending' | undefined
                      const current: 'correct' | 'incorrect' | 'pending' = ovVal ?? storedVal ?? 'pending'
                      const setOv = (v: 'correct' | 'incorrect') => setOverrides((p) => ({ ...p, [q.id]: v }))
                      // Key fields exist in the snapshot only when the quiz allowed
                      // review-after; otherwise there is no correct answer to show.
                      const correct = fmtCorrect(q, tx)
                      return (
                        <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ek-text)' }}>
                            <span style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 11, color: 'var(--ek-text-muted)', marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</span>
                            {q.prompt}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--ek-text)' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ek-text-muted)' }}>{tx.studentAnswer}: </span>
                            {fmtStudent(q, row.answers[q.id], tx)}
                          </div>
                          {correct !== '—' && (
                            <div style={{ fontSize: 13, color: 'var(--ek-text-muted)' }}>
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{tx.correctAnswer}: </span>
                              {correct}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                            {(['correct', 'incorrect'] as const).map((v) => {
                              const active = current === v
                              return (
                                <button
                                  key={v}
                                  onClick={() => setOv(v)}
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    padding: '5px 12px',
                                    borderRadius: 999,
                                    cursor: 'pointer',
                                    border: '1px solid var(--ek-border)',
                                    background: active ? (v === 'correct' ? 'rgba(22,121,77,0.12)' : 'rgba(193,39,45,0.10)') : 'transparent',
                                    color: active ? (v === 'correct' ? '#16794d' : 'var(--ek-red)') : 'var(--ek-text-muted)',
                                  }}
                                >
                                  {v === 'correct' ? tx.markCorrect : tx.markIncorrect}
                                </button>
                              )
                            })}
                            {current === 'pending' && <span style={{ fontSize: 12, color: 'var(--ek-red)', alignSelf: 'center', fontWeight: 600 }}>{tx.pending}</span>}
                          </div>
                        </div>
                      )
                    })}

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', marginBottom: 6 }}>{tx.feedback}</label>
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder={tx.feedbackPh}
                        rows={3}
                        maxLength={4000}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--ek-border)', background: 'var(--ek-paper)', color: 'var(--ek-text)', fontSize: 14, fontFamily: 'var(--ek-font-sans)', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <button
                        onClick={() => save(row.attemptId!)}
                        disabled={pending}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ek-red)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 8, border: 0, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.7 : 1 }}
                      >
                        {pending && <Spinner size={14} stroke="#fff" />}
                        {pending ? tx.saving : tx.save}
                      </button>
                      {error && <span role="alert" style={{ fontSize: 13, color: 'var(--ek-red)' }}>{error}</span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
